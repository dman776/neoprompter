import { Mark } from '@tiptap/core';

/**
 * Text color as a mark. The only color the editor holds is `#rrggbb`; it is stored as-is and the
 * readable-color rule is applied when the Output renders it. Nothing here touches fonts or sizes.
 */
export const ColorMark = Mark.create({
  name: 'color',
  addAttributes() {
    return { color: { default: null } };
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { style: `color: ${HTMLAttributes.color}` }, 0];
  },
});
