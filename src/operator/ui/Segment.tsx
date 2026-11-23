import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { ReactNode } from 'react';

interface SegmentProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}

/** A segmented single-choice control, such as the Edit/Run mode switch. */
export function Segment<T extends string>({
  value,
  onValueChange,
  options,
  label,
}: SegmentProps<T>) {
  return (
    <ToggleGroup.Root
      className="np-segment"
      type="single"
      value={value}
      aria-label={label}
      // Radix reports '' when the pressed item is pressed again; a segment always has one choice.
      onValueChange={(v) => v && onValueChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          data-state={o.value === value ? 'on' : 'off'}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
