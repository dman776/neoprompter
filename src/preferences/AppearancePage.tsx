import { useState } from 'react';
import {
  MAX_FONT_SIZE,
  MAX_MARGIN,
  MAX_TEXT_WIDTH,
  MIN_FONT_SIZE,
  MIN_TEXT_WIDTH,
  type CoreState,
} from '../core';
import { Button } from '../operator/ui/Button';
import { Switch } from '../operator/ui/Switch';
import { ColorField, Row, Slider } from './controls';
import type { PageProps } from './categories';

/** The sample scales the Output's text so a large font size still fits the window. */
const SAMPLE_SCALE = 0.4;

/** The sample stays fixed above the settings (the window pins it), so every change is seen as made. */
export function AppearanceSample({ state }: { state: CoreState }) {
  const a = state.appearance;
  return (
    <div
      className="pf-sample"
      data-testid="sample"
      style={{
        backgroundColor: a.backgroundColor,
        color: a.textColor,
        fontSize: `${a.fontSize * SAMPLE_SCALE}px`,
        lineHeight: a.lineSpacing,
        paddingInline: `${a.margin}%`,
        transform: a.mirror ? 'scaleX(-1)' : undefined,
      }}
    >
      {a.readingLine && (
        <span
          className="pf-reading-line"
          data-testid="sample-reading-line"
          aria-hidden="true"
          style={{ top: `${a.readingLineY * 100}%`, borderLeftColor: a.readingLineColor }}
        />
      )}
      <span
        className="pf-sample-progress"
        data-testid="sample-progress"
        aria-hidden="true"
        style={{ background: a.progressColor }}
      />
      <div style={{ width: `${a.textWidth}%`, margin: '0 auto' }}>
        Notice what Boaz does. He does not make a speech. He simply stays at the edge of the field.
      </div>
    </div>
  );
}

export function AppearancePage({ state, dispatch }: PageProps) {
  const a = state.appearance;
  const [name, setName] = useState('');
  const change = (changes: Partial<typeof a>) => dispatch({ type: 'setAppearance', changes });
  const save = () => {
    const presetName = name.trim() || state.activePreset;
    if (!presetName) return;
    dispatch({ type: 'savePreset', name: presetName });
    setName('');
  };

  return (
    <>
      <Row title="Preset" help="A saved set of these settings, such as one for each Talent.">
        <select
          aria-label="Preset"
          value={state.activePreset ?? ''}
          onChange={(e) => e.target.value && dispatch({ type: 'loadPreset', name: e.target.value })}
        >
          <option value="">(no Preset)</option>
          {state.presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="pf-inline">
          <input
            type="text"
            aria-label="Preset name"
            placeholder="Preset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <div className="pf-inline">
          <Button onClick={save}>Save Preset</Button>
          <Button
            disabled={!state.activePreset}
            onClick={() =>
              state.activePreset && dispatch({ type: 'deletePreset', name: state.activePreset })
            }
          >
            Delete Preset
          </Button>
        </div>
      </Row>
      <Row title="Font size">
        <Slider
          label="Font size"
          value={a.fontSize}
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          step={2}
          unit=" px"
          onChange={(fontSize) => change({ fontSize })}
        />
      </Row>
      <Row title="Line spacing">
        <Slider
          label="Line spacing"
          value={a.lineSpacing}
          min={1}
          max={3}
          step={0.1}
          onChange={(lineSpacing) => change({ lineSpacing })}
        />
      </Row>
      <Row
        title="Text width"
        help="How much of the Output's width the text uses. Linked to Margin: widening one narrows the other."
      >
        <Slider
          label="Text width"
          value={Math.round(a.textWidth)}
          min={MIN_TEXT_WIDTH}
          max={MAX_TEXT_WIDTH}
          step={1}
          unit="%"
          onChange={(textWidth) => change({ textWidth })}
        />
      </Row>
      <Row
        title="Margin"
        help="The space at each side of the Output. 0% runs the text to the edges."
      >
        <Slider
          label="Margin"
          value={Math.round(a.margin)}
          min={0}
          max={MAX_MARGIN}
          step={1}
          unit="%"
          onChange={(margin) => change({ margin })}
        />
      </Row>
      <Row title="Text color" help="Hard-to-read colors are replaced automatically.">
        <ColorField
          label="Text color"
          value={a.textColor}
          onChange={(textColor) => change({ textColor })}
        />
      </Row>
      <Row title="Background">
        <ColorField
          label="Background"
          value={a.backgroundColor}
          onChange={(backgroundColor) => change({ backgroundColor })}
        />
      </Row>
      <Row title="Reading line" help="The triangle that marks the line being read.">
        <Switch
          compact
          label="Reading line"
          checked={a.readingLine}
          onCheckedChange={(readingLine) => change({ readingLine })}
        />
      </Row>
      <Row
        title="Reading line position"
        help="How far down the Output the triangle sits. Drag it in the Live view, or set it here."
      >
        <Slider
          label="Reading line position"
          value={Math.round(a.readingLineY * 100)}
          min={2}
          max={98}
          step={1}
          unit="%"
          onChange={(percent) => change({ readingLineY: percent / 100 })}
        />
      </Row>
      <Row title="Reading line color" help="Red unless you choose another.">
        <ColorField
          label="Reading line color"
          value={a.readingLineColor}
          onChange={(readingLineColor) => change({ readingLineColor })}
        />
      </Row>
      <Row title="Progress bar color" help="The thin bar along the bottom of the Output.">
        <ColorField
          label="Progress bar color"
          value={a.progressColor}
          onChange={(progressColor) => change({ progressColor })}
        />
      </Row>
      <Row title="Mirror" help="Flips the Output for beam-splitter glass.">
        <Switch
          compact
          label="Mirror"
          checked={a.mirror}
          onCheckedChange={() => dispatch({ type: 'toggleMirror' })}
        />
      </Row>
    </>
  );
}
