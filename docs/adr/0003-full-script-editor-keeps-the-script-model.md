# A full Script editor that keeps the Script model

v1 shipped a minimal editor and listed a full authoring tool as out of scope. The UI rebuild reverses that: Edit mode has a full editor with undo and redo, find and replace, clean paste from Word, headings, bold, italic, palette colors, and a word count with a read-time estimate. It still never stores fonts or sizes. The theme and Preset decide those, and that rule is what keeps imported text from arriving unreadable. A free-form word processor was rejected because it would bring back the invisible-text risk the readable-color guard exists to stop.

In Run mode the Script is locked against typing, enforced by the core. A deliberate unlock allows a single-paragraph live fix, so nothing the Talent sees changes without an Operator action.
