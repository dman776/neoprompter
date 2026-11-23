import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { MAX_RECENT_COLORS } from '../core';
import { Button } from './ui/Button';
import { ColorIcon } from './ui/icons';

interface ColorToolProps {
  editor: Editor | null;
  /** True only in Edit mode: the button and the Alt+1 to Alt+0 shortcuts do nothing otherwise. */
  editable: boolean;
  /** The core's recent colors, newest first. */
  recentColors: readonly string[];
  /** A color was used: the Operator picked a swatch or finished choosing in the system picker. */
  onUse(color: string): void;
}

/** The shortcut for slot `i` (0 to 9): Alt+1 to Alt+9, then Alt+0 for the tenth. */
const slotKey = (i: number) => String((i + 1) % 10);

/** The Color button: a panel of the recent colors and an "Any color" system picker. */
export function ColorTool({ editor, editable, recentColors, onUse }: ColorToolProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(recentColors[0] ?? '#ffffff');
  const wrap = useRef<HTMLSpanElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const live = useRef({ editor, editable, recentColors, onUse });
  live.current = { editor, editable, recentColors, onUse };

  const paint = (color: string) => {
    live.current.editor?.chain().focus().setMark('color', { color }).run();
    setCurrent(color);
  };
  const use = (color: string) => {
    paint(color);
    live.current.onUse(color);
  };

  // Alt+1 to Alt+0 use the first to the tenth recent color, without leaving the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = /^Digit(\d)$/.exec(e.code);
      if (!e.altKey || !m || !live.current.editable) return;
      const color = live.current.recentColors[(Number(m[1]) + 9) % 10];
      if (!color) return;
      e.preventDefault();
      use(color);
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The panel closes on a click outside it, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // The picker colors the text while it is dragged (`input`), but the color only counts as used
  // when the Operator finishes choosing it (`change`), so the list is not flooded with shades.
  // React's onChange fires on `input`, so these are native listeners.
  useEffect(() => {
    const el = picker.current;
    if (!el) return;
    const onInput = () => paint(el.value);
    const onChange = () => use(el.value);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    return () => {
      el.removeEventListener('input', onInput);
      el.removeEventListener('change', onChange);
    };
  }, []);

  return (
    <span className="color-tool" ref={wrap}>
      <Button
        square
        variant="ghost"
        aria-label="Color"
        aria-haspopup="true"
        aria-expanded={open}
        lit={open}
        disabled={!editable}
        title="Text color"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        <ColorIcon />
        <i className="color-bar" style={{ background: current }} />
      </Button>
      <input
        ref={picker}
        className="color-input"
        type="color"
        aria-label="Any color picker"
        tabIndex={-1}
        defaultValue={current}
      />
      {open && (
        <div className="color-pop" role="dialog" aria-label="Recent colors">
          <h5>
            Recent colors<small>Alt+1 to Alt+0</small>
          </h5>
          <div className="swatch-grid">
            {Array.from({ length: MAX_RECENT_COLORS }, (_, i) => {
              const color = recentColors[i];
              return color ? (
                <button
                  key={i}
                  type="button"
                  className="swatch"
                  aria-label={`Color ${color}`}
                  title={`${color}  (Alt+${slotKey(i)})`}
                  style={{ background: color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    use(color);
                    setOpen(false);
                  }}
                />
              ) : (
                <i key={i} className="swatch-empty" />
              );
            })}
          </div>
          <button
            type="button"
            className="color-more"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              if (picker.current) {
                picker.current.value = current;
                picker.current.showPicker();
              }
            }}
          >
            <i style={{ background: current }} />
            Any color…
          </button>
        </div>
      )}
    </span>
  );
}
