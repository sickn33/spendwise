import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const argumentsSet = new Set(process.argv.slice(2));
const staged = argumentsSet.has('--staged');
const checkConfig = argumentsSet.has('--check-config');
const checkIdentity = argumentsSet.has('--check-identity');
const commitFlagIndex = process.argv.indexOf('--check-commit');
const commitRef = commitFlagIndex >= 0 ? process.argv[commitFlagIndex + 1] : null;
const tagFlagIndex = process.argv.indexOf('--check-tag');
const tagRef = tagFlagIndex >= 0 ? process.argv[tagFlagIndex + 1] : null;
const refNameFlagIndex = process.argv.indexOf('--check-ref-name');
const refName = refNameFlagIndex >= 0 ? process.argv[refNameFlagIndex + 1] : null;
const rangeFlagIndex = process.argv.indexOf('--check-range');
const rangeBase = rangeFlagIndex >= 0 ? process.argv[rangeFlagIndex + 1] : null;
const rangeHead = rangeFlagIndex >= 0 ? process.argv[rangeFlagIndex + 2] : null;
const messageFlagIndex = process.argv.indexOf('--message-file');
const messageFile = messageFlagIndex >= 0 ? process.argv[messageFlagIndex + 1] : null;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, { encoding, stdio: ['ignore', 'pipe', 'pipe'] });
}

function allowedEmail(email) {
  const normalized = email.toLowerCase();
  return /@example\.(?:com|org|net)$/u.test(normalized)
    || normalized.endsWith('@users.noreply.github.com');
}

function redactEmails(value) {
  return value.replace(emailPattern, '[redacted-email]');
}

function collectPaths() {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z'];
  return git(args).split('\0').filter(Boolean);
}

function fileContents(path) {
  return staged
    ? git(['show', `:${path}`], 'buffer')
    : readFileSync(path);
}

const violations = [];
function inspectText(label, text) {
  const safeLabel = redactEmails(label);
  for (const match of text.matchAll(emailPattern)) {
    if (allowedEmail(match[0])) continue;
    const line = text.slice(0, match.index).split('\n').length;
    violations.push(`${safeLabel}:${line}: disallowed email address (redacted)`);
  }
}

function inspectPath(path, contents, context = '') {
  const displayPath = context ? `${context}:${path}` : path;
  const pathEmails = [...path.matchAll(emailPattern)].filter(match => !allowedEmail(match[0]));
  if (pathEmails.length) {
    violations.push(`${redactEmails(displayPath)}: tracked filename contains a disallowed email address (redacted)`);
  }
  inspectText(displayPath, contents.toString('utf8').replaceAll('\0', ''));
}

const paths = collectPaths();
for (const path of paths) {
  try {
    inspectPath(path, fileContents(path));
  } catch {
    continue;
  }
}

if (messageFile) inspectText('commit message', readFileSync(messageFile, 'utf8'));

if (checkConfig) {
  let configuredEmail = '';
  try {
    configuredEmail = git(['config', '--get', 'user.email']).trim();
  } catch {
    // Missing identity must fail closed before a commit.
  }
  if (!configuredEmail || !configuredEmail.toLowerCase().endsWith('@users.noreply.github.com')) {
    violations.push('git config user.email must use a GitHub noreply address');
  }
}

function inspectEffectiveIdentity(variable, label) {
  let identity = '';
  try {
    identity = git(['var', variable]);
  } catch {
    violations.push(`unable to resolve effective ${label} identity`);
    return;
  }
  const emails = [...identity.matchAll(emailPattern)].map(match => match[0]);
  if (emails.length !== 1 || !emails.every(allowedEmail)) {
    violations.push(`effective ${label} email must use a GitHub noreply address`);
  }
}

if (checkIdentity) {
  inspectEffectiveIdentity('GIT_AUTHOR_IDENT', 'author');
  inspectEffectiveIdentity('GIT_COMMITTER_IDENT', 'committer');
}

function inspectTree(ref) {
  const safeRef = redactEmails(ref);
  let treePaths = [];
  try {
    treePaths = git(['ls-tree', '-r', '--name-only', '-z', ref]).split('\0').filter(Boolean);
  } catch {
    violations.push(`unable to inspect tracked files for ${safeRef}`);
    return;
  }
  for (const path of treePaths) {
    try {
      inspectPath(path, git(['show', `${ref}:${path}`], 'buffer'), ref);
    } catch {
      violations.push(`${safeRef}: unable to inspect a tracked file`);
    }
  }
}

function inspectCommit(ref) {
  const safeRef = redactEmails(ref);
  let commitEmails = [];
  try {
    commitEmails = git(['show', '-s', '--format=%ae%n%ce', ref]).trim().split('\n').filter(Boolean);
  } catch {
    violations.push(`unable to inspect commit metadata for ${safeRef}`);
  }
  if (commitEmails.some(email => !email.toLowerCase().endsWith('@users.noreply.github.com'))) {
    violations.push(`${safeRef}: author and committer emails must use GitHub noreply addresses`);
  }
  try {
    inspectText(`${ref}: commit message`, git(['show', '-s', '--format=%B', ref]));
  } catch {
    violations.push(`unable to inspect commit message for ${safeRef}`);
  }
  inspectTree(ref);
}

if (commitRef) inspectCommit(commitRef);

function inspectTag(ref) {
  const safeRef = redactEmails(ref);
  let objectType = '';
  try {
    objectType = git(['cat-file', '-t', ref]).trim();
  } catch {
    violations.push(`unable to inspect tag ${safeRef}`);
    return;
  }
  if (objectType === 'tag') {
    let taggerEmail = '';
    try {
      taggerEmail = git(['for-each-ref', '--format=%(taggeremail)', ref]).trim();
    } catch {
      violations.push(`unable to inspect tagger metadata for ${safeRef}`);
    }
    const emails = [...taggerEmail.matchAll(emailPattern)].map(match => match[0]);
    if (emails.length !== 1 || !emails.every(allowedEmail)) {
      violations.push(`${safeRef}: tagger email must use a GitHub noreply address`);
    }
    try {
      inspectText(`${ref}: tag message`, git(['for-each-ref', '--format=%(contents)', ref]));
    } catch {
      violations.push(`unable to inspect tag message for ${safeRef}`);
    }
  }
  inspectCommit(`${ref}^{commit}`);
}

if (tagRef) inspectTag(tagRef);

if (refName) {
  const emails = [...refName.matchAll(emailPattern)].filter(match => !allowedEmail(match[0]));
  if (emails.length) violations.push('Git ref name contains a disallowed email address (redacted)');
}

if (rangeFlagIndex >= 0) {
  if (!rangeBase || !rangeHead) {
    violations.push('--check-range requires base and head revisions');
  } else {
    let commits = [];
    try {
      commits = git(['rev-list', '--reverse', `${rangeBase}..${rangeHead}`]).trim().split('\n').filter(Boolean);
      if (!commits.length) commits = [rangeHead];
    } catch {
      violations.push('unable to inspect the requested commit range');
    }
    for (const commit of commits) inspectCommit(commit);
  }
}

if (violations.length) {
  console.error('Privacy gate failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Privacy gate passed for ${paths.length} ${staged ? 'staged' : 'tracked'} files.`);
