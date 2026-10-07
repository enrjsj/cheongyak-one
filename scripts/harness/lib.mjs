import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MIGRATIONS = 'backend/src/main/resources/db/migration/';
export const REQUIRED = ['AGENTS.md', 'docs/PROJECT_CONTEXT.md', 'docs/HANDOFF.md',
  'docs/DECISIONS.md', 'docs/HARNESS.md', 'docs/tasks/TEMPLATE.md'];

export function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Git 읽기 실패: ${args[0]} (저장소/기준 ref를 확인하세요)`);
  return result.stdout;
}

export function changes(root, base = 'HEAD') {
  if (!/^[A-Za-z0-9][A-Za-z0-9_./~^@{}-]*$/.test(base)) throw new Error('올바른 Git ref 또는 커밋 SHA를 지정하세요.');
  const baseline = git(root, ['rev-parse', '--verify', `${base}^{commit}`]).trim();
  const parts = git(root, ['diff', '--name-status', '--no-renames', '-z', baseline, '--']).split('\0');
  const rows = [];
  for (let i = 0; i < parts.length - 1; i += 2) rows.push({ status: parts[i], path: parts[i + 1] });
  for (const file of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
    rows.push({ status: 'A', path: file });
  }
  const unique = [...new Map(rows.map(row => [row.path, row])).values()].sort((a, b) => a.path.localeCompare(b.path));
  const diff = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--binary', baseline, '--']);
  const hash = createHash('sha256').update(baseline).update(diff);
  for (const row of unique.filter(row => row.status === 'A')) {
    hash.update(row.path);
    if (existsSync(path.join(root, row.path))) hash.update(readFileSync(path.join(root, row.path)));
  }
  return { baseline, head: git(root, ['rev-parse', 'HEAD']).trim(), files: unique, fingerprint: hash.digest('hex') };
}

export function selectScope(files) {
  let front = false, back = false;
  for (const { path: file } of files) {
    if (file.startsWith('frontend/')) front = true;
    else if (file.startsWith('backend/')) back = true;
    else if (file.endsWith('.md') || file === '.gitignore' || file.startsWith('scripts/harness/') || file === 'scripts/harness.mjs') continue;
    else { front = true; back = true; } // unknown config or shared tooling: never silently under-test
  }
  return front && back ? 'full' : front ? 'frontend' : back ? 'backend' : 'docs';
}

export function reviewNeeds(files) {
  const reasons = new Set();
  for (const { path: file } of files) {
    if (file.startsWith(MIGRATIONS)) reasons.add('새 migration: 별도 테스트 PostgreSQL로 기존 CI / postgres 검증 필요 (H2로 대체 불가)');
    if (/auth|csrf|cors|session|frontend\/src\/api\.ts/i.test(file)) reasons.add('인증/API 경계: --extended 실제 로컬 세션·iPhone 검증 및 계약 리뷰 필요');
    if (/^(infra\/|\.github\/|Dockerfile|render\.yaml|Procfile)|vercel\.json/.test(file)) reasons.add('배포/CI 설정: 별도 리뷰 필요. 하네스는 배포·인프라 실행을 하지 않음');
  }
  return [...reasons];
}

export function planSteps(scope, extended = false) {
  if (!['docs', 'frontend', 'backend', 'full'].includes(scope)) throw new Error(`지원하지 않는 scope: ${scope}`);
  const steps = [{ id: 'harness-tests', tool: 'node', cwd: '.', args: ['--test', 'scripts/harness/harness.test.mjs'] }];
  if (scope === 'frontend' || scope === 'full') {
    steps.push({ id: 'frontend', tool: 'npm', cwd: 'frontend', args: ['test'] });
    steps.push({ id: 'browser', tool: 'npm', cwd: 'frontend', args: ['run', 'test:e2e', '--', '--project=chromium', '--workers=2'] });
  }
  if (scope === 'backend' || scope === 'full') steps.push({ id: 'backend', tool: 'mvn', cwd: '.', args: ['-B', '-pl', 'backend', 'test'] });
  if (extended) {
    steps.push({ id: 'iphone', tool: 'npm', cwd: 'frontend', args: ['run', 'test:e2e', '--', '--project=iphone-webkit', '--workers=2'], extraEnv: { IPHONE_TEST: '1' } });
    steps.push({ id: 'auth-build', tool: 'mvn', cwd: '.', args: ['-B', '-pl', 'backend', '-DskipTests', 'package'] });
    steps.push({ id: 'auth-browsers', tool: 'npm', cwd: 'frontend', args: ['run', 'test:e2e', '--', '--config=playwright.auth.config.ts'] });
  }
  return steps;
}

// Only toolchain/OS paths are inherited; DB, SMTP, REB, OpenAI and deployment credentials are not.
export function testEnvironment(source) {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'COMSPEC', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR',
    'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'JAVA_HOME', 'MAVEN_HOME', 'M2_HOME',
    'LANG', 'LC_ALL', 'PLAYWRIGHT_BROWSERS_PATH']);
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key.toUpperCase())));
  return { ...env, CI: '1', TZ: 'Asia/Seoul', VITE_API_BASE_URL: '',
    VITE_API_PROXY_TARGET: 'http://127.0.0.1:9', VERCEL: '1' };
}

export function secretKinds(text) {
  const rules = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ['openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/],
    ['credential-url', /(?:postgres(?:ql)?|mysql):\/\/[^\s:/]+:[^\s@]+@(?!localhost\b|127\.0\.0\.1\b)[^\s/]+/],
  ];
  return rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

export function checkMigrations(files, filenames) {
  const errors = [];
  for (const row of files) {
    if (row.path.startsWith(MIGRATIONS) && row.status !== 'A') errors.push(`${row.path}: 기준 커밋의 migration 수정/삭제 금지. 새 버전을 추가하세요.`);
  }
  const versions = new Map();
  for (const name of filenames) {
    const match = /^V(\d+)__[A-Za-z0-9_-]+\.sql$/.exec(name);
    if (!match) { errors.push(`${MIGRATIONS}${name}: V숫자__설명.sql 형식이 필요합니다.`); continue; }
    const version = BigInt(match[1]).toString();
    if (versions.has(version)) errors.push(`중복 migration 버전 ${version}: ${versions.get(version)}, ${name}`);
    versions.set(version, name);
  }
  return errors;
}

export function guardChecks(root, snapshot) {
  const errors = REQUIRED.filter(file => !existsSync(path.join(root, file))).map(file => `필수 문서 없음: ${file}`);
  errors.push(...checkMigrations(snapshot.files, readdirSync(path.join(root, MIGRATIONS)).filter(file => file.endsWith('.sql'))));
  const whitespace = spawnSync('git', ['-C', root, 'diff', '--check', snapshot.baseline, '--'], { encoding: 'utf8' });
  if (whitespace.error || whitespace.status !== 0) errors.push('git diff --check 실패. 공백 오류/충돌 표시를 확인하세요.');
  const tracked = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  const candidates = new Set([...tracked, ...snapshot.files.filter(row => row.status !== 'D').map(row => row.path)]);
  for (const file of candidates) {
    if (!existsSync(path.join(root, file))) continue;
    if (/(^|\/)(node_modules|target|dist)\//.test(file)) errors.push(`생성 파일이 Git 추적/추가 대상임: ${file}`);
    if (/(^|\/)\.env(?:\..+)?$/.test(file) && !file.endsWith('.example')) errors.push(`환경 파일이 Git 추적/추가 대상임: ${file}`);
  }
  for (const row of snapshot.files.filter(row => row.status !== 'D')) {
    if (!existsSync(path.join(root, row.path))) continue;
    let text;
    if (row.status === 'A') text = readFileSync(path.join(root, row.path), 'utf8');
    else text = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--unified=0', snapshot.baseline, '--', row.path])
      .split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n');
    for (const kind of secretKinds(text)) errors.push(`${row.path}: 비밀값 의심 패턴 ${kind} (값은 출력하지 않음)`);
  }
  return errors;
}

export function frontendEnvFiles(root) {
  // Vite loads these files even when process.env was filtered.
  return readdirSync(path.join(root, 'frontend')).filter(name => /^\.env(?:\.|$)/.test(name) && !name.endsWith('.example'));
}

export function aggregateStatus(steps, errors = [], changed = false) {
  if (errors.length || changed || steps.some(step => step.status === 'failed')) return 'failed';
  if (steps.some(step => step.status === 'blocked')) return 'blocked';
  return 'passed';
}
