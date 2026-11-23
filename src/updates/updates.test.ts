import { describe, expect, it } from 'vitest';
import {
  AUTO_CHECK_INTERVAL_MS,
  DEFAULT_UPDATE_SETTINGS,
  compareVersions,
  createUpdateService,
  normalizeUpdateSettings,
  pickLatest,
  type ReleaseInfo,
  type UpdateSettings,
} from './index';

const rel = (version: string, extra = {}) => ({
  tag_name: `v${version}`,
  html_url: `https://github.com/dman776/neoprompter/releases/tag/v${version}`,
  draft: false,
  prerelease: false,
  ...extra,
});

describe('compareVersions', () => {
  it('orders by number, not text', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0);
    expect(compareVersions('1.0.0', '0.99.9')).toBe(1);
  });
  it('puts a release after its own pre-releases', () => {
    expect(compareVersions('0.3.0-beta.1', '0.3.0')).toBe(-1);
    expect(compareVersions('0.3.0-beta.2', '0.3.0-beta.10')).toBe(-1);
    expect(compareVersions('0.3.0-alpha', '0.3.0-beta')).toBe(-1);
  });
  it('gives null for something that is not a version', () => {
    expect(compareVersions('latest', '0.2.0')).toBeNull();
  });
});

describe('pickLatest', () => {
  it('ignores drafts and pre-releases for a stable build', () => {
    const list = [
      rel('0.4.0', { draft: true }),
      rel('0.3.0-beta.1', { prerelease: true }),
      rel('0.2.5'),
      rel('0.2.0'),
    ];
    expect(pickLatest(list, '0.2.0')?.version).toBe('0.2.5');
  });
  it('offers a beta build newer betas and stable releases', () => {
    const list = [rel('0.3.0-beta.2', { prerelease: true }), rel('0.2.0')];
    expect(pickLatest(list, '0.3.0-beta.1')?.version).toBe('0.3.0-beta.2');
  });
  it('ignores junk', () => {
    expect(pickLatest('nope', '0.2.0')).toBeNull();
    expect(
      pickLatest([{ tag_name: 'x' }, null, rel('0.3.0', { html_url: 'http://evil' })], '0.2.0'),
    ).toBeNull();
  });
});

describe('normalizeUpdateSettings', () => {
  it('fills in defaults and rejects non-objects', () => {
    expect(normalizeUpdateSettings({})).toEqual(DEFAULT_UPDATE_SETTINGS);
    expect(normalizeUpdateSettings(7)).toBeNull();
    expect(normalizeUpdateSettings({ autoCheck: false, skipped: '0.3.0' })).toEqual({
      autoCheck: false,
      lastChecked: null,
      skipped: '0.3.0',
    });
  });
});

function setup(
  options: {
    saved?: Partial<UpdateSettings>;
    current?: string;
    latest?: ReleaseInfo | 'fail';
  } = {},
) {
  let now = 1_000_000_000_000;
  let saved: UpdateSettings = { ...DEFAULT_UPDATE_SETTINGS, ...options.saved };
  let latest = options.latest ?? {
    version: '0.3.0',
    url: 'https://github.com/x/y',
    prerelease: false,
  };
  let fetches = 0;
  const service = createUpdateService({
    currentVersion: options.current ?? '0.2.0',
    store: { load: () => saved, save: (s) => (saved = s) },
    fetchLatest: async () => {
      fetches++;
      if (latest === 'fail') throw new Error('offline');
      return latest;
    },
    now: () => now,
  });
  return {
    service,
    saved: () => saved,
    fetches: () => fetches,
    advance: (ms: number) => (now += ms),
    setLatest: (l: ReleaseInfo | 'fail') => (latest = l),
  };
}

describe('update service', () => {
  it('offers a newer version and nothing for the same one', async () => {
    const t = setup();
    expect((await t.service.checkNow()).available?.version).toBe('0.3.0');
    const same = setup({
      latest: { version: '0.2.0', url: 'https://github.com/x/y', prerelease: false },
    });
    expect((await same.service.checkNow()).available).toBeNull();
  });

  it('checks at launch only when switched on and a day has passed', async () => {
    const t = setup();
    await t.service.checkAtLaunch();
    expect(t.fetches()).toBe(1);
    await t.service.checkAtLaunch();
    expect(t.fetches()).toBe(1);
    t.advance(AUTO_CHECK_INTERVAL_MS);
    await t.service.checkAtLaunch();
    expect(t.fetches()).toBe(2);
    const off = setup({ saved: { autoCheck: false } });
    await off.service.checkAtLaunch();
    expect(off.fetches()).toBe(0);
  });

  it('stays silent when the launch check fails, but says so on a manual check', async () => {
    const t = setup({ latest: 'fail' });
    expect((await t.service.checkAtLaunch()).lastCheck).toBeNull();
    expect((await t.service.checkNow()).lastCheck).toBe('failed');
  });

  it('skips a version until a newer one is published', async () => {
    const t = setup();
    await t.service.checkNow();
    expect(t.service.skipAvailable().available).toBeNull();
    expect(t.saved().skipped).toBe('0.3.0');
    expect((await t.service.checkNow()).available).toBeNull();
    t.setLatest({ version: '0.3.1', url: 'https://github.com/x/y', prerelease: false });
    expect((await t.service.checkNow()).available?.version).toBe('0.3.1');
  });

  it('saves the switch and tells subscribers', () => {
    const t = setup();
    const seen: boolean[] = [];
    t.service.subscribe((v) => seen.push(v.autoCheck));
    t.service.setAutoCheck(false);
    expect(t.saved().autoCheck).toBe(false);
    expect(seen).toEqual([false]);
  });
});
