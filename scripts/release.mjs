#!/usr/bin/env node
/**
 * Release script for checkov-coverage-comment.
 *
 * Reads changelog fragment files from changelogs/*.md.
 * Each file must have YAML frontmatter with a required `type` field:
 *
 *   ---
 *   type: minor        # major | minor | patch
 *   scope: runtime     # optional — shown as "(runtime)" in the changelog
 *   ---
 *   Human-readable description of the change.
 *
 * Steps:
 *  1. Reads all fragments, determines bump type (major > minor > patch)
 *  2. Computes next version from package.json
 *  3. Prepends new section to CHANGELOG.md
 *  4. Deletes all fragment files
 *  5. Updates version in package.json
 *  6. Runs npm run build
 *  7. Commits and tags
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANGELOGS_DIR = join(ROOT, 'changelogs');
const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');
const PKG_PATH = join(ROOT, 'package.json');

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** Parse YAML frontmatter from a markdown file. Returns { meta, body }. */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing or malformed frontmatter (expected --- ... ---)');
  }
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) meta[kv[1].trim()] = kv[2].trim();
  }
  return { meta, body: match[2].trim() };
}

// 1. Read fragments
const VALID_TYPES = new Set(['major', 'minor', 'patch']);
const fragmentFiles = readdirSync(CHANGELOGS_DIR).filter((f) => f.endsWith('.md'));

if (fragmentFiles.length === 0) {
  console.error('No changelog fragments found in changelogs/');
  console.error('Create at least one .md file with frontmatter — e.g. changelogs/fix-bug.md');
  process.exit(1);
}

const fragments = [];
for (const file of fragmentFiles) {
  const raw = readFileSync(join(CHANGELOGS_DIR, file), 'utf8');
  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (err) {
    console.error(`Error parsing ${file}: ${err.message}`);
    process.exit(1);
  }
  const { meta, body } = parsed;
  if (!meta.type || !VALID_TYPES.has(meta.type)) {
    console.error(`${file}: "type" must be one of major | minor | patch (got: ${meta.type})`);
    process.exit(1);
  }
  fragments.push({ file, type: meta.type, scope: meta.scope || null, body });
}

// 2. Determine bump type
const BUMP_PRIORITY = { major: 3, minor: 2, patch: 1 };
const bumpType = fragments.reduce(
  (highest, f) => (BUMP_PRIORITY[f.type] > BUMP_PRIORITY[highest] ? f.type : highest),
  'patch'
);

const grouped = { major: [], minor: [], patch: [] };
for (const f of fragments) grouped[f.type].push(f);

// 3. Compute new version
const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
const currentVersion = pkg.version;
const newVersion = bumpVersion(currentVersion, bumpType);
const today = new Date().toISOString().slice(0, 10);

console.log(`Releasing ${currentVersion} → ${newVersion} (${bumpType} bump)`);

// 4. Compile fragment content into changelog entry
const SECTION_ORDER = ['major', 'minor', 'patch'];
const SECTION_LABELS = {
  major: 'Breaking Changes',
  minor: 'New Features',
  patch: 'Bug Fixes & Improvements',
};

let changelogEntry = `## [${newVersion}] - ${today}\n\n`;

for (const type of SECTION_ORDER) {
  if (grouped[type].length === 0) continue;
  changelogEntry += `### ${SECTION_LABELS[type]}\n\n`;
  for (const { scope, body } of grouped[type]) {
    const prefix = scope ? `**${scope}:** ` : '';
    changelogEntry += `- ${prefix}${body}\n`;
  }
  changelogEntry += '\n';
}

// 5. Prepend to CHANGELOG.md
let existingChangelog = '';
try {
  existingChangelog = readFileSync(CHANGELOG_PATH, 'utf8');
} catch {
  existingChangelog = '# Changelog\n\n';
}

const headingMatch = existingChangelog.match(/^(# .+\r?\n\r?\n?)/);
if (headingMatch) {
  writeFileSync(
    CHANGELOG_PATH,
    existingChangelog.slice(0, headingMatch[0].length) +
      changelogEntry +
      existingChangelog.slice(headingMatch[0].length)
  );
} else {
  writeFileSync(CHANGELOG_PATH, `# Changelog\n\n${changelogEntry}${existingChangelog}`);
}

// 6. Delete fragment files
for (const { file } of fragments) {
  unlinkSync(join(CHANGELOGS_DIR, file));
}
console.log(`Deleted ${fragments.length} fragment file(s)`);

// 7. Update version in package.json
pkg.version = newVersion;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

// 8. Build
console.log('Building dist/...');
run('npm run build');

// 9. Commit and tag
run(`git add dist/ CHANGELOG.md package.json changelogs/`);
run(`git commit -m "chore: release v${newVersion}"`);
run(`git tag -a "v${newVersion}" -m "Release v${newVersion}"`);

// Force-update the floating major tag (e.g. v1)
const majorTag = `v${newVersion.split('.')[0]}`;
try {
  run(`git tag -f "${majorTag}"`);
} catch {
  run(`git tag "${majorTag}"`);
}

console.log('');
console.log(`Released v${newVersion} successfully!`);
console.log(`Tags created: v${newVersion}, ${majorTag}`);
console.log('');
console.log('Push with:');
console.log(
  `  git push origin main --force-with-lease && git push origin "v${newVersion}" "${majorTag}" --force`
);
