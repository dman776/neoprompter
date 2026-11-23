import { Panel } from './ui/Panel';
import { Switch } from './ui/Switch';

/**
 * Run mode's Script lock: the Script is locked against typing, and this switch deliberately
 * unlocks it for a live fix (one paragraph at a time, by double-clicking it in the Live view).
 * The core enforces the lock; this only asks it to change.
 */
export function ScriptLock({
  unlocked,
  onChange,
  compact = false,
}: {
  unlocked: boolean;
  onChange: (unlocked: boolean) => void;
  /** One line beside the transport, for when the right-hand column is collapsed. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="lock-compact" data-testid="script-lock-compact" data-unlocked={unlocked}>
        <b>{unlocked ? 'Live edit on' : 'Editing locked'}</b>
        <Switch checked={unlocked} onCheckedChange={onChange} label="Unlock" compact />
      </div>
    );
  }
  return (
    <Panel title="Script" meta={unlocked ? 'Unlocked' : 'Locked'} className="script-lock">
      <div className="lock-row" data-testid="script-lock" data-unlocked={unlocked}>
        <p>
          <b>{unlocked ? 'Live edit on' : 'Editing locked'}</b>
          <small>
            {unlocked
              ? 'Double-click a paragraph in the Live view.'
              : 'Typing is off during a production.'}
          </small>
        </p>
        <Switch checked={unlocked} onCheckedChange={onChange} label="Unlock" compact />
      </div>
    </Panel>
  );
}
