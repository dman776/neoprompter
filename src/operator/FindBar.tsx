import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/core';
import { Button } from './ui/Button';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from './ui/icons';
import { searchSummary } from './search';

interface FindBarProps {
  editor: Editor;
  /** Replacing changes the Script, so it needs Edit mode. */
  editable: boolean;
  onClose: () => void;
}

/** The compact find and replace bar above the document. */
export function FindBar({ editor, editable, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  // The summary is read from the editor, so re-read it whenever the document or the search moves.
  const [, bump] = useState(0);
  const findInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    editor.on('transaction', refresh);
    return () => void editor.off('transaction', refresh);
  }, [editor]);

  useEffect(() => {
    findInput.current?.focus();
    findInput.current?.select();
  }, []);

  // Closing the bar clears the highlights.
  useEffect(() => () => void (!editor.isDestroyed && editor.commands.setSearch('')), [editor]);

  const summary = searchSummary(editor);
  const reveal = () => {
    const at = searchSummary(editor).currentRange;
    if (at) editor.chain().setTextSelection(at).scrollIntoView().run();
  };
  const search = (q: string, mc: boolean) => {
    editor.commands.setSearch(q, mc);
    reveal();
  };
  const step = (dir: 'next' | 'previous') => {
    if (dir === 'next') editor.commands.findNext();
    else editor.commands.findPrevious();
    reveal();
  };

  const label =
    query === ''
      ? ''
      : summary.count === 0
        ? 'No matches'
        : `${summary.current + 1} of ${summary.count}`;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      step(e.shiftKey ? 'previous' : 'next');
    }
  };

  return (
    <div className="find-bar" role="search" aria-label="Find and replace" onKeyDown={onKey}>
      <input
        ref={findInput}
        className="find-input"
        aria-label="Find"
        placeholder="Find"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value, matchCase);
        }}
      />
      <span className="find-count" aria-live="polite">
        {label}
      </span>
      <Button
        square
        variant="ghost"
        aria-label="Previous match"
        disabled={summary.count === 0}
        onClick={() => step('previous')}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        square
        variant="ghost"
        aria-label="Next match"
        disabled={summary.count === 0}
        onClick={() => step('next')}
      >
        <ChevronDownIcon />
      </Button>
      <Button
        variant="ghost"
        aria-label="Match case"
        aria-pressed={matchCase}
        lit={matchCase}
        onClick={() => {
          setMatchCase(!matchCase);
          search(query, !matchCase);
        }}
      >
        Case
      </Button>
      <span className="format-sep" />
      <input
        className="find-input"
        aria-label="Replace with"
        placeholder="Replace with"
        value={replacement}
        disabled={!editable}
        onChange={(e) => setReplacement(e.target.value)}
      />
      <Button
        aria-label="Replace"
        disabled={!editable || summary.count === 0}
        onClick={() => {
          editor.commands.replaceCurrent(replacement);
          reveal();
        }}
      >
        Replace
      </Button>
      <Button
        aria-label="Replace all"
        disabled={!editable || summary.count === 0}
        onClick={() => editor.commands.replaceAll(replacement)}
      >
        Replace all
      </Button>
      <Button square variant="ghost" aria-label="Close find" onClick={onClose}>
        <CloseIcon />
      </Button>
    </div>
  );
}
