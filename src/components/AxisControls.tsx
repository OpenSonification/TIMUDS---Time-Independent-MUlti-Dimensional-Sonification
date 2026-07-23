import { INSTRUMENT_OPTIONS, INSTRUMENTS } from '../core/instruments';
import { MAX_MIDI_FILE_BYTES } from '../core/midi';
import { midiToNoteName } from '../core/pitch';
import type {
  AxisConfig,
  NumericDomain,
  TimbreName,
  ValueMapping,
} from '../core/types';

interface AxisControlsProps {
  config: AxisConfig;
  domain: NumericDomain;
  valueMapping: ValueMapping;
  midiError: string;
  onChange: (next: AxisConfig) => void;
  onMidiFile: (file: File) => Promise<void>;
  onMidiClear: () => void;
  onPreview: (position: 0 | 0.5 | 1) => void;
  onTest: () => void;
}

export function AxisControls({
  config,
  domain,
  valueMapping,
  midiError,
  onChange,
  onMidiFile,
  onMidiClear,
  onPreview,
  onTest,
}: AxisControlsProps) {
  const id = `axis-${config.key}`;
  const instrumentDescriptionId = `${id}-instrument-description`;
  const midiHelpId = `${id}-midi-help`;
  const midiErrorId = `${id}-midi-error`;
  const midiMap = config.midiNoteMap;
  const mappedProperty = {
    pitch: 'pitch',
    volume: 'volume',
    brightness: 'tone brightness',
    pulse: 'pulse rate',
  }[valueMapping];

  return (
    <fieldset className={`axis-card axis-${config.key}`}>
      <legend>{config.label} voice</legend>
      <p className="axis-domain">
        Active domain: {domain.minimum.toPrecision(5)} to{' '}
        {domain.maximum.toPrecision(5)}
        {domain.minimum === domain.maximum &&
          (valueMapping === 'pitch'
            ? '. Constant values use the midpoint pitch.'
            : `. Constant values use the midpoint ${mappedProperty}.`)}
      </p>
      <div className="field-grid">
        <label htmlFor={`${id}-timbre`}>Instrument sound</label>
        <select
          id={`${id}-timbre`}
          value={config.timbre}
          aria-describedby={instrumentDescriptionId}
          onChange={(event) =>
            onChange({ ...config, timbre: event.target.value as TimbreName })
          }
        >
          {INSTRUMENT_OPTIONS.map((instrument) => (
            <option key={instrument.value} value={instrument.value}>
              {instrument.label}
            </option>
          ))}
        </select>
        <p id={instrumentDescriptionId} className="fine-print full-row">
          {INSTRUMENTS[config.timbre].description} All choices are lightweight
          local synthesis, not recordings of acoustic instruments.
        </p>
        <label htmlFor={`${id}-gain`}>
          {valueMapping === 'volume'
            ? 'Maximum listening gain'
            : 'Listening gain'}
          : {Math.round(config.gain * 100)}%
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
      <section className="midi-map" aria-labelledby={`${id}-midi-title`}>
        <h4 id={`${id}-midi-title`}>Optional MIDI note map</h4>
        <p id={midiHelpId} className="fine-print">
          Choose a local .mid or .midi file up to{' '}
          {MAX_MIDI_FILE_BYTES / 1_000_000} MB. TIMUDS extracts note-on pitches,
          sorts unique notes from low to high and{' '}
          {valueMapping === 'pitch'
            ? 'maps this axis across them.'
            : 'uses the middle of that palette as the fixed pitch.'}{' '}
          MIDI files contain instructions rather than recorded sound; the
          instrument selected above still produces the audio. Nothing is
          uploaded.
        </p>
        <label htmlFor={`${id}-midi`}>
          MIDI file for {config.label.toLowerCase()}
        </label>
        <input
          id={`${id}-midi`}
          type="file"
          accept=".mid,.midi,audio/midi,audio/x-midi"
          aria-describedby={midiHelpId}
          aria-invalid={midiError ? 'true' : undefined}
          aria-errormessage={midiError ? midiErrorId : undefined}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) {
              input.value = '';
              return;
            }
            void onMidiFile(file).finally(() => {
              input.value = '';
            });
          }}
        />
        {midiError && (
          <p id={midiErrorId} className="inline-error" role="alert">
            {config.label} MIDI import: {midiError}
          </p>
        )}
        {midiMap && (
          <div className="midi-map-summary">
            <p>
              <strong>{midiMap.fileName}</strong>: {midiMap.notes.length}{' '}
              distinct {midiMap.notes.length === 1 ? 'note' : 'notes'} from{' '}
              {midiMap.noteOnEvents.toLocaleString('en-GB')} note-on{' '}
              {midiMap.noteOnEvents === 1 ? 'event' : 'events'} in{' '}
              {midiMap.trackCount}{' '}
              {midiMap.trackCount === 1 ? 'track' : 'tracks'}.
            </p>
            <p className="fine-print">
              Pitch range: {midiToNoteName(midiMap.notes[0] ?? 0)} to{' '}
              {midiToNoteName(midiMap.notes.at(-1) ?? 0)}.
            </p>
            <details>
              <summary>Review imported pitch palette</summary>
              <p className="fine-print">
                {midiMap.notes
                  .map(
                    (note) =>
                      `${midiToNoteName(note)} (MIDI ${note.toString()})`,
                  )
                  .join(', ')}
              </p>
            </details>
            <button
              type="button"
              className="button-secondary"
              onClick={onMidiClear}
            >
              Remove {config.key.toUpperCase()} MIDI note map
            </button>
          </div>
        )}
      </section>
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
            disabled={Boolean(midiMap)}
            aria-describedby={`${id}-pitch-range-help`}
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
            disabled={Boolean(midiMap)}
            aria-describedby={`${id}-pitch-range-help`}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value))
                onChange({ ...config, highMidi: value });
            }}
          />
          <p id={`${id}-pitch-range-help`} className="fine-print full-row">
            {midiMap
              ? valueMapping === 'pitch'
                ? 'The loaded MIDI note map currently replaces the low and high note range.'
                : `The middle note of the loaded MIDI map supplies the fixed pitch while ${mappedProperty} changes.`
              : valueMapping === 'pitch'
                ? 'These endpoints define the continuous pitch range when no MIDI note map is loaded.'
                : `The midpoint of these endpoints supplies the fixed pitch while ${mappedProperty} changes.`}
          </p>
          <label>
            <input
              type="checkbox"
              checked={config.inverted}
              onChange={(event) =>
                onChange({ ...config, inverted: event.currentTarget.checked })
              }
            />{' '}
            Invert {mappedProperty} direction
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
