// The rule a release tag has to meet, kept apart from the command line so it can be tested.
// A tag must be `v` plus the version in package.json (the installers are named from that
// version), so a tag pushed on a commit nobody bumped never publishes mislabelled installers.
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** @returns {{ ok: true, prerelease: boolean } | { ok: false, message: string }} */
export function checkReleaseTag(tag, version) {
  if (typeof tag !== 'string' || !tag.startsWith('v') || !VERSION.test(tag.slice(1))) {
    return {
      ok: false,
      message: `"${tag}" is not a release tag. Use v<major>.<minor>.<patch>, for example v0.2.0 or v0.3.0-beta.1.`,
    };
  }
  if (typeof version !== 'string' || !VERSION.test(version)) {
    return { ok: false, message: `package.json has no usable version ("${version}").` };
  }
  if (tag.slice(1) !== version) {
    return {
      ok: false,
      message:
        `Tag ${tag} does not match package.json, which says ${version}. ` +
        `Run "npm version ${tag.slice(1)} --no-git-tag-version", commit it, then delete and re-push the tag.`,
    };
  }
  return { ok: true, prerelease: version.includes('-') };
}
