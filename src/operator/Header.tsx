import type { Mode } from '../core';
import { Segment } from './ui/Segment';
import { EditIcon, RunIcon } from './ui/icons';

interface HeaderProps {
  scriptName: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

/** Name and current Script on the left, the Edit/Run mode switch in the middle. */
export function Header({ scriptName, mode, onModeChange }: HeaderProps) {
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
      <div className="header-end" />
    </header>
  );
}
