import { pickLatest, type ReleaseInfo } from '../updates';

/** The one network request the app makes (ADR 0004): this repo's published releases. */
export const RELEASES_URL = 'https://api.github.com/repos/dman776/neoprompter/releases?per_page=20';

/** The newest release `currentVersion` should hear about; rejects when GitHub cannot be reached. */
export async function fetchLatestRelease(currentVersion: string): Promise<ReleaseInfo | null> {
  const response = await fetch(process.env.NEOPROMPTER_UPDATE_STUB_URL ?? RELEASES_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return pickLatest(await response.json(), currentVersion);
}
