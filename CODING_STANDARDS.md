# Coding standards

The reviewer reads this file; implementers need not. It holds judgement calls only. `npm run check` already enforces the mechanical rules (glossary terms in user-facing text, no ticket numbers in `src`, a headless `src/core`, types, tests), so none repeat here.

## The Operator stays in control

Nothing the Talent sees changes without an Operator action. A new input, endpoint, startup path, or background task must not start scrolling, change the Output's text, or reveal a blank Output by itself. Surfaces for other people (the Producer page, the Companion API) carry Notifications and status only.

_Why:_ this runs live, in front of a congregation. Restore starts paused, the Output stays blank until confirmed, and the API has no transport control for this reason.

## Decisions live in the core; renderers render

A renderer draws core state and reports what only it can measure (viewport height, text extents). Clamping, position math, and any rule about what happens next belong in `src/core/`, where a fake clock can test them.

_Why:_ scrolling logic that leaked into the Output was invisible to the core tests, and it hid two real defects.

## Inject what touches the world

Modules outside the renderers take their clock, stores, display list, window host, and file access as arguments, and their tests use in-memory fakes. A new file-backed store uses the shared helper in `src/main/jsonFile.ts` rather than a fresh read/parse/write.

_Why:_ every module can then be tested without Electron, the disk, or real time.

## Test behavior through the seam

A test sends commands to the core, calls the import function, or makes an HTTP request, and asserts on what comes out. It does not reach into internals. Every behavioral fix starts with a test that fails on the bug.

## Name things in the glossary's words

A new user-facing concept gets an entry in `GLOSSARY.md` in the same change, and the UI and code use that word. The check catches forbidden words; only a reviewer notices a missing term or a synonym nobody defined.

## Say what was run

A change to a renderer says, in its description, whether the app was run and what was looked at (`docs/run-and-test.md`). A visible-behavior change that was only unit-tested is reported as unverified.

## Smells

The reviewer also applies a baseline of Fowler code smells as judgement calls. The rules above override it where they differ.
