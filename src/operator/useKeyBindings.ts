import { useEffect, useRef, useState } from 'react';
import type { Command, CoreState } from '../core';
import {
  actionCommand,
  chordFromEvent,
  defaultKeyBindings,
  resolveKey,
  type KeyBindingTable,
  type KeyChord,
} from '../input';
import { isTyping } from './Speed';
import type { CoreBridge } from './useCoreState';

const SPEED_ACTIONS = ['speedUp', 'speedDown'];
const ARROW_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * What a key press does: the action it is bound to and its command, or null when it is not
 * bound. Holding Shift with a Speed up or Speed down key makes a bigger step, unless that
 * combination is bound to something of its own.
 */
export function commandForKey(
  table: KeyBindingTable,
  chord: KeyChord,
  state: Pick<CoreState, 'playing' | 'direction'>,
): { action: string; command: Command } | null {
  const found = resolveKey(table, chord);
  if (!found) return null;
  const command = actionCommand(found.action, state);
  if (!command) return null;
  const big = found.big && command.type === 'nudgeSpeed';
  return { action: found.action, command: big ? { ...command, big: true } : command };
}

/**
 * The Key bindings in Run mode. A key bound to an action runs it on key down, whatever has the
 * focus (a button the Operator just clicked is not pressed again by Space), except in a text
 * field or while the Script is unlocked for a live fix. Holding a key repeats only Speed up
 * and Speed down. Used by Run mode only, so Edit mode has no bindings. A slider that has its
 * own arrow keys (the Reading line) marks itself `data-keeps-arrows` and keeps them.
 */
export function useKeyBindings(state: CoreState, bridge: CoreBridge) {
  const [table, setTable] = useState<KeyBindingTable>(defaultKeyBindings);
  useEffect(() => {
    let live = true;
    bridge.onKeyBindings?.((view) => live && setTable(view.table));
    void bridge.getKeyBindings?.().then((view) => live && setTable(view.table));
    return () => {
      live = false;
    };
  }, [bridge]);

  // The handler reads the newest state at the moment of the key press, not the state of the last
  // time its effect ran: a key right after a change must see that change.
  const latest = useRef({ state, table, dispatch: bridge.dispatch });
  latest.current = { state, table, dispatch: bridge.dispatch };

  useEffect(() => {
    const find = (e: KeyboardEvent) => {
      const { state, table } = latest.current;
      if (state.unlocked || isTyping(e.target)) return null;
      const chord = chordFromEvent(e);
      if (!chord) return null;
      const target = e.target as HTMLElement | null;
      const own = !!target?.closest?.('[data-keeps-arrows]');
      if (own && ARROW_CODES.includes(chord.code) && !chord.ctrl && !chord.alt && !chord.meta) {
        return null;
      }
      return commandForKey(table, chord, state);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const found = find(e);
      if (!found) return;
      e.preventDefault();
      if (e.repeat && !SPEED_ACTIONS.includes(found.action)) return;
      latest.current.dispatch(found.command);
    };
    // A button is pressed by Space when the key goes up, so that is stopped as well.
    const onKeyUp = (e: KeyboardEvent) => {
      if (find(e)) e.preventDefault();
    };
    // In the capture phase, so a focused control never sees the key first.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, []);
}
