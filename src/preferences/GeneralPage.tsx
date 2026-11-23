import type { OpenInMode, Theme } from '../core';
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

export function GeneralPage({ state, dispatch }: PageProps) {
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
    </>
  );
}
