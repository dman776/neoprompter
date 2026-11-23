import type { Mode, Theme } from '../core';
import type { OutputBlocked } from '../output-window';
import { Segment } from './ui/Segment';
import { Switch } from './ui/Switch';
import { EditIcon, ImportIcon, RunIcon, SidebarIcon, ThemeIcon } from './ui/icons';

interface HeaderProps {
  scriptName: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  outputOn: boolean;
  onOutputChange: (on: boolean) => void;
  /** Set while the Output is On but cannot show. */
  outputBlocked: OutputBlocked | null;
  /** Whether the right-hand column is collapsed (the button is lit then). */
  columnCollapsed: boolean;
  onToggleColumn: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  /** Edit mode's Import button; absent where Import does not belong. */
  onImport?: () => void;
  /** Edit mode's Update notice: a newer published version; absent when there is none to offer. */
  update?: { version: string; current: string; onView: () => void; onSkip: () => void };
}

export const BLOCKED_TEXT: Record<OutputBlocked, string> = {
  'missing-monitor': 'The Output monitor is not connected, so the Output stays closed.',
  'no-monitor': 'No monitor is chosen for the Output, so it stays closed.',
  'operator-display': 'The Output cannot cover the Operator view, so it stays closed.',
};

/** Name and current Script on the left, the mode switch in the middle, the Output switch right. */
export function Header({
  scriptName,
  mode,
  onModeChange,
  outputOn,
  onOutputChange,
  outputBlocked,
  columnCollapsed,
  onToggleColumn,
  theme,
  onToggleTheme,
  onImport,
  update,
}: HeaderProps) {
  return (
    <header className="shell-header">
      <div className="brand">
        <i aria-hidden="true" />
        Neoprompter
        <span>{scriptName}</span>
      </div>
      <Segment
        label="Mode"
        value={mode}
        onValueChange={onModeChange}
        options={[
          { value: 'edit', label: 'Edit', icon: <EditIcon /> },
          { value: 'run', label: 'Run', icon: <RunIcon /> },
        ]}
      />
      <div className="header-end">
        {outputBlocked && (
          <span className="output-note" role="alert">
            {BLOCKED_TEXT[outputBlocked]}
          </span>
        )}
        {update && (
          <span className="update-pill" data-testid="update-notice" role="status">
            <button
              type="button"
              className="update-pill-view"
              title={`NeoPrompter ${update.version} is available (you have ${update.current})`}
              onClick={update.onView}
            >
              Update {update.version} available
            </button>
            <button
              type="button"
              className="update-pill-skip"
              aria-label="Skip this version"
              title="Skip this version"
              onClick={update.onSkip}
            >
              ×
            </button>
          </span>
        )}
        {onImport && (
          <button type="button" className="header-import" data-testid="import" onClick={onImport}>
            <ImportIcon />
            Import
          </button>
        )}
        <button
          type="button"
          className="header-sq"
          data-testid="toggle-theme"
          data-lit={theme === 'light' ? 'true' : undefined}
          aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          onClick={onToggleTheme}
        >
          <ThemeIcon />
        </button>
        <button
          type="button"
          className="header-sq"
          data-testid="toggle-column"
          data-lit={columnCollapsed ? 'true' : undefined}
          aria-pressed={columnCollapsed}
          aria-label={columnCollapsed ? 'Show right column' : 'Collapse right column'}
          title={columnCollapsed ? 'Show right column' : 'Collapse right column'}
          onClick={onToggleColumn}
        >
          <SidebarIcon />
        </button>
        <Switch checked={outputOn} onCheckedChange={onOutputChange} label="Output" />
      </div>
    </header>
  );
}
