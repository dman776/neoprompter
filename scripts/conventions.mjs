// Pure helpers for scripts/check-conventions.mjs. Each returns a list of problems (strings).

/** The `_Avoid_` terms from GLOSSARY.md, with the canonical term(s) to use instead. */
export function avoidTerms(glossary) {
  const uses = new Map();
  let current = '';
  for (const line of glossary.split('\n')) {
    const term = /^\*\*(.+?)\*\*/.exec(line);
    if (term) current = term[1];
    const avoid = /^_Avoid_:\s*(.+)$/.exec(line);
    if (avoid) {
      for (const word of avoid[1].split(',')) {
        const key = word.trim().replace(/\.$/, '');
        uses.set(key, [...(uses.get(key) ?? []), current]);
      }
    }
  }
  return [...uses].map(([word, use]) => ({ word, use: use.join(' or ') }));
}

/** Text a person reads: HTML text nodes, or prose-like string literals in TypeScript. */
export function userFacingStrings(source, file) {
  if (file.endsWith('.html')) {
    return [...source.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  }
  return [...source.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)]
    .map((m) => m[2])
    .filter((s) => /[a-z]{3}/i.test(s) && (s.includes(' ') || /^[A-Z]/.test(s)));
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Avoid terms used in user-facing text, unless an allowed phrase covers the use. */
export function glossaryProblems(strings, terms, allow, file) {
  const problems = [];
  for (const raw of strings) {
    let s = raw;
    for (const phrase of allow) s = s.replace(new RegExp(escapeRegExp(phrase), 'gi'), ' ');
    for (const { word, use } of terms) {
      if (new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(s)) {
        problems.push(
          `${file}: "${raw.trim().slice(0, 60)}" uses "${word}"; GLOSSARY.md says to use "${use}". ` +
            `If this use is right, add the phrase to glossaryAllow in scripts/conventions.config.json.`,
        );
      }
    }
  }
  return problems;
}

/** Comments and strings must not point at ticket numbers: tickets live in untracked .scratch/. */
export function ticketRefProblems(source, file) {
  return source
    .split('\n')
    .flatMap((line, i) =>
      /\bticket\s*#?\d+/i.test(line)
        ? [`${file}:${i + 1}: refers to a ticket number; say what the code does instead.`]
        : [],
    );
}

/** src/core is headless: no Electron, no DOM, and it never imports a renderer or module above it. */
export function coreProblems(source, file) {
  const problems = [];
  source.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (/from\s+['"]electron['"]/.test(line))
      problems.push(`${at}: core must not import Electron.`);
    if (/\b(document|window)\./.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
      problems.push(`${at}: core must not touch the DOM.`);
    }
    if (/from\s+['"]\.\.\/(main|operator|output|output-window|api|input|import)\b/.test(line)) {
      problems.push(`${at}: core must not import from a module that depends on it.`);
    }
  });
  return problems;
}
