# Scroll model

Read this before touching position, speed, Screen jumps, the end-of-Script stop, or the Progress bar.

A Script line is a paragraph and the Output wraps it, so position, speed (lines per second), the viewport, Screen jumps, the end-of-Script stop and Progress are all in visual lines. The Output measures each Script line's height in visual lines after every layout-affecting change and dispatches `setLineExtents { extents, revision }` (like `setViewport`); the core keeps `extents` (1 per line until measured), clamps to `sum(extents) - viewportLines`, and converts the reading position through (Script line + fraction) on edits and re-measures so it stays on the same text. A measurement for an old `scriptRevision` is ignored. `scriptRevision` bumps on any Script content change (edit, cut, color, load); the Output re-renders its text DOM on it, not on the Script name.
