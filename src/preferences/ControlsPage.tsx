import { useEffect, useRef, useState } from 'react';
import {
  ACTION_LABELS,
  BUTTON_IDS,
  chordFromEvent,
  chordLabel,
  resolveKey,
  type ActionId,
  type ButtonMappingView,
  type KeyBindingsView,
  type KeyChord,
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

/** A key waiting for the Operator to say whether it moves from the action that has it. */
interface PendingMove {
  action: ActionId;
  key: KeyChord;
  owner: ActionId;
}

/**
 * The Key bindings: each action with the keys that run it, in Run mode. The main process owns
 * the table (the Operator view reads the same one), so a change is sent there and the page
 * follows what comes back. "Add key" waits for the next key pressed and saves it at once; Esc or
 * a click elsewhere cancels. A key another action has is moved only when the Operator says so.
 */
export function KeyboardTab({ bridge }: PageProps) {
  const [view, setView] = useState<KeyBindingsView | null>(null);
  const [capturing, setCapturing] = useState<ActionId | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [refused, setRefused] = useState<{ action: ActionId; reason: string } | null>(null);
  // A key's release must not press the button that was focused when it went down (Space does).
  const swallowUp = useRef<string | null>(null);
  const busy = useRef(false);
  const [lastKey, setLastKey] = useState<KeyChord | null>(null);
  useEffect(() => {
    let live = true;
    bridge.onKeyBindings((v) => live && setView(v));
    void bridge.getKeyBindings().then((v) => live && setView((current) => current ?? v));
    return () => {
      live = false;
    };
  }, [bridge]);

  const finish = () => {
    setCapturing(null);
    setPending(null);
  };

  useEffect(() => {
    if (capturing === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') return finish();
      if (e.repeat || pending || busy.current) return;
      const key = chordFromEvent(e);
      if (!key) return; // a modifier alone is not a key yet
      swallowUp.current = e.code;
      busy.current = true;
      void bridge
        .addKey(capturing, key)
        .then(({ result, view: next }) => {
          setView(next);
          if (result.status === 'conflict') {
            setPending({ action: capturing, key, owner: result.action });
            return;
          }
          if (result.status === 'refused') setRefused({ action: capturing, reason: result.reason });
          finish();
        })
        .finally(() => (busy.current = false));
    };
    const onPointerDown = (e: Event) => {
      if (!(e.target as HTMLElement | null)?.closest?.('[data-capture]')) finish();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [bridge, capturing, pending]);

  // The readout of the last key pressed in this window, for testing a driver's keys. It only
  // shows; it never runs the action, and it leaves the key to whatever else wants it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.repeat ? null : chordFromEvent(e);
      if (key) setLastKey(key);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (swallowUp.current !== e.code) return;
      swallowUp.current = null;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keyup', onKeyUp, true);
    return () => window.removeEventListener('keyup', onKeyUp, true);
  }, []);

  if (!view) return null;

  return (
    <>
      {view.actions.map((action) => {
        const name = ACTION_LABELS[action] ?? action;
        const keys = view.table[action] ?? [];
        const waiting = capturing === action;
        const move = pending?.action === action ? pending : null;
        return (
          <Row
            key={action}
            title={name}
            help={refused?.action === action ? refused.reason : undefined}
          >
            <div className="pf-keys">
              <div className="pf-chips" role="list" aria-label={`Keys for ${name}`}>
                {keys.length === 0 && !waiting && <small className="pf-fixed">No keys</small>}
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
              {move ? (
                <div
                  className="pf-move"
                  data-capture
                  role="alertdialog"
                  aria-label="Move this key?"
                >
                  <span>
                    {chordLabel(move.key)} is {ACTION_LABELS[move.owner] ?? move.owner}. Move it
                    here?
                  </span>
                  <div className="pf-inline">
                    <Button
                      variant="primary"
                      onClick={() =>
                        void bridge.moveKey(move.action, move.key).then(({ view: next }) => {
                          setView(next);
                          finish();
                        })
                      }
                    >
                      Move
                    </Button>
                    <Button onClick={finish}>Cancel</Button>
                  </div>
                </div>
              ) : waiting ? (
                <span className="pf-capture" data-capture role="status">
                  Press a key…
                </span>
              ) : (
                <Button
                  aria-label={`Add key to ${name}`}
                  onClick={() => {
                    setRefused(null);
                    setPending(null);
                    setCapturing(action);
                  }}
                >
                  Add key
                </Button>
              )}
            </div>
          </Row>
        );
      })}
      <div className="pf-footer">
        <p className="pf-lastkey" role="status" aria-label="Last key pressed">
          {lastKey ? <LastKey chord={lastKey} view={view} /> : 'Press a key to see what it does.'}
        </p>
        <Button onClick={() => void bridge.resetKeys().then(setView)}>Reset to defaults</Button>
      </div>
    </>
  );
}

/** "Last key pressed: Numpad 1, Play / Pause." or "…, not bound." */
function LastKey({ chord, view }: { chord: KeyChord; view: KeyBindingsView }) {
  const found = resolveKey(view.table, chord);
  const what = found
    ? `${ACTION_LABELS[found.action] ?? found.action}${found.big ? ' (bigger step)' : ''}`
    : 'not bound';
  return (
    <>
      Last key pressed: <b>{chordLabel(chord)}</b>, {what}.
    </>
  );
}
