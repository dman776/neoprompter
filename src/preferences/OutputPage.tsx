import { useEffect, useState } from 'react';
import { Switch } from '../operator/ui/Switch';
import { BLOCKED_TEXT } from '../operator/Header';
import type { OutputWindowView } from '../output-window';
import { Row } from './controls';
import type { PageProps } from './categories';

/** How often to look at the displays again (a monitor may be plugged in or removed). */
const POLL_MS = 1500;

const MISSING_TEXT =
  'The monitor chosen for this display setup is not connected, so the Output stays closed. Reconnect it or choose another monitor.';

export function OutputPage({ bridge }: PageProps) {
  const [view, setView] = useState<OutputWindowView | null>(null);
  useEffect(() => {
    let live = true;
    const look = () => void bridge.getOutputView().then((v) => live && setView(v));
    look();
    const timer = setInterval(look, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [bridge]);
  if (!view) return null;

  const chosenListed = view.monitors.some((m) => m.id === view.chosenMonitorId);
  const missing =
    view.missingMonitorId !== null || (view.chosenMonitorId !== null && !chosenListed);
  const notice = view.blocked ? BLOCKED_TEXT[view.blocked] : missing ? MISSING_TEXT : null;

  return (
    <>
      <Row title="Monitor" help="Where the Output appears when it is switched On.">
        <select
          aria-label="Monitor"
          value={view.chosenMonitorId ?? ''}
          onChange={(e) => {
            if (e.target.value) void bridge.chooseOutputMonitor(e.target.value).then(setView);
          }}
        >
          <option value="">(choose a monitor)</option>
          {view.monitors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.isOperatorDisplay ? ' (this screen)' : ''}
            </option>
          ))}
          {view.chosenMonitorId && !chosenListed && (
            <option value={view.chosenMonitorId}>(not connected)</option>
          )}
        </select>
      </Row>
      {notice && (
        <p className="pf-notice" role="status">
          {notice}
        </p>
      )}
      <Row
        title="Windowed Output"
        help="A test option: show the Output in an ordinary window instead of a monitor."
      >
        <Switch
          compact
          label="Windowed Output"
          checked={view.windowed}
          onCheckedChange={(windowed) => void bridge.setWindowedOutput(windowed).then(setView)}
        />
      </Row>
    </>
  );
}
