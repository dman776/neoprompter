import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface KeyProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** The small caption under the icon; `aria-label` falls back to it. */
  caption: string;
  /** The main key (Play and Pause): larger and in the accent color. */
  big?: boolean;
}

/** A transport key: a lit, tactile button with an icon and a caption. */
export function Key({ icon, caption, big, className, ...rest }: KeyProps) {
  return (
    <button
      type="button"
      className={['np-key', className].filter(Boolean).join(' ')}
      data-big={big ? 'true' : undefined}
      aria-label={rest['aria-label'] ?? caption}
      {...rest}
    >
      {icon}
      <span>{caption}</span>
    </button>
  );
}
