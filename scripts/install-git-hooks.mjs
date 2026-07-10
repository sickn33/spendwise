import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  // Package archives and some CI environments do not include Git metadata.
  process.exit(0);
}

let existingHooksPath = '';
try {
  existingHooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // An unset hooks path is expected in a fresh clone.
}

if (existingHooksPath && existingHooksPath !== '.githooks') {
  console.warn(`SpendWise hooks not enabled because core.hooksPath is already ${existingHooksPath}.`);
  console.warn('Integrate .githooks/pre-commit, .githooks/commit-msg, and .githooks/pre-push into the existing hook chain.');
  process.exit(0);
}

if (existingHooksPath === '.githooks') {
  console.log('SpendWise privacy hooks already enabled.');
  process.exit(0);
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  const configured = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (configured !== '.githooks') throw new Error('Git did not retain the hooks path');
  console.log('SpendWise privacy hooks enabled.');
} catch (error) {
  console.error(`Unable to enable SpendWise privacy hooks: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}
