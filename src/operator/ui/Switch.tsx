import * as RadixSwitch from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The text beside the lamp. */
  label: string;
}

/** A lamp-style on/off switch (Radix Switch underneath, so keyboard and screen readers work). */
export function Switch({ checked, onCheckedChange, label }: SwitchProps) {
  return (
    <RadixSwitch.Root
      className="np-switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
    >
      <span className="np-lamp" />
      <span>{label}</span>
    </RadixSwitch.Root>
  );
}
