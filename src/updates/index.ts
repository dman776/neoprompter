// Headless: the Update check. It only ever notifies; the Operator installs by hand (ADR 0004).
// The release lookup, the clock and the saved settings are injected.

/** What is kept between runs. */
export interface UpdateSettings {
  /** Look for a newer version at launch, at most once a day. */
  autoCheck: boolean;
  /** When the last check ran (ms since the epoch); null before the first. */
  lastChecked: number | null;
  /** A version the Operator chose to hear nothing more about. */
  skipped: string | null;
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  autoCheck: true,
  lastChecked: null,
  skipped: null,
};

export interface UpdateStore {
  load(): UpdateSettings;
  save(settings: UpdateSettings): void;
}

/** A published release, as the release lookup reports it. */
export interface ReleaseInfo {
  /** The tag without its leading `v`, for example `0.3.0` or `0.3.0-beta.1`. */
  version: string;
  /** The release page, opened in the system browser. */
  url: string;
  prerelease: boolean;
}

/** What the notice and Preferences show. */
export interface UpdateView {
  /** The running version. */
  current: string;
  autoCheck: boolean;
  /** A newer published version the Operator has not skipped; null when there is none. */
  available: { version: string; url: string } | null;
  /** How the most recent check went; null before any check this run. */
  lastCheck: 'ok' | 'failed' | null;
  /** True while a check is running. */
  checking: boolean;
}

/** The longest an automatic check waits after the last one. */
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface ParsedVersion {
  core: [number, number, number];
  pre: string[];
}

function parseVersion(text: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(text.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.') : [],
  };
}

/** Semver order: negative when `a` is older than `b`, null when either is not a version. */
export function compareVersions(a: string, b: string): number | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) {
    if (x.core[i] !== y.core[i]) return x.core[i]! < y.core[i]! ? -1 : 1;
  }
  // A release outranks its own pre-releases.
  if (x.pre.length === 0 || y.pre.length === 0) {
    return x.pre.length === y.pre.length ? 0 : x.pre.length === 0 ? 1 : -1;
  }
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) < Number(q) ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** True for a pre-release version such as `0.3.0-beta.1`. */
export function isPrerelease(version: string): boolean {
  return (parseVersion(version)?.pre.length ?? 0) > 0;
}

/**
 * The newest release the running version should hear about. `releases` is the raw list from the
 * GitHub releases API; drafts, unreadable tags and (for a stable build) pre-releases are ignored.
 */
export function pickLatest(releases: unknown, current: string): ReleaseInfo | null {
  if (!Array.isArray(releases)) return null;
  const includePre = isPrerelease(current);
  let best: ReleaseInfo | null = null;
  for (const r of releases) {
    if (typeof r !== 'object' || r === null) continue;
    const { tag_name, html_url, draft, prerelease } = r as Record<string, unknown>;
    if (draft === true || typeof tag_name !== 'string' || typeof html_url !== 'string') continue;
    if (!/^https:\/\/github\.com\//.test(html_url)) continue;
    const version = tag_name.replace(/^v/, '');
    if (parseVersion(version) === null) continue;
    const pre = prerelease === true || isPrerelease(version);
    if (pre && !includePre) continue;
    if (!best || (compareVersions(version, best.version) ?? 0) > 0) {
      best = { version, url: html_url, prerelease: pre };
    }
  }
  return best;
}

/** Turns what a settings file held into settings, or null when it is not any. */
export function normalizeUpdateSettings(raw: unknown): UpdateSettings | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    autoCheck: typeof r.autoCheck === 'boolean' ? r.autoCheck : DEFAULT_UPDATE_SETTINGS.autoCheck,
    lastChecked: typeof r.lastChecked === 'number' ? r.lastChecked : null,
    skipped: typeof r.skipped === 'string' ? r.skipped : null,
  };
}

export interface UpdateService {
  getView(): UpdateView;
  /** A check the Operator asked for: always runs, and reports a failure in the view. */
  checkNow(): Promise<UpdateView>;
  /** The check at launch: runs only when switched on and a day has passed; a failure is silent. */
  checkAtLaunch(): Promise<UpdateView>;
  setAutoCheck(on: boolean): UpdateView;
  /** Hears nothing more about the version now on offer, until a newer one is published. */
  skipAvailable(): UpdateView;
  /** Called whenever the view changes. */
  subscribe(listener: (view: UpdateView) => void): void;
}

export function createUpdateService(deps: {
  currentVersion: string;
  store: UpdateStore;
  /** The newest release this version should hear about; rejects when it cannot be reached. */
  fetchLatest(): Promise<ReleaseInfo | null>;
  now(): number;
}): UpdateService {
  let settings = deps.store.load();
  let latest: ReleaseInfo | null = null;
  let lastCheck: UpdateView['lastCheck'] = null;
  let checking = false;
  const listeners: Array<(view: UpdateView) => void> = [];

  const getView = (): UpdateView => {
    const newer =
      latest !== null &&
      (compareVersions(latest.version, deps.currentVersion) ?? 0) > 0 &&
      latest.version !== settings.skipped;
    return {
      current: deps.currentVersion,
      autoCheck: settings.autoCheck,
      available: newer ? { version: latest!.version, url: latest!.url } : null,
      lastCheck,
      checking,
    };
  };
  const changed = () => {
    const view = getView();
    listeners.forEach((l) => l(view));
    return view;
  };
  const update = (next: Partial<UpdateSettings>) => {
    settings = { ...settings, ...next };
    deps.store.save(settings);
  };

  async function run(): Promise<UpdateView> {
    if (checking) return getView();
    checking = true;
    changed();
    try {
      latest = await deps.fetchLatest();
      lastCheck = 'ok';
    } catch {
      lastCheck = 'failed';
    }
    checking = false;
    update({ lastChecked: deps.now() });
    return changed();
  }

  return {
    getView,
    checkNow: run,
    async checkAtLaunch() {
      const due =
        settings.lastChecked === null ||
        deps.now() - settings.lastChecked >= AUTO_CHECK_INTERVAL_MS;
      if (!settings.autoCheck || !due) return getView();
      await run();
      // An automatic check never reports a failure.
      lastCheck = null;
      return changed();
    },
    setAutoCheck(on) {
      update({ autoCheck: on });
      return changed();
    },
    skipAvailable() {
      const offered = getView().available;
      if (offered) update({ skipped: offered.version });
      return changed();
    },
    subscribe: (l) => listeners.push(l),
  };
}
