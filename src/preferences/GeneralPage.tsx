import { useEffect, useState } from 'react';
import type { OpenInMode, Theme } from '../core';
import type { WatchedFolderView } from '../watched-folder';
import { Button } from '../operator/ui/Button';
import { Row } from './controls';
import type { PageProps } from './categories';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const OPEN_IN: { value: OpenInMode; label: string }[] = [
  { value: 'last', label: 'The mode I last used' },
  { value: 'edit', label: 'Edit mode' },
  { value: 'run', label: 'Run mode' },
];

/** How often to look at the Watched folder setting again (an Import may have happened). */
const POLL_MS = 1500;

function WatchedFolderRow({ bridge }: Pick<PageProps, 'bridge'>) {
  const [view, setView] = useState<WatchedFolderView | null>(null);
  useEffect(() => {
    let live = true;
    // Look again now and then: an Import can happen while this window is open.
    const look = () => void bridge.getWatchedFolder().then((v) => live && setView(v));
    look();
    const timer = setInterval(look, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [bridge]);
  if (!view) return null;
  return (
    <Row
      title="Watched folder"
      help="Word files dropped into this folder are imported as Scripts. Off until you choose one."
    >
      <span className="pf-value pf-path" aria-label="Watched folder">
        {view.path ?? 'Off'}
      </span>
      <div className="pf-inline">
        <Button onClick={() => void bridge.chooseWatchedFolder().then(setView)}>Choose…</Button>
        {view.path && (
          <Button onClick={() => void bridge.clearWatchedFolder().then(setView)}>Clear</Button>
        )}
      </div>
      {view.missing && (
        <small role="status">
          This folder is not there any more, so nothing is imported. Choose another one.
        </small>
      )}
      {view.lastResult && <small data-testid="watched-folder-result">{view.lastResult}</small>}
    </Row>
  );
}

export function GeneralPage({ state, bridge, dispatch }: PageProps) {
  return (
    <>
      <Row title="Theme" help="The look of the Operator view. The Output has its own colors.">
        <select
          aria-label="Theme"
          value={state.theme}
          onChange={(e) => dispatch({ type: 'setTheme', theme: e.target.value as Theme })}
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Row>
      <Row title="Open in" help="The mode the app starts in.">
        <select
          aria-label="Open in"
          value={state.openInMode}
          onChange={(e) =>
            dispatch({ type: 'setOpenInMode', openIn: e.target.value as OpenInMode })
          }
        >
          {OPEN_IN.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>
      <WatchedFolderRow bridge={bridge} />
    </>
  );
}
