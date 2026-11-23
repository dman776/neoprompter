import type { ApiView } from '../api';
import type { CoreState } from '../core';
import type { OutputWindowView } from '../output-window';
import { Panel } from './ui/Panel';

type Tone = 'ok' | 'off' | 'warn';

function monitorText(view: OutputWindowView | null): { text: string; tone: Tone } {
  if (!view) return { text: '...', tone: 'off' };
  if (view.windowed) return { text: 'Windowed Output', tone: 'ok' };
  const chosen = view.monitors.find((m) => m.id === view.chosenMonitorId);
  if (chosen) return { text: chosen.label, tone: 'ok' };
  if (view.missingMonitorId) return { text: 'Not connected', tone: 'warn' };
  return { text: 'None chosen', tone: 'off' };
}

function producerText(api: ApiView | null): { text: string; tone: Tone } {
  if (!api) return { text: '...', tone: 'off' };
  if (api.error) return { text: api.error, tone: 'warn' };
  return api.running ? { text: 'Listening', tone: 'ok' } : { text: 'Off', tone: 'off' };
}

/** The whole setup at a glance: Output, monitor, ShuttleXPress, Producer page and Preset. */
export function StatusPanel({
  state,
  outputView,
  apiView,
}: {
  state: CoreState;
  outputView: OutputWindowView | null;
  apiView: ApiView | null;
}) {
  const monitor = monitorText(outputView);
  const producer = producerText(apiView);
  // Nothing yet reports the ShuttleXPress to this window, so it is shown as not connected.
  const rows: Array<{ id: string; label: string; text: string; tone: Tone }> = [
    {
      id: 'output',
      label: 'Output',
      text: state.outputOn ? 'On' : 'Off',
      tone: state.outputOn ? 'ok' : 'off',
    },
    { id: 'monitor', label: 'Monitor', ...monitor },
    { id: 'shuttle', label: 'ShuttleXPress', text: 'Not connected', tone: 'off' },
    { id: 'producer', label: 'Producer page', ...producer },
    { id: 'preset', label: 'Preset', text: state.activePreset ?? 'None', tone: 'off' },
  ];
  return (
    <Panel title="Status" className="run-status">
      <div data-testid="status-panel" className="status-rows">
        {rows.map((row) => (
          <div key={row.id} data-status={row.id}>
            <span>{row.label}</span>
            <b>
              {row.id !== 'preset' && <em data-tone={row.tone} />}
              {row.text}
            </b>
          </div>
        ))}
      </div>
    </Panel>
  );
}
