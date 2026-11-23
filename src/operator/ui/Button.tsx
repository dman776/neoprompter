import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'plain' | 'primary';
  /** An icon-only button: square, and `aria-label` names it. */
  square?: boolean;
  /** The button's function is switched on (drawn in the accent color). */
  lit?: boolean;
}

export function Button({ variant = 'plain', square, lit, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={['np-button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-square={square ? 'true' : undefined}
      data-lit={lit ? 'true' : undefined}
      {...rest}
    />
  );
}
