# React and TipTap for the Operator windows

The Operator view, Preferences, and Virtual shuttle are built with React and TypeScript. The Script editor is TipTap (ProseMirror), whose schema maps onto our Script model (paragraphs, headings, bold, italic, palette color). Styling is a custom design system (CSS variables plus Radix primitives for accessible menus and dialogs), so the look is hand-crafted. The Output stays plain TypeScript, because fast, smooth scrolling wants nothing between the text and the screen, and the Live view reuses that same renderer.

Considered and rejected: the Fluent UI component library, which matches Word and Outlook closely but gives less control over a distinctive dark-first look; and no framework, which does not scale to a rich-text editor, two modes, and several windows.
