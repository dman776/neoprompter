// Mechanical repo conventions that tooling can enforce, run by `npm run check`.
// Judgement calls stay with the code reviewer; see docs/run-and-test.md for the other checks.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  avoidTerms,
  coreProblems,
  glossaryProblems,
  ticketRefProblems,
  userFacingStrings,
} from './conventions.mjs';

const config = JSON.parse(readFileSync('scripts/conventions.config.json', 'utf8'));
const terms = avoidTerms(readFileSync('GLOSSARY.md', 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk('src').filter((f) => /\.(ts|html)$/.test(f));
const isTest = (f) => /\.test\.ts$/.test(f);
const problems = [];

for (const file of sources) {
  const source = readFileSync(file, 'utf8');
  problems.push(...ticketRefProblems(source, file));
  if (file.startsWith(join('src', 'core')) && !isTest(file))
    problems.push(...coreProblems(source, file));
  if (config.userFacingFiles.some((prefix) => file.startsWith(prefix)) && !isTest(file)) {
    problems.push(
      ...glossaryProblems(userFacingStrings(source, file), terms, config.glossaryAllow, file),
    );
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} convention problem(s).`);
  process.exit(1);
}
console.log('conventions ok');
