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

export const TopIcon = () => (
  <svg {...base}>
    <path d="M6 5h12M7 15l5-5 5 5" />
  </svg>
);

export const EndIcon = () => (
  <svg {...base}>
    <path d="M6 19h12M7 9l5 5 5-5" />
  </svg>
);

export const UndoIcon = () => (
  <svg {...base}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h10a6 6 0 010 8h-3" />
  </svg>
);

export const RedoIcon = () => (
  <svg {...base}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H10a6 6 0 000 8h3" />
  </svg>
);

export const HeadingIcon = () => (
  <svg {...base}>
    <path d="M6 4v16M18 4v16M6 12h12" />
  </svg>
);

export const BoldIcon = () => (
  <svg {...base}>
    <path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" />
  </svg>
);

export const ItalicIcon = () => (
  <svg {...base}>
    <path d="M10 5h8M6 19h8M14 5l-4 14" />
  </svg>
);

export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
);

export const ChevronUpIcon = () => (
  <svg {...base}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const ChevronDownIcon = () => (
  <svg {...base}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ColorIcon = () => (
  <svg {...base}>
    <path d="M6 16L12 4l6 12M8.2 12h7.6" />
  </svg>
);

export const SidebarIcon = () => (
  <svg {...base}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M15 5v14" />
  </svg>
);

export const ThemeIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 010 16z" fill="currentColor" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const DuplicateIcon = () => (
  <svg {...base}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const RenameIcon = () => (
  <svg {...base}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...base}>
    <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
  </svg>
);

export const ImportIcon = () => (
  <svg {...base}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

export const ScriptIcon = () => (
  <svg {...base}>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </svg>
);

/** Added by hand: a mouse pointer. */
export const ManualImportIcon = () => (
  <svg {...base}>
    <path d="M5 3l14 7-6 2.2L10.8 18z" />
  </svg>
);

/** Imported automatically from the Watched folder: a folder with a refresh arrow. */
export const WatchedFolderIcon = () => (
  <svg {...base}>
    <path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M15 13a3 3 0 1 1-1-2.2M14.2 9.5v1.8h1.8" />
  </svg>
);

export const InfoIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </svg>
);
