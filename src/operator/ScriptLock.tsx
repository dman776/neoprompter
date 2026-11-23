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
}: {
  unlocked: boolean;
  onChange: (unlocked: boolean) => void;
}) {
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
