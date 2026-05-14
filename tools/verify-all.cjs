#!/usr/bin/env node
// Orchestrates every gate the project ships behind. Designed to be cross-shell
// (npm runs this under cmd.exe on Windows and /bin/sh on POSIX) so it does not
// rely on `&&` chaining. Each step is reported as [PASS] / [FAIL] on its own
// line; on failure the orchestrator surfaces the captured stderr and exits 1.

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const npmCli = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCli = process.execPath;

// On Windows, npm is `npm.cmd` and spawning it directly without a shell raises
// EINVAL. Wrapping just the npm step in shell mode (and leaving the node steps
// non-shell) keeps node's full path with spaces (`C:\Program Files\...`)
// safe — shell mode would otherwise split that path on the first space.
const steps = [
  {
    label: 'build',
    cmd: npmCli,
    args: ['run', 'build', '--silent'],
    quietStdout: true,
    useShell: process.platform === 'win32',
  },
  {
    label: 'syntax: server/proxy-handler.cjs',
    cmd: nodeCli,
    args: ['--check', 'server/proxy-handler.cjs'],
  },
  {
    label: 'syntax: api/proxy.mjs',
    cmd: nodeCli,
    args: ['--check', 'api/proxy.mjs'],
  },
  {
    label: 'commercial policy (blocked host fetch = 0)',
    cmd: nodeCli,
    args: ['tools/verify-commercial-policy.cjs'],
  },
  {
    label: 'proxy policy (upstream fetch = 0)',
    cmd: nodeCli,
    args: ['tools/verify-proxy-policy.cjs'],
  },
  {
    label: 'SEC metric coverage',
    cmd: nodeCli,
    args: ['tools/verify-sec-metrics.cjs'],
  },
];

let failed = 0;
const startedAt = Date.now();

for (const step of steps) {
  const proc = spawnSync(step.cmd, step.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: Boolean(step.useShell),
  });
  const ok = proc.status === 0;
  if (ok) {
    console.log(`[PASS] ${step.label}`);
    if (!step.quietStdout && proc.stdout && proc.stdout.trim()) {
      for (const line of proc.stdout.trim().split(/\r?\n/)) {
        console.log(`        ${line}`);
      }
    }
  } else {
    failed += 1;
    console.log(`[FAIL] ${step.label}`);
    const detail = [proc.stdout, proc.stderr].filter(Boolean).join('').trim();
    if (detail) {
      for (const line of detail.split(/\r?\n/)) {
        console.log(`        ${line}`);
      }
    }
    if (proc.error) console.log(`        spawn error: ${proc.error.message}`);
  }
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);

if (failed === 0) {
  console.log(`\n[VERIFY] ${steps.length}/${steps.length} steps passed in ${elapsed}s`);
  process.exit(0);
} else {
  console.log(`\n[VERIFY] ${failed} step(s) failed (${steps.length - failed}/${steps.length} passed) in ${elapsed}s`);
  process.exit(1);
}
