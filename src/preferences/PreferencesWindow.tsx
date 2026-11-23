import { useState } from 'react';
import { useCoreState, type CoreBridge } from '../operator/useCoreState';
import { CATEGORIES } from './categories';

/** The Preferences window: category navigation and the chosen category's settings. */
export function Preferences({ bridge }: { bridge: CoreBridge }) {
  const state = useCoreState(bridge);
  const [selected, setSelected] = useState(CATEGORIES[0]!.id);
  const category = CATEGORIES.find((c) => c.id === selected)!;
  const Page = category.Page;

  return (
    <div className="pf-shell">
      <nav aria-label="Preferences categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            data-selected={c.id === selected ? 'true' : undefined}
            aria-current={c.id === selected ? 'page' : undefined}
            onClick={() => setSelected(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <main>
        <h2>{category.label}</h2>
        <p className="pf-sub">{category.subtitle}</p>
        {Page ? (
          state && <Page state={state} dispatch={bridge.dispatch} />
        ) : (
          <p className="pf-placeholder">Coming soon.</p>
        )}
      </main>
    </div>
  );
}
