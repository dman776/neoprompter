import { useEffect, useState } from 'react';
import { ACTION_LABELS, BUTTON_IDS, type ButtonMappingView } from '../input';
import { Row } from './controls';
import type { PageProps } from './categories';

/**
 * The ShuttleXPress button mapping. The main process owns it (the Virtual shuttle and the real
 * device read the same one), so a change is sent there and the page follows what comes back.
 */
export function ControlsPage({ bridge }: PageProps) {
  const [view, setView] = useState<ButtonMappingView | null>(null);
  useEffect(() => {
    let live = true;
    bridge.onButtonMapping((v) => live && setView(v));
    void bridge.getButtonMapping().then((v) => live && setView((current) => current ?? v));
    return () => {
      live = false;
    };
  }, [bridge]);
  if (!view) return null;

  return (
    <>
      {BUTTON_IDS.map((id) => (
        <Row key={id} title={`Button ${id}`}>
          <select
            aria-label={`Button ${id}`}
            value={view.mapping[id]}
            onChange={(e) => void bridge.setButton(id, e.target.value).then(setView)}
          >
            {view.actions.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action] ?? action}
              </option>
            ))}
          </select>
        </Row>
      ))}
      <Row
        title="Ring and jog wheel"
        help="Fixed: the ring moves the text while you hold it, and the jog wheel sets the speed."
      >
        <small className="pf-fixed">Cannot be changed</small>
      </Row>
    </>
  );
}
