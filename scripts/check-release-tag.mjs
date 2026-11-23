// Usage: node scripts/check-release-tag.mjs <tag>
// Exits 1 with a message when the tag does not match package.json. In GitHub Actions it also
// writes `prerelease=true|false` to the step output.
import { appendFileSync, readFileSync } from 'node:fs';
import { checkReleaseTag } from './releaseTag.mjs';

const tag = process.argv[2];
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const result = checkReleaseTag(tag, version);
if (!result.ok) {
  console.error(result.message);
  // A workflow annotation, so the reason shows on the run's summary page.
  if (process.env.GITHUB_ACTIONS) console.error(`::error title=Release tag::${result.message}`);
  process.exit(1);
}
console.log(`ok: ${tag} matches package.json${result.prerelease ? ' (pre-release)' : ''}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `prerelease=${result.prerelease}\n`);
}
