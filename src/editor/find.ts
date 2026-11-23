/** Offsets of every non-overlapping match of `query` in `text`. The query is plain text. */
export function findInText(text: string, query: string, matchCase: boolean): number[] {
  if (query === '') return [];
  const hay = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  const found: number[] = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    found.push(at);
  }
  return found;
}
