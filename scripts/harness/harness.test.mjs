import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { changes, selectScope, reviewNeeds, planSteps, testEnvironment, secretKinds,
  checkMigrations, guardChecks, aggregateStatus, frontendEnvFiles, REQUIRED, MIGRATIONS } from './lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rows = (...paths) => paths.map(file => ({ status: 'M', path: file }));

test('scope: docs/tooling/frontend/backend/shared configuration', () => {
  for (const [files, scope] of [
    [[], 'docs'], [rows('docs/HANDOFF.md', 'AGENTS.md', 'scripts/harness.mjs'), 'docs'],
    [rows('frontend/src/App.tsx'), 'frontend'], [rows('backend/pom.xml'), 'backend'],
    [rows('frontend/src/api.ts', 'backend/pom.xml'), 'full'],
    [rows('pom.xml'), 'full'], [rows('.github/workflows/ci.yml'), 'full'], [rows('unknown.config'), 'full'],
  ]) assert.equal(selectScope(files), scope);
});

test('plan reuses npm test build; full includes backend and mock browser, extended adds real auth', () => {
  assert.deepEqual(planSteps('docs').map(step => step.id), ['harness-tests']);
  assert.deepEqual(planSteps('frontend').map(step => step.id), ['harness-tests', 'frontend', 'browser']);
  assert.deepEqual(planSteps('full', true).map(step => step.id),
    ['harness-tests', 'frontend', 'browser', 'backend', 'iphone', 'auth-build', 'auth-browsers']);
  assert.throws(() => planSteps('production'));
  const commands = JSON.stringify(planSteps('full', true));
  assert.doesNotMatch(commands, /git push|deploy-aws|curl|sync-executions/);
});

test('production credentials/profile/options do not reach test subprocesses', () => {
  const env = testEnvironment({ Path: 'tools', JAVA_HOME: 'jdk', HOME: 'home', SystemRoot: 'windows',
    DB_URL: 'production', POSTGRES_TEST_URL: 'production', OPENAI_API_KEY: 'secret',
    REB_API_KEY: 'secret', SMTP_PASSWORD: 'secret', NODE_OPTIONS: '--require unsafe',
    JAVA_TOOL_OPTIONS: 'unsafe', MAVEN_OPTS: 'unsafe', SPRING_PROFILES_ACTIVE: 'render',
    VITE_API_BASE_URL: 'https://production.invalid', VITE_API_PROXY_TARGET: 'https://production.invalid' });
  assert.equal(env.Path, 'tools');
  assert.equal(env.JAVA_HOME, 'jdk');
  assert.equal(env.SystemRoot, 'windows');
  for (const key of ['DB_URL', 'POSTGRES_TEST_URL', 'OPENAI_API_KEY', 'REB_API_KEY', 'SMTP_PASSWORD',
    'NODE_OPTIONS', 'JAVA_TOOL_OPTIONS', 'MAVEN_OPTS', 'SPRING_PROFILES_ACTIVE']) assert.equal(env[key], undefined);
  assert.equal(env.VITE_API_BASE_URL, '');
  assert.equal(env.VITE_API_PROXY_TARGET, 'http://127.0.0.1:9');
  assert.equal(env.CI, '1');
});

test('migration versions reject modification, deletion, duplicate/leading-zero collisions', () => {
  assert.equal(checkMigrations([{ status: 'A', path: `${MIGRATIONS}V40__new.sql` }], ['V40__new.sql']).length, 0);
  assert.equal(checkMigrations(rows(`${MIGRATIONS}V1__old.sql`), ['V1__old.sql']).length, 1);
  assert.equal(checkMigrations([{ status: 'D', path: `${MIGRATIONS}V1__old.sql` }], []).length, 1);
  assert.equal(checkMigrations([], ['V1__old.sql', 'V01__duplicate.sql']).length, 1);
  assert.equal(checkMigrations([], ['unexpected.sql']).length, 1);
});

test('secret checks detect synthetic keys without reporting values', () => {
  for (const [value, kind] of [
    ['ghp_' + 'a'.repeat(36), 'github-token'],
    ['github_pat_' + 'a'.repeat(50), 'github-token'],
    ['AKIA' + 'A'.repeat(16), 'aws-access-key'],
    ['sk-proj-' + 'a'.repeat(50), 'openai-key'],
    ['-----BEGIN ' + 'PRIVATE KEY-----', 'private-key'],
    ['postgresql://' + 'user:secret@db.example.invalid/test', 'credential-url'],
  ]) assert.deepEqual(secretKinds(value), [kind]);
  assert.deepEqual(secretKinds('OPENAI_API_KEY=\nDB_PASSWORD=\n'), []);
});

test('failures, blocked prerequisites and changing worktrees cannot pass', () => {
  assert.equal(aggregateStatus([{ status: 'passed' }]), 'passed');
  assert.equal(aggregateStatus([{ status: 'blocked' }]), 'blocked');
  assert.equal(aggregateStatus([{ status: 'failed' }, { status: 'blocked' }]), 'failed');
  assert.equal(aggregateStatus([], ['guard failure']), 'failed');
  assert.equal(aggregateStatus([], [], true), 'failed');
});

test('risk routing distinguishes PostgreSQL, authentication and deployment', () => {
  assert.equal(reviewNeeds(rows(`${MIGRATIONS}V40__new.sql`)).length, 1);
  assert.equal(reviewNeeds(rows('frontend/src/api.ts', 'backend/config/CsrfProtectionInterceptor.java')).length, 1);
  assert.equal(reviewNeeds(rows('render.yaml', '.github/workflows/ci.yml')).length, 1);
});

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cheongyak-harness-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true })); // only this test's exact temp directory
  const git = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (file, content = 'fixture\n') => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  git('init', '--quiet');
  git('config', 'user.email', 'harness@example.invalid');
  git('config', 'user.name', 'Harness fixture');
  for (const file of REQUIRED) write(file);
  write('.gitignore', '.harness/\nfrontend/.env.local\n');
  write(`${MIGRATIONS}V1__initial.sql`, 'select 1;\n');
  write('frontend/.env.example', 'VITE_API_BASE_URL=\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'test fixture');
  return { root, git, write };
}

test('snapshot includes staged, unstaged, untracked and deletions with stable fingerprint', t => {
  const { root, git, write } = fixture(t);
  write('frontend/a.txt'); git('add', 'frontend/a.txt');
  write('frontend/b.txt'); write('docs/DECISIONS.md', 'changed\n');
  git('rm', 'docs/HANDOFF.md');
  const snapshot = changes(root);
  assert.deepEqual(snapshot.files, [
    { status: 'M', path: 'docs/DECISIONS.md' }, { status: 'D', path: 'docs/HANDOFF.md' },
    { status: 'A', path: 'frontend/a.txt' }, { status: 'A', path: 'frontend/b.txt' },
  ]);
  assert.equal(changes(root).fingerprint, snapshot.fingerprint);
  write('frontend/b.txt', 'different\n');
  assert.notEqual(changes(root).fingerprint, snapshot.fingerprint);
  assert.throws(() => changes(root, '--help'));
  assert.throws(() => changes(root, 'not-a-real-ref'));
});

test('explicit base includes already committed changes', t => {
  const { root, git, write } = fixture(t);
  const base = git('rev-parse', 'HEAD');
  write('frontend/committed.txt'); git('add', '.'); git('commit', '--quiet', '-m', 'second');
  assert.equal(changes(root).files.length, 0);
  assert.equal(changes(root, base).files[0].path, 'frontend/committed.txt');
});

test('guard rejects changed migration and a new synthetic secret without leaking it', t => {
  const { root, write } = fixture(t);
  const secret = 'ghp_' + 'z'.repeat(36);
  write('unsafe.txt', secret);
  write(`${MIGRATIONS}V1__initial.sql`, 'select 2;\n');
  const errors = guardChecks(root, changes(root));
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /github-token/);
  assert.equal(errors.join('\n').includes(secret), false);
});

test('ignored Vite environment file is still detected without loading its content', t => {
  const { root, write } = fixture(t);
  assert.deepEqual(frontendEnvFiles(root), []);
  write('frontend/.env.local', 'do not read credentials\n');
  assert.equal(changes(root).files.length, 0);
  assert.deepEqual(frontendEnvFiles(root), ['.env.local']);
});

test('untracked environment files and generated output cannot bypass guards', t => {
  const { root, write } = fixture(t);
  write('other/.env.development', 'CONFIG=value\n');
  write('other/dist/index.html', '<html></html>\n');
  const errors = guardChecks(root, changes(root));
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /환경 파일/);
  assert.match(errors.join('\n'), /생성 파일/);
});

test('CLI plan/check/verify produce evidence and never change HEAD or index', t => {
  const { root, git, write } = fixture(t);
  for (const file of ['scripts/harness.mjs', 'scripts/harness/lib.mjs']) write(file, readFileSync(path.join(repo, file), 'utf8'));
  write('scripts/harness/harness.test.mjs', "import { test } from 'node:test';\ntest('fixture', () => {});\n");
  const head = git('rev-parse', 'HEAD');
  const index = git('diff', '--cached');
  const invoke = (...args) => {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/harness.mjs'), ...args], { encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
  };
  const plan = invoke('plan');
  assert.equal(plan.status, 0, plan.stderr);
  assert.equal(JSON.parse(plan.stdout).selectedScope, 'docs');
  assert.equal(invoke('check').status, 0);
  const verified = invoke('verify', '--scope', 'docs');
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  write('unsafe.txt', 'ghp_' + 'b'.repeat(36));
  const check = invoke('check');
  assert.equal(check.status, 1);
  assert.doesNotMatch(check.stdout, /b{36}/);
  const reports = readdirSync(path.join(root, '.harness/reports')).map(dir =>
    JSON.parse(readFileSync(path.join(root, '.harness/reports', dir, 'report.json'), 'utf8')));
  assert.deepEqual(reports.map(report => report.status).sort(), ['failed', 'passed', 'passed']);
  const verifyReport = reports.find(report => report.command === 'verify');
  assert.equal(verifyReport.results[0].status, 'passed');
  assert.equal(verifyReport.worktreeChangedDuringRun, false);
  assert.equal(git('rev-parse', 'HEAD'), head);
  assert.equal(git('diff', '--cached'), index);
});

test('CLI reports blocked frontend/browser prerequisites instead of passing missing tools', t => {
  const { root, write } = fixture(t);
  for (const file of ['scripts/harness.mjs', 'scripts/harness/lib.mjs']) write(file, readFileSync(path.join(repo, file), 'utf8'));
  write('scripts/harness/harness.test.mjs', "import { test } from 'node:test';\ntest('fixture', () => {});\n");
  // There are deliberately no frontend dependencies in this isolated fixture.
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/harness.mjs'), 'verify', '--scope', 'frontend'], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const dir = readdirSync(path.join(root, '.harness/reports'))[0];
  const report = JSON.parse(readFileSync(path.join(root, '.harness/reports', dir, 'report.json'), 'utf8'));
  assert.equal(report.status, 'blocked');
  assert.equal(report.results.find(step => step.id === 'harness-tests').status, 'passed');
  assert.equal(report.results.find(step => step.id === 'frontend').status, 'blocked');
  assert.equal(report.results.find(step => step.id === 'browser').status, 'blocked');
});
