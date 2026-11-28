import { MAX_FONT_SIZE, MIN_FONT_SIZE, type Command, type CoreState } from '../core';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';
import { MinusIcon, PlusIcon } from './ui/icons';

const MIN_SPACING = 1;
const MAX_SPACING = 3;
const SPACING_STEP = 0.1;

/** Quick text controls for the Output in Run mode: Text size and Line spacing. */
export function TextPanel({
  state,
  dispatch,
}: {
  state: CoreState;
  dispatch: (command: Command) => void;
}) {
  const { fontSize, lineSpacing } = state.appearance;
  const nudgeSpacing = (direction: 1 | -1) => {
    const next = Math.round((lineSpacing + direction * SPACING_STEP) * 10) / 10;
    dispatch({
      type: 'setAppearance',
      changes: { lineSpacing: Math.min(MAX_SPACING, Math.max(MIN_SPACING, next)) },
    });
  };
  return (
    <Panel title="Text" className="run-text">
      <div className="text-rows" data-testid="text-panel">
        <div>
          <span>Size</span>
          <div className="text-keys">
            <Button
              square
              variant="ghost"
              aria-label="Smaller text size"
              title="Smaller text"
              disabled={fontSize <= MIN_FONT_SIZE}
              onClick={() => dispatch({ type: 'nudgeFontSize', direction: -1 })}
            >
              <MinusIcon />
            </Button>
            <b data-testid="panel-size-value">{fontSize}</b>
            <Button
              square
              variant="ghost"
              aria-label="Larger text size"
              title="Larger text"
              disabled={fontSize >= MAX_FONT_SIZE}
              onClick={() => dispatch({ type: 'nudgeFontSize', direction: 1 })}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
        <div>
          <span>Line spacing</span>
          <div className="text-keys">
            <Button
              square
              variant="ghost"
              aria-label="Tighter line spacing"
              title="Tighter line spacing"
              disabled={lineSpacing <= MIN_SPACING}
              onClick={() => nudgeSpacing(-1)}
            >
              <MinusIcon />
            </Button>
            <b data-testid="panel-spacing-value">{lineSpacing.toFixed(1)}</b>
            <Button
              square
              variant="ghost"
              aria-label="Looser line spacing"
              title="Looser line spacing"
              disabled={lineSpacing >= MAX_SPACING}
              onClick={() => nudgeSpacing(1)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
