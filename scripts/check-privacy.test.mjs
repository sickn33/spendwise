import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scanner = join(import.meta.dirname, 'check-privacy.mjs');
const privateEmail = ['person', 'private.test'].join('@');
const noreplyEmail = ['184072420+sickn33', 'users.noreply.github.com'].join('@');

function git(cwd, args, env = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function scan(cwd, args, env = {}) {
  return spawnSync(process.execPath, [scanner, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function commit(cwd, message) {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', 'HEAD']).trim();
}

test('blocks identities, historical trees, filenames, logs, and annotated tags', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'spendwise-privacy-'));
  try {
    git(cwd, ['init', '--quiet']);
    git(cwd, ['config', 'user.name', 'SpendWise Test']);
    git(cwd, ['config', 'user.email', noreplyEmail]);

    writeFileSync(join(cwd, 'safe.txt'), 'safe fixture\n');
    const base = commit(cwd, 'safe baseline');

    const identityResult = scan(cwd, ['--check-identity'], {
      GIT_AUTHOR_EMAIL: privateEmail,
      GIT_COMMITTER_EMAIL: privateEmail,
    });
    assert.equal(identityResult.status, 1);
    assert.doesNotMatch(identityResult.stderr, new RegExp(privateEmail, 'u'));
    assert.match(identityResult.stderr, /effective author email/u);
    assert.match(identityResult.stderr, /effective committer email/u);

    const privateFilename = `fixture-${privateEmail}.txt`;
    writeFileSync(join(cwd, privateFilename), `also ${privateEmail}\n`);
    git(cwd, ['add', privateFilename]);
    const filenameResult = scan(cwd, ['--staged']);
    assert.equal(filenameResult.status, 1);
    assert.doesNotMatch(filenameResult.stderr, new RegExp(privateEmail, 'u'));
    assert.match(filenameResult.stderr, /\[redacted-email\]/u);

    const refResult = scan(cwd, ['--check-ref-name', `refs/heads/${privateEmail}`]);
    assert.equal(refResult.status, 1);
    assert.doesNotMatch(refResult.stderr, new RegExp(privateEmail, 'u'));
    assert.match(refResult.stderr, /Git ref name contains a disallowed email address/u);

    const leakedCommit = commit(cwd, 'temporary unsafe tree');
    rmSync(join(cwd, privateFilename));
    const cleanHead = commit(cwd, 'remove unsafe tree');
    const rangeResult = scan(cwd, ['--check-range', base, cleanHead]);
    assert.equal(rangeResult.status, 1);
    assert.doesNotMatch(rangeResult.stderr, new RegExp(privateEmail, 'u'));
    assert.match(rangeResult.stderr, new RegExp(leakedCommit, 'u'));

    git(cwd, ['-c', `user.email=${privateEmail}`, 'tag', '-a', 'v-private', '-m', 'safe tag message']);
    const tagResult = scan(cwd, ['--check-tag', 'refs/tags/v-private']);
    assert.equal(tagResult.status, 1);
    assert.doesNotMatch(tagResult.stderr, new RegExp(privateEmail, 'u'));
    assert.match(tagResult.stderr, /tagger email must use a GitHub noreply address/u);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
