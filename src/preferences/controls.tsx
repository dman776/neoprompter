import type { ReactNode } from 'react';

/** One setting: its name and help text on the left, its control on the right. */
export function Row({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="pf-row">
      <div>
        <b>{title}</b>
        {help && <small>{help}</small>}
      </div>
      <div className="pf-control">{children}</div>
    </div>
  );
}

/** A slider with its current value beside it. Changes apply at once. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="pf-slider">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <b className="pf-value">
        {value}
        {unit}
      </b>
    </div>
  );
}

/** A color swatch that opens the system color picker; every change applies at once. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pf-color">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pf-value">{value.toUpperCase()}</span>
    </div>
  );
}
