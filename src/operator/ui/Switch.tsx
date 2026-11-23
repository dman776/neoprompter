import * as RadixSwitch from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The text beside the lamp. */
  label: string;
  /** Show only the lamp (the label still names the switch for screen readers). */
  compact?: boolean;
}

/** A lamp-style on/off switch (Radix Switch underneath, so keyboard and screen readers work). */
export function Switch({ checked, onCheckedChange, label, compact }: SwitchProps) {
  return (
    <RadixSwitch.Root
      className="np-switch"
      data-compact={compact ? 'true' : undefined}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
    >
      <span className="np-lamp" />
      {!compact && <span>{label}</span>}
    </RadixSwitch.Root>
  );
}
