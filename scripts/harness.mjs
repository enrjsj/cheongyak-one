#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { changes, selectScope, reviewNeeds, planSteps, testEnvironment, guardChecks, frontendEnvFiles, aggregateStatus } from './harness/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args.shift() || 'help';
let base = 'HEAD', scope = 'auto', extended = false;
const help = `청약한눈 로컬 하네스 (Git 쓰기/배포/운영 API 호출 없음)
  node scripts/harness.mjs doctor
  node scripts/harness.mjs plan [--base REF] [--scope auto|docs|frontend|backend|full] [--extended]
  node scripts/harness.mjs check [--base REF]
  node scripts/harness.mjs verify [--base REF] [--scope auto|docs|frontend|backend|full] [--extended]
보고서: .harness/reports/<실행 ID>/report.json
종료 코드: 0=선택 범위 통과, 1=검증 실패, 2=준비 미완료/실행 차단
full = 프런트 단위/빌드 + Chromium + 백엔드 H2. PostgreSQL/실데이터/운영 검증은 별도.
--extended = iPhone 모의 API + 실제 로컬 Spring 인증(Chromium/iPhone) 추가.`;

function toolName(tool) { return process.platform === 'win32' && ['npm', 'mvn'].includes(tool) ? `${tool}.cmd` : tool; }
function probe(tool, params) {
  const result = spawnSync(toolName(tool), params, { encoding: 'utf8', timeout: 15_000,
    env: testEnvironment(process.env), shell: process.platform === 'win32' && ['npm', 'mvn'].includes(tool) });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return { ok: !result.error && result.status === 0, output };
}

function doctor() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeMinor = Number(process.versions.node.split('.')[1]);
  const java = probe('java', ['-version']);
  const maven = probe('mvn', ['-version']);
  const npm = probe('npm', ['--version']);
  const git = probe('git', ['--version']);
  let chromiumReady = false, webkitReady = false;
  try {
    const requireFrontend = createRequire(path.join(root, 'frontend/package.json'));
    const { chromium, webkit } = requireFrontend('@playwright/test');
    chromiumReady = existsSync(chromium.executablePath());
    webkitReady = existsSync(webkit.executablePath());
  } catch { /* missing dependencies are reported below; no automatic installation */ }
  return [
    { name: 'Node >=22.12', ok: nodeMajor > 22 || nodeMajor === 22 && nodeMinor >= 12, version: process.versions.node },
    { name: 'Git', ok: git.ok },
    { name: 'npm', ok: npm.ok },
    { name: 'Java 21', ok: java.ok && /version "21\./.test(java.output) },
    { name: 'Maven >=3.9', ok: maven.ok && /Apache Maven (?:3\.(?:9|[1-9]\d)|[4-9]\.)/.test(maven.output) },
    { name: 'frontend dependencies', ok: existsSync(path.join(root, 'frontend/node_modules/@playwright/test')) },
    { name: 'Playwright Chromium', ok: chromiumReady },
    { name: 'Playwright WebKit', ok: webkitReady },
  ];
}

function prerequisite(step, checks) {
  const required = ['Node >=22.12', 'Git'];
  if (step.tool === 'npm') required.push('npm', 'frontend dependencies');
  if (step.id === 'browser' || step.id === 'auth-browsers') required.push('Playwright Chromium');
  if (step.id === 'iphone' || step.id === 'auth-browsers') required.push('Playwright WebKit');
  if (step.tool === 'mvn' || step.id === 'auth-browsers') required.push('Java 21', 'Maven >=3.9');
  const missing = checks.filter(check => required.includes(check.name) && !check.ok).map(check => check.name);
  if (step.tool === 'npm') {
    const envFiles = frontendEnvFiles(root);
    if (envFiles.length) missing.push('frontend에 .env 계열 파일이 있음: 비밀값 없는 별도 worktree에서 실행 (자동 삭제하지 않음)');
  }
  return missing;
}

async function runStep(step, directory) {
  const started = Date.now();
  const logPath = path.join(directory, `${step.id}.log`);
  const log = createWriteStream(logPath, { mode: 0o600 });
  const display = `${step.tool} ${step.args.join(' ')}`;
  console.log(`실행: [${step.cwd}] ${display}`);
  return await new Promise(resolve => {
    const child = spawn(toolName(step.tool), step.args, { cwd: path.join(root, step.cwd),
      env: { ...testEnvironment(process.env), ...step.extraEnv },
      shell: process.platform === 'win32' && ['npm', 'mvn'].includes(step.tool),
      timeout: 15 * 60 * 1000 });
    // Tool output stays local; reports contain no environment variables or raw test data.
    child.stdout?.on('data', data => log.write(data));
    child.stderr?.on('data', data => log.write(data));
    let spawnError = false;
    child.on('error', () => { spawnError = true; });
    const pulse = setInterval(() => console.log(`진행 중: ${step.id} (${Math.round((Date.now() - started) / 1000)}초)`), 30_000);
    child.on('close', (code, signal) => {
      clearInterval(pulse);
      log.end(() => {
        const result = { id: step.id, command: display, cwd: step.cwd,
          status: spawnError ? 'blocked' : code === 0 && !signal ? 'passed' : 'failed',
          exitCode: code, signal, durationMs: Date.now() - started,
          log: path.relative(root, logPath).split(path.sep).join('/') };
        console.log(`${result.status}: ${step.id}`);
        resolve(result);
      });
    });
  });
}

async function main() {
  while (args.length) {
    const arg = args.shift();
    if (arg === '--base' && args.length) base = args.shift();
    else if (arg === '--scope' && args.length) scope = args.shift();
    else if (arg === '--extended') extended = true;
    else throw new Error(`지원하지 않는 인자: ${arg}`);
  }
  if (command === 'help' || command === '--help') { console.log(help); return; }
  if (!['doctor', 'plan', 'check', 'verify'].includes(command)) throw new Error(`지원하지 않는 명령: ${command}`);
  if (!['auto', 'docs', 'frontend', 'backend', 'full'].includes(scope)) throw new Error(`지원하지 않는 scope: ${scope}`);
  if (command === 'doctor') {
    const checks = doctor();
    console.log(JSON.stringify(checks, null, 2));
    if (checks.some(check => !check.ok)) process.exitCode = 2;
    return;
  }
  const snapshot = changes(root, base);
  const inferred = selectScope(snapshot.files);
  const selected = scope === 'auto' ? inferred : scope;
  const steps = planSteps(selected, extended);
  const reviews = reviewNeeds(snapshot.files);
  const description = { ...snapshot, requestedScope: scope, inferredScope: inferred, selectedScope: selected,
    extended, reviewRequired: reviews, steps };
  if (command === 'plan') { console.log(JSON.stringify(description, null, 2)); return; }

  const directory = path.join(root, '.harness/reports', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const errors = guardChecks(root, snapshot);
  const report = { schemaVersion: 1, command, ...description, startedAt: new Date().toISOString(),
    errors, results: [], status: 'running',
    notVerified: ['운영 DB/운영 배포/실제 공공데이터 API/메일·SMS·푸시·AI 발송',
      '실제 PostgreSQL migration (기존 CI / postgres 또는 승인된 테스트 DB에서 별도 검증)',
      ...(['docs', 'backend'].includes(selected) ? ['프런트 단위/빌드 및 Chromium 전체 흐름 (선택 범위 밖)'] : []),
      ...(['docs', 'frontend'].includes(selected) ? ['백엔드 전체 테스트 (선택 범위 밖)'] : []),
      ...(extended ? [] : ['실제 Spring 인증 및 iPhone WebKit (--extended 필요)'])] };
  const save = () => writeFileSync(path.join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  save(); // interrupted run remains visibly unfinished
  if (errors.length) console.log(errors.join('\n'));
  if (command === 'verify' && errors.length === 0) {
    const checks = doctor();
    for (const step of steps) {
      const missing = prerequisite(step, checks);
      const build = report.results.find(result => result.id === 'auth-build');
      if (step.id === 'auth-browsers' && build?.status !== 'passed') missing.push('auth-build 성공 필요');
      if (missing.length) {
        report.results.push({ id: step.id, status: 'blocked', reasons: missing });
        console.log(`blocked: ${step.id}: ${missing.join(', ')}`);
      } else report.results.push(await runStep(step, directory));
      save();
    }
  }
  const finalSnapshot = changes(root, base);
  report.worktreeChangedDuringRun = snapshot.fingerprint !== finalSnapshot.fingerprint;
  report.status = aggregateStatus(report.results, errors, report.worktreeChangedDuringRun);
  report.finishedAt = new Date().toISOString();
  if (command === 'check') report.notVerified.push('check는 프로젝트 테스트를 실행하지 않음');
  save();
  console.log(JSON.stringify({ status: report.status, scope: selected, results: report.results,
    report: path.relative(root, path.join(directory, 'report.json')), reviewRequired: reviews, notVerified: report.notVerified }, null, 2));
  process.exitCode = report.status === 'failed' ? 1 : report.status === 'blocked' ? 2 : 0;
}

main().catch(error => { console.error(error.message); process.exitCode = 2; });
