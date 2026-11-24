import { useState } from 'react';
import type { Command, LibraryEntry } from '../core';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';
import {
  DuplicateIcon,
  InfoIcon,
  ManualImportIcon,
  PlusIcon,
  RenameIcon,
  ScriptIcon,
  SearchIcon,
  TrashIcon,
  WatchedFolderIcon,
} from './ui/icons';

interface LibraryProps {
  library: readonly LibraryEntry[];
  /** Id of the loaded Script, or null (the sample, or one deleted since). */
  loadedId: string | null;
  dispatch: (command: Command) => void;
}

/** "Edited Nov 22, 7:30 PM", or a plain note when the Script has never been edited. */
export function editedText(editedAt: number | null): string {
  if (editedAt === null) return 'Not edited yet';
  const when = new Date(editedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Edited ${when}`;
}

function dateText(ms: number | null): string {
  if (ms === null) return 'Unknown';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The details popup for one Script: how it arrived, and the file it came from. */
function ScriptInfo({ entry }: { entry: LibraryEntry }) {
  const { source } = entry;
  const rows: [string, string][] = [
    ['Import method', source?.method === 'watched' ? 'Automatic (Watched folder)' : 'Manual'],
  ];
  if (source) {
    rows.push(
      ['Type', source.fileType],
      ['Path', source.filePath],
      ['Last modified', dateText(source.fileModifiedMs)],
      ['Size', sizeText(source.fileSize)],
      ['Imported', dateText(source.importedAt)],
    );
  } else rows.push(['Path', 'Not recorded (kept only for Scripts imported from now on)']);
  rows.push(['Lines', String(entry.lineCount)]);
  return (
    <dl className="lib-info" data-testid="script-info" onClick={(e) => e.stopPropagation()}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The Script library: every saved Script by name and edit time, a search box, and New, Duplicate,
 * Rename and Delete. Duplicate, Rename and Delete act on the loaded Script (only one is loaded).
 */
export function Library({ library, loadedId, dispatch }: LibraryProps) {
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [infoFor, setInfoFor] = useState<string | null>(null);

  const loaded = library.find((s) => s.id === loadedId);
  const needle = query.trim().toLowerCase();
  const shown = needle ? library.filter((s) => s.name.toLowerCase().includes(needle)) : library;

  const startRename = () => {
    if (!loaded) return;
    setDeleting(false);
    setName(loaded.name);
    setRenaming(loaded.id);
  };
  const finishRename = () => {
    const next = name.trim();
    if (renaming && next) dispatch({ type: 'renameScript', id: renaming, name: next });
    setRenaming(null);
  };
  const load = (id: string) => dispatch({ type: 'loadScript', id });

  return (
    <Panel
      title="Scripts"
      meta={needle ? `${shown.length} of ${library.length}` : String(library.length)}
      className="lib"
    >
      <div className="lib-tools">
        <Button
          square
          variant="ghost"
          aria-label="New Script"
          title="New Script"
          onClick={() => dispatch({ type: 'newScript' })}
        >
          <PlusIcon />
        </Button>
        <Button
          square
          variant="ghost"
          aria-label="Duplicate"
          title="Duplicate"
          disabled={!loaded}
          onClick={() => loaded && dispatch({ type: 'duplicateScript', id: loaded.id })}
        >
          <DuplicateIcon />
        </Button>
        <Button
          square
          variant="ghost"
          aria-label="Rename"
          title="Rename"
          disabled={!loaded}
          onClick={startRename}
        >
          <RenameIcon />
        </Button>
        <Button
          square
          variant="ghost"
          aria-label="Delete"
          title="Delete"
          disabled={!loaded}
          lit={deleting}
          onClick={() => {
            setRenaming(null);
            setDeleting((d) => !d);
          }}
        >
          <TrashIcon />
        </Button>
        <label className="lib-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search"
            aria-label="Search Scripts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {deleting && loaded && (
        <div className="lib-confirm" role="group" aria-label="Delete this Script">
          <span>
            Delete <b>{loaded.name}</b>? This cannot be undone.
          </span>
          <Button
            onClick={() => {
              dispatch({ type: 'deleteScript', id: loaded.id });
              setDeleting(false);
            }}
          >
            Delete Script
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Keep
          </Button>
        </div>
      )}
      <div className="lib-list">
        {shown.map((s) => {
          const current = s.id === loadedId;
          const editing = renaming === s.id;
          const watched = s.source?.method === 'watched';
          return (
            <div key={s.id} className="lib-item">
              <div
                className="lib-card"
                aria-current={current ? 'true' : undefined}
                tabIndex={editing ? -1 : 0}
                role="button"
                onClick={() => !editing && !current && load(s.id)}
                onKeyDown={(e) => {
                  if (editing || current) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    load(s.id);
                  }
                }}
              >
                <ScriptIcon />
                <div>
                  {editing ? (
                    <input
                      autoFocus
                      className="lib-rename"
                      aria-label="Script name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') finishRename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onBlur={() => setRenaming(null)}
                    />
                  ) : (
                    <b>{s.name}</b>
                  )}
                  <small>{editedText(s.editedAt)}</small>
                </div>
                <span
                  className="lib-source"
                  data-source={watched ? 'watched' : 'manual'}
                  role="img"
                  aria-label={watched ? 'Imported automatically' : 'Added manually'}
                  title={watched ? 'Imported automatically (Watched folder)' : 'Added manually'}
                >
                  {watched ? <WatchedFolderIcon /> : <ManualImportIcon />}
                </span>
                <Button
                  square
                  variant="ghost"
                  aria-label="Script details"
                  title="Script details"
                  lit={infoFor === s.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoFor(infoFor === s.id ? null : s.id);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <InfoIcon />
                </Button>
              </div>
              {infoFor === s.id && <ScriptInfo entry={s} />}
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="lib-empty">
            {library.length === 0
              ? 'No Scripts yet. Make a New Script or Import one.'
              : 'No Scripts match.'}
          </p>
        )}
      </div>
    </Panel>
  );
}
