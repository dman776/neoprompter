import { useEffect, useState } from 'react';
import type { OpenInMode, Theme } from '../core';
import type { WatchedFolderView } from '../watched-folder';
import type { UpdateView } from '../updates';
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
      help="Word (.doc, .docx), text (.txt) and PDF files dropped into this folder are imported as Scripts. Off until you choose one."
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

function UpdateRow({ bridge }: Pick<PageProps, 'bridge'>) {
  const [view, setView] = useState<UpdateView | null>(null);
  useEffect(() => {
    let live = true;
    bridge.onUpdateView?.((v) => live && setView(v));
    void bridge.getUpdateView?.().then((v) => live && setView((current) => current ?? v));
    return () => {
      live = false;
    };
  }, [bridge]);
  if (!view) return null;
  const status = view.checking
    ? 'Checking…'
    : view.lastCheck === 'failed'
      ? 'Could not check for a newer version.'
      : view.available
        ? `Version ${view.available.version} is available.`
        : view.lastCheck === 'ok'
          ? 'You have the latest version.'
          : null;
  return (
    <Row
      title="Updates"
      help="Checks GitHub for a newer version. It only tells you; you install it yourself. Turn it off to keep the app fully offline."
    >
      <label className="pf-inline">
        <input
          type="checkbox"
          checked={view.autoCheck}
          onChange={(e) => void bridge.setAutoUpdateCheck(e.target.checked).then(setView)}
        />
        Check for updates at launch
      </label>
      <div className="pf-inline">
        <Button disabled={view.checking} onClick={() => void bridge.checkForUpdate().then(setView)}>
          Check now
        </Button>
        {view.available && <Button onClick={() => bridge.openUpdatePage?.()}>View release</Button>}
      </div>
      {status && <small data-testid="update-status">{status}</small>}
    </Row>
  );
}

function VersionLine({ bridge }: Pick<PageProps, 'bridge'>) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void bridge.getVersion().then((v) => live && setVersion(v));
    return () => {
      live = false;
    };
  }, [bridge]);
  if (!version) return null;
  return (
    <small className="pf-version" data-testid="app-version">
      NeoPrompter version {version}
    </small>
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
      <UpdateRow bridge={bridge} />
      <VersionLine bridge={bridge} />
    </>
  );
}
