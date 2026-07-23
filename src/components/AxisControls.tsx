import type { AxisConfig, NumericDomain, TimbreName } from '../core/types';

interface AxisControlsProps {
  config: AxisConfig;
  domain: NumericDomain;
  onChange: (next: AxisConfig) => void;
  onPreview: (position: 0 | 0.5 | 1) => void;
  onTest: () => void;
}

const TIMBRES: { value: TimbreName; label: string }[] = [
  { value: 'pure', label: 'Pure tone' },
  { value: 'warm', label: 'Warm organ-like' },
  { value: 'reed', label: 'Reed-like' },
  { value: 'bright', label: 'Bright synth' },
];

export function AxisControls({
  config,
  domain,
  onChange,
  onPreview,
  onTest,
}: AxisControlsProps) {
  const id = `axis-${config.key}`;
  return (
    <fieldset className={`axis-card axis-${config.key}`}>
      <legend>{config.label} voice</legend>
      <p className="axis-domain">
        Active domain: {domain.minimum.toPrecision(5)} to{' '}
        {domain.maximum.toPrecision(5)}
        {domain.minimum === domain.maximum &&
          '. Constant values use the midpoint pitch.'}
      </p>
      <div className="field-grid">
        <label htmlFor={`${id}-timbre`}>Synthetic timbre</label>
        <select
          id={`${id}-timbre`}
          value={config.timbre}
          onChange={(event) =>
            onChange({ ...config, timbre: event.target.value as TimbreName })
          }
        >
          {TIMBRES.map((timbre) => (
            <option key={timbre.value} value={timbre.value}>
              {timbre.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-gain`}>
          Listening gain: {Math.round(config.gain * 100)}%
        </label>
        <input
          id={`${id}-gain`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={config.gain}
          onChange={(event) =>
            onChange({ ...config, gain: event.currentTarget.valueAsNumber })
          }
        />
      </div>
      <div className="check-row">
        <label>
          <input
            type="checkbox"
            checked={config.muted}
            onChange={(event) =>
              onChange({ ...config, muted: event.currentTarget.checked })
            }
          />{' '}
          Mute {config.key.toUpperCase()}
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.solo}
            onChange={(event) =>
              onChange({ ...config, solo: event.currentTarget.checked })
            }
          />{' '}
          Solo {config.key.toUpperCase()}
        </label>
      </div>
      <div
        className="button-row calibration"
        aria-label={`${config.label} calibration sounds`}
      >
        <button
          type="button"
          className="button-secondary"
          onClick={() => onPreview(0)}
        >
          Hear low
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => onPreview(0.5)}
        >
          Hear middle
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => onPreview(1)}
        >
          Hear high
        </button>
        <button type="button" className="button-secondary" onClick={onTest}>
          Test {config.key.toUpperCase()}
        </button>
      </div>
      <details>
        <summary>Advanced {config.key.toUpperCase()} mapping</summary>
        <div className="details-content field-grid">
          <label>
            <input
              type="checkbox"
              checked={config.automaticDomain}
              onChange={(event) =>
                onChange({
                  ...config,
                  automaticDomain: event.currentTarget.checked,
                })
              }
            />{' '}
            Automatic domain from curve
          </label>
          <span />
          <p id={`${id}-manual-domain-help`} className="fine-print full-row">
            Turn off automatic domain to edit the manual minimum and maximum.
          </p>
          <label htmlFor={`${id}-min`}>Manual minimum</label>
          <input
            id={`${id}-min`}
            type="number"
            value={config.manualDomain.minimum}
            disabled={config.automaticDomain}
            aria-describedby={`${id}-manual-domain-help`}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) {
                onChange({
                  ...config,
                  manualDomain: { ...config.manualDomain, minimum: value },
                });
              }
            }}
          />
          <label htmlFor={`${id}-max`}>Manual maximum</label>
          <input
            id={`${id}-max`}
            type="number"
            value={config.manualDomain.maximum}
            disabled={config.automaticDomain}
            aria-describedby={`${id}-manual-domain-help`}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) {
                onChange({
                  ...config,
                  manualDomain: { ...config.manualDomain, maximum: value },
                });
              }
            }}
          />
          <label htmlFor={`${id}-low-midi`}>Low MIDI note</label>
          <input
            id={`${id}-low-midi`}
            type="number"
            min="24"
            max="96"
            value={config.lowMidi}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value))
                onChange({ ...config, lowMidi: value });
            }}
          />
          <label htmlFor={`${id}-high-midi`}>High MIDI note</label>
          <input
            id={`${id}-high-midi`}
            type="number"
            min="24"
            max="96"
            value={config.highMidi}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value))
                onChange({ ...config, highMidi: value });
            }}
          />
          <label>
            <input
              type="checkbox"
              checked={config.inverted}
              onChange={(event) =>
                onChange({ ...config, inverted: event.currentTarget.checked })
              }
            />{' '}
            Invert pitch direction
          </label>
          <span />
          <label htmlFor={`${id}-pan`}>
            Stereo position: {config.pan.toFixed(1)}
          </label>
          <input
            id={`${id}-pan`}
            type="range"
            min="-1"
            max="1"
            step="0.1"
            value={config.pan}
            onChange={(event) =>
              onChange({ ...config, pan: event.currentTarget.valueAsNumber })
            }
          />
        </div>
      </details>
    </fieldset>
  );
}
