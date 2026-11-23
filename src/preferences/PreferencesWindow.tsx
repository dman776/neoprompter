import { useEffect, useState } from 'react';
import { useCoreState, type PreferencesBridge } from '../operator/useCoreState';
import { CATEGORIES } from './categories';
import { panelId, tabId, TabStrip } from './TabStrip';

/** The Preferences window: category navigation and the chosen category's settings. */
export function Preferences({ bridge }: { bridge: PreferencesBridge }) {
  const state = useCoreState(bridge);
  const theme = state?.theme;
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [selected, setSelected] = useState(CATEGORIES[0]!.id);
  // The tab last chosen in each category, kept while the window is open.
  const [chosenTabs, setChosenTabs] = useState<Record<string, string>>({});
  const category = CATEGORIES.find((c) => c.id === selected)!;
  const tabs = category.tabs;
  const tab = tabs && (tabs.find((t) => t.id === chosenTabs[category.id]) ?? tabs[0]!);
  const Page = tab ? tab.Page : category.Page;
  const Pinned = category.Pinned;

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
        <header className="pf-head">
          <h2>{category.label}</h2>
          <p className="pf-sub">{category.subtitle}</p>
          {Pinned && state && <Pinned state={state} />}
          {tabs && tab && (
            <TabStrip
              label={`${category.label} settings`}
              tabs={tabs}
              selected={tab.id}
              onSelect={(id) => setChosenTabs((all) => ({ ...all, [category.id]: id }))}
            />
          )}
        </header>
        <div
          className="pf-panel"
          {...(tab
            ? { role: 'tabpanel', id: panelId(tab.id), 'aria-labelledby': tabId(tab.id) }
            : {})}
        >
          {Page ? (
            state && <Page state={state} dispatch={bridge.dispatch} bridge={bridge} />
          ) : (
            <p className="pf-placeholder">Coming soon.</p>
          )}
        </div>
      </main>
    </div>
  );
}
