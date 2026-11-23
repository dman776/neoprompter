import { describe, expect, it } from 'vitest';
import { checkReleaseTag } from './releaseTag.mjs';

describe('checkReleaseTag', () => {
  it('accepts a tag that is v plus the package version', () => {
    expect(checkReleaseTag('v0.2.0', '0.2.0')).toEqual({ ok: true, prerelease: false });
  });

  it('marks a hyphenated version as a pre-release', () => {
    expect(checkReleaseTag('v0.3.0-beta.1', '0.3.0-beta.1')).toEqual({
      ok: true,
      prerelease: true,
    });
    expect(checkReleaseTag('v1.0.0-rc.2', '1.0.0-rc.2').prerelease).toBe(true);
  });

  it('refuses a tag that does not match the package version, and says how to fix it', () => {
    const result = checkReleaseTag('v0.2.0', '0.1.0');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('v0.2.0');
    expect(result.message).toContain('0.1.0');
    expect(result.message).toMatch(/npm version/);
  });

  it('refuses a pre-release tag on a plain version, and the other way round', () => {
    expect(checkReleaseTag('v0.2.0-beta.1', '0.2.0').ok).toBe(false);
    expect(checkReleaseTag('v0.2.0', '0.2.0-beta.1').ok).toBe(false);
  });

  it('refuses a tag that is not v and a version', () => {
    for (const tag of ['0.2.0', 'V0.2.0', 'v0.2', 'v1.2.3.4', 'vfoo', 'v', '']) {
      const result = checkReleaseTag(tag, '0.2.0');
      expect(result.ok, tag).toBe(false);
      expect(result.message, tag).toMatch(/v<major>\.<minor>\.<patch>|vX\.Y\.Z/);
    }
  });

  it('refuses a package version that is not a version', () => {
    expect(checkReleaseTag('v1.0.0', 'latest').ok).toBe(false);
    expect(checkReleaseTag('v1.0.0', undefined).ok).toBe(false);
  });
});
