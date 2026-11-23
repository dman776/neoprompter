import type { ReactNode } from 'react';

interface PanelProps {
  /** Section header; omitted for a bare panel. */
  title?: string;
  /** Small text at the right of the header. */
  meta?: string;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, meta, className, children }: PanelProps) {
  return (
    <section className={['np-panel', className].filter(Boolean).join(' ')}>
      {title && (
        <h4>
          <span>{title}</span>
          {meta && <span>{meta}</span>}
        </h4>
      )}
      {children}
    </section>
  );
}
