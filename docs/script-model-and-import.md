# Script model, Import, and the readable-color rule

Read this before touching how Scripts are stored, imported, edited, or colored.

## Script model

`src/core/types.ts` defines it: `Script { name, lines: ScriptLine[] }`. A `ScriptLine` is a plain `string` (one unstyled run) or a `RichLine { heading?: 1-6, runs: Run[] }`; a `Run` is `{ text, bold?, italic?, color? }`. Color is the source color as `#rrggbb`, stored as-is (the readable-color rule is applied at render time, never on the Script). Fonts, sizes and spacing are never stored. Use `lineRuns`/`lineText`/`lineHeading` to read a line. The library stores `StoredScript { text, lines? }`: `text` is the plain form, `lines` the optional styled form; old text-only entries still load. `saveScript` takes optional `lines`. The Output renders runs as spans, headings bold at the Preset's size.

## The Run mode lock

The core enforces it, whatever sends the command (editor, API, shuttle, menu). In Run mode it rejects every command that changes what the Talent reads: editing the loaded Script (`editLine`, `setScriptLines`, `cutLines`, `colorRange`) and the whole library (`saveScript`, `newScript`, `duplicateScript`, `loadScript`, `renameScript`, `deleteScript`), because loading, renaming or deleting replaces or detaches the live Script, and any other library change is a step towards one. Unlocking allows only `liveFix`, one paragraph's text. `src/core/lock.test.ts` is the rule in executable form. Import (File menu and header) is therefore Edit mode only: the menu item is disabled in Run mode and main answers with a plain message if asked anyway. The Operator view sends unsaved typing before it asks for a mode change (the editor saves 300 ms after typing), and says so plainly if the core did not keep it.

## Import

`src/import/`: `importDocx(bytes, fileName): { ok: true, script } | { ok: false, message }` is a pure function (the second test seam). Tests build `.docx` fixtures in code with `src/import/fixtures.ts`. `importDocx` resolves bold, italic and color through character styles, paragraph styles, `basedOn` chains and document defaults, with direct run formatting winning. Legacy `.doc` (Word 97-2003) goes through `importDoc` in `src/import/doc.ts`: a minimal pure-JS reader (the `cfb` package for the container; piece table, character/paragraph formatting and style sheet parsed in-house), same result shape; `.doc` fixtures are built in code by `src/import/docFixtures.ts`. `importDocument(bytes, fileName)` dispatches by extension and is what main calls. `.doc` limits: Word 6/95 files and password-protected files are refused with a message; headings come from style names ("heading N", "Title") only, so text that is merely bold and large is not a heading; colors are the 16-color palette or 24-bit values (theme-based colors are lost); no list numbers, no text boxes, headers, footnotes or fields' results beyond their displayed text. Main wires the Operator view's "Import…" button (file picker for `.docx` and `.doc`, then `saveScript` with `lines`).

## Readable-color guard

`src/core/readableColor.ts`: `displayColor(source, background, themeColor)` is a pure function the Output calls on every render for each colored run, so a background change re-evaluates every color. It keeps the source color if its WCAG contrast ratio against the Output background is at least `MIN_CONTRAST` = 3 (the WCAG large-text bar; prompter text is far larger, and 3:1 rejects Word's stray black, near-black and dark blue/red on black while keeping red and green), else returns the theme text color. Missing or invalid colors (anything but `#rgb`/`#rrggbb`) also use the theme color. The Operator view does not show Script text in color, so only the Output uses it.

## The readable-color rule in the editor

The rule applies wherever the Script is drawn, not only on the Output. The editor (Edit mode) shows a color that is too hard to read on its own background (3:1 contrast, the same `displayColor` as the Output) in the editor's text color instead, so black text from Word is never shown black on the dark look. It is a view-only ProseMirror decoration (`src/operator/readableColors.ts`): the document, the saved Script and the copied HTML keep the source color. The editor reads its background and text colors from the current look's tokens (`--surface`, `--text`) and checks again when the look changes.
