import { useRef, type KeyboardEvent } from 'react';

export interface TabItem {
  id: string;
  label: string;
}

/** The id of a tab button, which its panel names in `aria-labelledby`. */
export const tabId = (id: string) => `pf-tab-${id}`;
export const panelId = (id: string) => `pf-panel-${id}`;

/**
 * An accessible tab strip: one tab is in the tab order, Left/Right move between tabs (wrapping)
 * and Home/End jump to the first and last. Choosing a tab shows its panel at once.
 */
export function TabStrip({
  label,
  tabs,
  selected,
  onSelect,
}: {
  label: string;
  tabs: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const go = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]!;
    onSelect(next.id);
    buttons.current[next.id]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const target =
      e.key === 'ArrowRight'
        ? index + 1
        : e.key === 'ArrowLeft'
          ? index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : null;
    if (target === null) return;
    e.preventDefault();
    go(target);
  };

  return (
    <div className="pf-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            buttons.current[t.id] = el;
          }}
          id={tabId(t.id)}
          type="button"
          role="tab"
          aria-selected={t.id === selected}
          aria-controls={panelId(t.id)}
          tabIndex={t.id === selected ? 0 : -1}
          onClick={() => onSelect(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
