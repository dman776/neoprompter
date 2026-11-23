const base = {
  className: 'np-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const EditIcon = () => (
  <svg {...base}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const RunIcon = () => (
  <svg {...base}>
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
);

export const PlayIcon = RunIcon;

export const PauseIcon = () => (
  <svg {...base}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);

export const BackScreenIcon = () => (
  <svg {...base}>
    <path d="M12 6l-6 6 6 6M19 6l-6 6 6 6" />
  </svg>
);

export const ForwardScreenIcon = () => (
  <svg {...base}>
    <path d="M12 6l6 6-6 6M5 6l6 6-6 6" />
  </svg>
);

export const PlayStartIcon = () => (
  <svg {...base}>
    <path d="M6 5v14M18 6l-9 6 9 6z" />
  </svg>
);
