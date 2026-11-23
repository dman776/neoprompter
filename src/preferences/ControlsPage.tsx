import { useEffect, useState } from 'react';
import {
  ACTION_LABELS,
  BUTTON_IDS,
  chordLabel,
  type ButtonMappingView,
  type KeyBindingsView,
} from '../input';
import { Button } from '../operator/ui/Button';
import { Row } from './controls';
import type { PageProps } from './categories';

/**
 * The ShuttleXPress button mapping. The main process owns it (the Virtual shuttle and the real
 * device read the same one), so a change is sent there and the page follows what comes back.
 */
export function ButtonsTab({ bridge }: PageProps) {
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
      <p className="pf-note">
        These buttons are the Virtual shuttle&apos;s, and a ShuttleXPress&apos;s own when it is
        supported. A ShuttleXPress used through its driver software sends keys: set those on the
        Keyboard tab.
      </p>
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

/**
 * The Key bindings: each action with the keys that run it, in Run mode. The main process owns
 * the table (the Operator view reads the same one), so a change is sent there and the page
 * follows what comes back.
 */
export function KeyboardTab({ bridge }: PageProps) {
  const [view, setView] = useState<KeyBindingsView | null>(null);
  useEffect(() => {
    let live = true;
    bridge.onKeyBindings((v) => live && setView(v));
    void bridge.getKeyBindings().then((v) => live && setView((current) => current ?? v));
    return () => {
      live = false;
    };
  }, [bridge]);
  if (!view) return null;

  return (
    <>
      {view.actions.map((action) => {
        const name = ACTION_LABELS[action] ?? action;
        const keys = view.table[action] ?? [];
        return (
          <Row key={action} title={name}>
            <div className="pf-chips" role="list" aria-label={`Keys for ${name}`}>
              {keys.length === 0 && <small className="pf-fixed">No keys</small>}
              {keys.map((key) => {
                const label = chordLabel(key);
                return (
                  <span className="pf-chip" role="listitem" key={label}>
                    {label}
                    <button
                      type="button"
                      aria-label={`Remove ${label} from ${name}`}
                      onClick={() => void bridge.removeKey(action, key).then(setView)}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </Row>
        );
      })}
      <div className="pf-footer">
        <Button onClick={() => void bridge.resetKeys().then(setView)}>Reset to defaults</Button>
      </div>
    </>
  );
}
