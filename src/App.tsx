import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AudioEngine,
  webAudioSupported,
  type AudioFrame,
} from './audio/AudioEngine';
import { AxisControls } from './components/AxisControls';
import { CurvePlot, type CurvePlotHandle } from './components/CurvePlot';
import {
  buildCurveGeometry,
  coordinateDomain,
  interpolateCurve,
  prepareDrawnPath,
} from './core/geometry';
import {
  MAX_FILE_BYTES,
  MAX_POINTS,
  parseCoordinates,
  readCoordinateFile,
  type CoordinateFormat,
} from './core/parser';
import { effectiveDomain, mapValueToPitch, sharedDomain } from './core/pitch';
import { generatePreset, PRESET_NAMES, type PresetName } from './core/presets';
import { timedProgress, transitionTransport } from './core/transport';
import type {
  AxisConfig,
  AxisKey,
  CurveData,
  NumericDomain,
  Parameterisation,
  Point,
  TransportState,
} from './core/types';

const DEFAULT_CURVE = generatePreset('Circle');
const SMALL_STEP = 0.01;
const LARGE_STEP = 0.05;

const DEFAULT_AXES: AxisConfig[] = [
  {
    key: 'x',
    label: 'X-axis',
    timbre: 'warm',
    automaticDomain: true,
    manualDomain: { minimum: -1, maximum: 1 },
    lowMidi: 48,
    highMidi: 72,
    inverted: false,
    gain: 0.72,
    muted: false,
    solo: false,
    pan: -0.35,
  },
  {
    key: 'y',
    label: 'Y-axis',
    timbre: 'reed',
    automaticDomain: true,
    manualDomain: { minimum: -1, maximum: 1 },
    lowMidi: 48,
    highMidi: 72,
    inverted: false,
    gain: 0.64,
    muted: false,
    solo: false,
    pan: 0.35,
  },
];

function initialTransport(audioAvailable: boolean): TransportState {
  return { status: audioAvailable ? 'silent' : 'unavailable', progress: 0 };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable';
  if (Math.abs(value) < 1e-10) return '0';
  return new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 7 }).format(
    value,
  );
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function safeManualDomain(domain: NumericDomain): NumericDomain {
  if (domain.minimum <= domain.maximum) return domain;
  return { minimum: domain.maximum, maximum: domain.minimum };
}

function issueUrl(): string {
  if (typeof window === 'undefined') return 'https://github.com/issues';
  const match = window.location.hostname.match(/^([^.]+)\.github\.io$/);
  const repository = window.location.pathname.split('/').filter(Boolean)[0];
  if (match?.[1] && repository) {
    return `https://github.com/${encodeURIComponent(match[1])}/${encodeURIComponent(repository)}/issues/new?labels=accessibility&title=Accessibility%20problem`;
  }
  return 'https://github.com/issues';
}

export function App() {
  const [audioAvailable] = useState(() => webAudioSupported());
  const [engine] = useState(() => new AudioEngine());
  const [curve, setCurve] = useState<CurveData>(DEFAULT_CURVE);
  const [originalCurve, setOriginalCurve] = useState<CurveData>(DEFAULT_CURVE);
  const [selectedPreset, setSelectedPreset] = useState<PresetName>('Circle');
  const [closed, setClosed] = useState(DEFAULT_CURVE.closed);
  const [reverse, setReverse] = useState(false);
  const [equalScale, setEqualScale] = useState(true);
  const [parameterisation, setParameterisation] =
    useState<Parameterisation>('arc-length');
  const [duration, setDuration] = useState(20);
  const [loop, setLoop] = useState(false);
  const [transport, dispatch] = useReducer(
    transitionTransport,
    initialTransport(audioAvailable),
  );
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [axes, setAxes] = useState<AxisConfig[]>(DEFAULT_AXES);
  const [useSharedDomain, setUseSharedDomain] = useState(false);
  const [centreVoices, setCentreVoices] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.18);
  const [announcement, setAnnouncement] = useState(
    'Audio is off. Press Play or a calibration control to enable it.',
  );
  const [periodicAnnouncements, setPeriodicAnnouncements] = useState(false);
  const [format, setFormat] = useState<CoordinateFormat>('auto');
  const [coordinateText, setCoordinateText] = useState('x,y\n-1,0\n0,1\n1,0');
  const [importError, setImportError] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const plotRef = useRef<CurvePlotHandle>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const playbackStartTimeRef = useRef(0);
  const playbackStartProgressRef = useRef(0);
  const lastVisualUpdateRef = useRef(0);
  const lastAnnouncementBandRef = useRef(-1);
  const previewTimerRef = useRef<number | null>(null);

  const geometry = useMemo(
    () => buildCurveGeometry(curve.points, closed),
    [closed, curve.points],
  );
  const automaticDomains = useMemo(
    () => ({
      x: coordinateDomain(curve.points, 'x'),
      y: coordinateDomain(curve.points, 'y'),
    }),
    [curve.points],
  );
  const activeDomains = useMemo(() => {
    const independent = Object.fromEntries(
      axes.map((axis) => [
        axis.key,
        effectiveDomain(
          axis,
          axis.automaticDomain
            ? automaticDomains[axis.key]
            : safeManualDomain(axis.manualDomain),
        ),
      ]),
    ) as Record<AxisKey, NumericDomain>;
    if (!useSharedDomain) return independent;
    const combined = sharedDomain(independent.x, independent.y);
    return { x: combined, y: combined };
  }, [automaticDomains, axes, useSharedDomain]);
  const currentPoint = useMemo(
    () =>
      interpolateCurve(
        curve.points,
        transport.progress,
        closed,
        parameterisation,
        reverse,
        geometry,
      ),
    [
      closed,
      curve.points,
      geometry,
      parameterisation,
      reverse,
      transport.progress,
    ],
  );
  const currentPitches = useMemo(
    () =>
      Object.fromEntries(
        axes.map((axis) => [
          axis.key,
          mapValueToPitch(
            currentPoint[axis.key],
            activeDomains[axis.key],
            axis.lowMidi,
            axis.highMidi,
            axis.inverted,
          ),
        ]),
      ) as Record<AxisKey, ReturnType<typeof mapValueToPitch>>,
    [activeDomains, axes, currentPoint],
  );
  const audioFrame = useMemo<AudioFrame>(
    () => ({
      frequencies: {
        x: currentPitches.x.frequency,
        y: currentPitches.y.frequency,
      },
      axes,
      masterVolume,
      centreVoices,
    }),
    [axes, centreVoices, currentPitches, masterVolume],
  );

  useEffect(() => {
    if (importError) errorSummaryRef.current?.focus();
  }, [importError]);

  useEffect(() => {
    if (
      audioEnabled &&
      (transport.status === 'holding' || transport.status === 'playing')
    )
      engine.applyFrame(audioFrame);
  }, [audioEnabled, audioFrame, engine, transport.status]);

  useEffect(() => {
    if (transport.status !== 'playing') return;
    let frameId = 0;
    const animate = () => {
      const result = timedProgress(
        playbackStartProgressRef.current,
        playbackStartTimeRef.current,
        engine.currentTime,
        duration,
        loop,
      );
      progressRef.current = result.progress;
      const point = interpolateCurve(
        curve.points,
        result.progress,
        closed,
        parameterisation,
        reverse,
        geometry,
      );
      plotRef.current?.setCurrentPoint(point);
      const frequencies = Object.fromEntries(
        axes.map((axis) => [
          axis.key,
          mapValueToPitch(
            point[axis.key],
            activeDomains[axis.key],
            axis.lowMidi,
            axis.highMidi,
            axis.inverted,
          ).frequency,
        ]),
      ) as Record<AxisKey, number>;
      engine.applyFrame({ frequencies, axes, masterVolume, centreVoices });

      const now = performance.now();
      if (now - lastVisualUpdateRef.current > 100 || result.completed) {
        lastVisualUpdateRef.current = now;
        dispatch({ type: 'SEEK', progress: result.progress });
      }
      if (periodicAnnouncements) {
        const band = Math.floor(result.progress * 4);
        if (band !== lastAnnouncementBandRef.current && band > 0 && band < 4) {
          lastAnnouncementBandRef.current = band;
          setAnnouncement(`Playback is ${band * 25}% complete.`);
        }
      }
      if (result.completed) {
        dispatch({ type: 'COMPLETE' });
        setAnnouncement('Traversal complete. Holding the final coordinate.');
        return;
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [
    activeDomains,
    axes,
    centreVoices,
    closed,
    curve.points,
    duration,
    engine,
    geometry,
    loop,
    masterVolume,
    parameterisation,
    periodicAnnouncements,
    reverse,
    transport.status,
  ]);

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.hidden &&
        (transport.status === 'playing' || transport.status === 'holding')
      ) {
        engine.fadeOut();
        dispatch({ type: 'STOP' });
        setAnnouncement(
          'Playback paused and sound stopped because the page was hidden. Your position was retained.',
        );
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [engine, transport.status]);

  useEffect(
    () => () => {
      if (previewTimerRef.current !== null)
        window.clearTimeout(previewTimerRef.current);
      void engine.close();
    },
    [engine],
  );

  function setProgress(next: number, announce = false): void {
    const progress = clampProgress(next);
    progressRef.current = progress;
    dispatch({ type: 'SEEK', progress });
    const point = interpolateCurve(
      curve.points,
      progress,
      closed,
      parameterisation,
      reverse,
      geometry,
    );
    plotRef.current?.setCurrentPoint(point);
    if (audioEnabled) {
      const frequencies = Object.fromEntries(
        axes.map((axis) => [
          axis.key,
          mapValueToPitch(
            point[axis.key],
            activeDomains[axis.key],
            axis.lowMidi,
            axis.highMidi,
            axis.inverted,
          ).frequency,
        ]),
      ) as Record<AxisKey, number>;
      engine.startSound({ frequencies, axes, masterVolume, centreVoices });
      dispatch({ type: 'HOLD' });
    }
    if (announce)
      setAnnouncement(
        `Moved to ${(progress * 100).toFixed(1)}%. X ${formatNumber(point.x)}, Y ${formatNumber(point.y)}.`,
      );
  }

  async function play(): Promise<void> {
    if (!audioAvailable) return;
    try {
      if (previewTimerRef.current !== null) {
        window.clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      await engine.enable();
      setAudioEnabled(true);
      const start = progressRef.current >= 1 ? 0 : progressRef.current;
      if (start !== progressRef.current) setProgress(0);
      playbackStartProgressRef.current = start;
      playbackStartTimeRef.current = engine.currentTime;
      lastAnnouncementBandRef.current = Math.floor(start * 4);
      engine.startSound(audioFrame);
      dispatch({ type: 'PLAY' });
      setAnnouncement(
        'Audio enabled. Playback started with X and Y sounding together.',
      );
    } catch {
      engine.fadeOut();
      dispatch({ type: 'ERROR' });
      setAnnouncement(
        'Audio could not be started. Visual and numeric inspection remain available.',
      );
    }
  }

  function hold(): void {
    if (transport.status !== 'playing') return;
    dispatch({ type: 'SEEK', progress: progressRef.current });
    dispatch({ type: 'HOLD' });
    setAnnouncement(
      'Movement held. Both voices sustain the current coordinate.',
    );
  }

  function stopSound(
    message = 'Sound stopped. Current position retained.',
  ): void {
    engine.fadeOut();
    dispatch({ type: 'SEEK', progress: progressRef.current });
    dispatch({ type: 'STOP' });
    setAnnouncement(message);
  }

  function resetToStart(): void {
    engine.fadeOut();
    progressRef.current = 0;
    dispatch({ type: 'RESET' });
    plotRef.current?.setCurrentPoint(
      interpolateCurve(
        curve.points,
        0,
        closed,
        parameterisation,
        reverse,
        geometry,
      ),
    );
    setAnnouncement('Traversal reset to its starting position. Audio is off.');
  }

  function applyCurve(next: CurveData): void {
    engine.fadeOut();
    setCurve(next);
    setOriginalCurve(next);
    setClosed(next.closed);
    setReverse(false);
    progressRef.current = 0;
    dispatch({ type: 'RESET' });
    setImportError('');
    setAnnouncement(
      `${next.name} loaded with ${next.points.length.toLocaleString('en-GB')} points. Audio remains off.`,
    );
  }

  function loadPreset(): void {
    applyCurve(generatePreset(selectedPreset));
  }

  function importText(source: 'text' | 'file' = 'text'): void {
    try {
      const points = parseCoordinates(coordinateText, format);
      applyCurve({
        name: source === 'file' ? 'Imported file' : 'Imported coordinates',
        source,
        points,
        closed: false,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The coordinate data could not be imported.';
      setImportError(message);
      setAnnouncement(`Import error: ${message}`);
    }
  }

  async function fileChanged(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await readCoordinateFile(file);
      const fileFormat: CoordinateFormat = file.name
        .toLowerCase()
        .endsWith('.json')
        ? 'json'
        : 'csv';
      setCoordinateText(text);
      setFormat(fileFormat);
      const points = parseCoordinates(text, fileFormat);
      applyCurve({ name: file.name, source: 'file', points, closed: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The file could not be read.';
      setImportError(message);
      setAnnouncement(`Import error: ${message}`);
    } finally {
      event.currentTarget.value = '';
    }
  }

  function finishDrawing(): void {
    const points = prepareDrawnPath(drawingPoints);
    if (points.length < 2) {
      setImportError(
        'Draw at least two distinct points before finishing the curve.',
      );
      setAnnouncement('Drawing needs at least two distinct points.');
      return;
    }
    setDrawing(false);
    setDrawingPoints([]);
    applyCurve({
      name: 'Freehand curve',
      source: 'drawing',
      points,
      closed: false,
    });
  }

  function updateAxis(key: AxisKey, next: AxisConfig): void {
    setAxes((current) =>
      current.map((axis) => (axis.key === key ? next : axis)),
    );
  }

  async function previewAxis(
    key: AxisKey | 'both',
    position: 0 | 0.5 | 1,
  ): Promise<void> {
    if (!audioAvailable) return;
    try {
      await engine.enable();
      setAudioEnabled(true);
      if (previewTimerRef.current !== null)
        window.clearTimeout(previewTimerRef.current);
      const frequencies = Object.fromEntries(
        axes.map((axis) => {
          const domain = activeDomains[axis.key];
          const value =
            domain.minimum + position * (domain.maximum - domain.minimum);
          return [
            axis.key,
            mapValueToPitch(
              value,
              domain,
              axis.lowMidi,
              axis.highMidi,
              axis.inverted,
            ).frequency,
          ];
        }),
      ) as Record<AxisKey, number>;
      const previewAxes = axes.map((axis) => ({
        ...axis,
        muted: key !== 'both' && axis.key !== key,
        solo: false,
      }));
      engine.startSound({
        frequencies,
        axes: previewAxes,
        masterVolume,
        centreVoices,
      });
      dispatch({ type: 'STOP' });
      setAnnouncement(
        `${key === 'both' ? 'Both voices' : `${key.toUpperCase()} voice`} calibration sound playing briefly.`,
      );
      previewTimerRef.current = window.setTimeout(() => {
        engine.fadeOut();
        setAnnouncement('Calibration sound finished.');
      }, 900);
    } catch {
      dispatch({ type: 'ERROR' });
      setAnnouncement('The calibration sound could not be started.');
    }
  }

  function downloadConfiguration(): void {
    const payload = {
      application: 'TIMUDS',
      schemaVersion: 1,
      curve: { ...curve, closed },
      traversal: { durationSeconds: duration, parameterisation, reverse, loop },
      mapping: {
        axes,
        sharedDomain: useSharedDomain,
        centreVoices,
        masterVolume,
      },
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'timuds-curve-and-mapping.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setAnnouncement('Curve and mapping configuration downloaded as JSON.');
  }

  function workspaceKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      stopSound(
        'Sound stopped immediately with Escape. Current position retained.',
      );
      return;
    }
    const target = event.target as HTMLElement;
    if (
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) ||
      target.isContentEditable
    )
      return;
    if (event.key === ' ') {
      event.preventDefault();
      if (transport.status === 'playing') hold();
      else void play();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      setProgress(
        progressRef.current +
          direction * (event.shiftKey ? LARGE_STEP : SMALL_STEP),
        true,
      );
    } else if (event.key === 'Home') {
      event.preventDefault();
      setProgress(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      setProgress(1, true);
    }
  }

  const stateLabel: Record<TransportState['status'], string> = {
    silent: 'Silent — audio has not been enabled',
    playing: 'Playing',
    holding: 'Holding position with sound sustained',
    stopped: 'Stopped at position — audio off',
    unavailable: 'Audio unavailable',
    error: 'Audio error',
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to the TIMUDS workspace
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="TIMUDS home">
            <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
              <path d="M5 24h38M24 5v38" className="brand-axis" />
              <path
                d="M4 29c6-13 12 13 18 0s12 13 22 0"
                className="brand-wave"
              />
              <circle cx="33" cy="15" r="4" />
            </svg>
            <span>TIMUDS</span>
          </a>
          <nav aria-label="Page sections">
            <a href="#curve-source">Curve</a>
            <a href="#axis-mapping">Mapping</a>
            <a href="#transport">Traversal</a>
            <a href="#accessibility">Access</a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="page-title">
          <p className="eyebrow">
            Time-Independent Multidimensional Sonification
          </p>
          <h1 id="page-title">Hear position, not just progression.</h1>
          <p className="hero-copy">
            TIMUDS plays an ordered two-dimensional curve with one sustained
            synthetic voice for X and another for Y.
            <strong>
              {' '}
              X and Y are played together. Movement along the curve is
              controlled separately.
            </strong>
          </p>
          <div className="notice" role="note">
            <span className="notice-icon" aria-hidden="true">
              i
            </span>
            <p>
              Audio never starts automatically. This is exploratory research
              software, not validated assistive technology or scientific
              instrumentation.
            </p>
          </div>
        </section>

        <section
          className="workspace"
          ref={workspaceRef}
          aria-labelledby="workspace-title"
          onKeyDown={workspaceKeyDown}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sonification workspace</p>
              <h2 id="workspace-title">Explore the current curve</h2>
            </div>
            <button
              type="button"
              className="stop-prominent"
              onClick={() => stopSound()}
              disabled={!audioEnabled}
            >
              <span aria-hidden="true">■</span> Stop sound
            </button>
          </div>
          {!audioAvailable && (
            <div className="warning" role="status">
              Web Audio is unavailable in this browser. Curve import, drawing,
              visualisation, mapping and numeric inspection still work; audio
              controls are disabled.
            </div>
          )}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <div className="workspace-grid">
            <div className="plot-column">
              <CurvePlot
                ref={plotRef}
                points={curve.points}
                currentPoint={currentPoint}
                closed={closed}
                reverse={reverse}
                equalScale={equalScale}
                drawing={drawing}
                drawingPoints={drawingPoints}
                onDrawPoint={(point) =>
                  setDrawingPoints((current) => {
                    if (current.length >= 5_000) return current;
                    const next = {
                      x: Math.min(1, Math.max(-1, point.x)),
                      y: Math.min(1, Math.max(-1, point.y)),
                    };
                    const previous = current.at(-1);
                    if (
                      previous &&
                      Math.hypot(next.x - previous.x, next.y - previous.y) <
                        0.002
                    )
                      return current;
                    return [...current, next];
                  })
                }
              />
              <div className="plot-options check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={equalScale}
                    onChange={(event) =>
                      setEqualScale(event.currentTarget.checked)
                    }
                  />{' '}
                  Equal axis scale
                </label>
                <span>Positive Y points upwards.</span>
              </div>
            </div>

            <aside className="live-readout" aria-labelledby="readout-title">
              <p className="readout-kicker">Live mapping</p>
              <h3 id="readout-title">Current position</h3>
              <dl>
                <div>
                  <dt>Audio state</dt>
                  <dd>{stateLabel[transport.status]}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{(transport.progress * 100).toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Elapsed</dt>
                  <dd>
                    {(transport.progress * duration).toFixed(2)} s of{' '}
                    {duration.toFixed(0)} s
                  </dd>
                </div>
                <div className="coordinate-x">
                  <dt>X value</dt>
                  <dd>{formatNumber(currentPoint.x)}</dd>
                </div>
                <div className="coordinate-x">
                  <dt>X pitch</dt>
                  <dd>
                    {currentPitches.x.noteName},{' '}
                    {currentPitches.x.frequency.toFixed(1)} Hz
                  </dd>
                </div>
                <div className="coordinate-y">
                  <dt>Y value</dt>
                  <dd>{formatNumber(currentPoint.y)}</dd>
                </div>
                <div className="coordinate-y">
                  <dt>Y pitch</dt>
                  <dd>
                    {currentPitches.y.noteName},{' '}
                    {currentPitches.y.frequency.toFixed(1)} Hz
                  </dd>
                </div>
              </dl>
              <p className="mapping-note">
                Signed values are mapped independently. Volume is for listening
                comfort, not data encoding.
              </p>
            </aside>
          </div>

          <section
            id="transport"
            className="panel transport-panel"
            aria-labelledby="transport-title"
          >
            <div className="panel-heading">
              <div>
                <p className="step-label">01 · Traversal</p>
                <h3 id="transport-title">Move through the ordered curve</h3>
              </div>
              <span className={`state-chip state-${transport.status}`}>
                {stateLabel[transport.status]}
              </span>
            </div>
            <div className="transport-primary button-row">
              <button
                type="button"
                className="button-primary"
                onClick={() => void play()}
                disabled={!audioAvailable || transport.status === 'playing'}
              >
                ▶{' '}
                {transport.progress > 0 && transport.progress < 1
                  ? 'Resume'
                  : 'Play'}
              </button>
              <button
                type="button"
                onClick={hold}
                disabled={transport.status !== 'playing'}
              >
                Ⅱ Hold
              </button>
              <button
                type="button"
                onClick={() => stopSound()}
                disabled={!audioEnabled}
              >
                ■ Stop sound
              </button>
              <button type="button" onClick={resetToStart}>
                ↺ Reset to start
              </button>
            </div>
            <div className="seek-block">
              <label htmlFor="seek">
                Curve progress: {(transport.progress * 100).toFixed(1)}%
              </label>
              <input
                id="seek"
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={transport.progress}
                onChange={(event) =>
                  setProgress(event.currentTarget.valueAsNumber)
                }
                onPointerDown={() => transport.status === 'playing' && hold()}
              />
              <div className="range-ends" aria-hidden="true">
                <span>Start</span>
                <span>End</span>
              </div>
            </div>
            <div className="manual-controls">
              <p>
                <strong>Manual movement</strong> uses normalised progress, not
                raw point indices.
              </p>
              <div className="button-row">
                <button type="button" onClick={() => setProgress(0, true)}>
                  Home
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProgress(progressRef.current - LARGE_STEP, true)
                  }
                >
                  −5%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProgress(progressRef.current - SMALL_STEP, true)
                  }
                >
                  −1%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProgress(progressRef.current + SMALL_STEP, true)
                  }
                >
                  +1%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProgress(progressRef.current + LARGE_STEP, true)
                  }
                >
                  +5%
                </button>
                <button type="button" onClick={() => setProgress(1, true)}>
                  End
                </button>
              </div>
            </div>
            <details>
              <summary>Timing and keyboard options</summary>
              <div className="details-content two-column-fields">
                <label htmlFor="duration">
                  One traversal duration (seconds)
                </label>
                <input
                  id="duration"
                  type="number"
                  min="1"
                  max="600"
                  step="1"
                  value={duration}
                  onChange={(event) =>
                    setDuration(
                      Math.min(
                        600,
                        Math.max(1, event.currentTarget.valueAsNumber || 1),
                      ),
                    )
                  }
                />
                <label htmlFor="parameterisation">
                  Traversal parameterisation
                </label>
                <select
                  id="parameterisation"
                  value={parameterisation}
                  onChange={(event) =>
                    setParameterisation(
                      event.currentTarget.value as Parameterisation,
                    )
                  }
                >
                  <option value="arc-length">
                    Constant spatial speed (arc length)
                  </option>
                  <option value="uniform">Uniform segment progression</option>
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(event) => setLoop(event.currentTarget.checked)}
                  />{' '}
                  Loop continuously
                </label>
                <span />
                <label>
                  <input
                    type="checkbox"
                    checked={periodicAnnouncements}
                    onChange={(event) =>
                      setPeriodicAnnouncements(event.currentTarget.checked)
                    }
                  />{' '}
                  Announce 25% intervals during playback
                </label>
                <span />
              </div>
              <p className="fine-print">
                Arc length gives constant spatial speed. Uniform segment
                progression gives each supplied segment equal time, so dense
                regions move more slowly.
              </p>
              <p className="fine-print">
                <strong>Workspace shortcuts:</strong> Space plays or holds;
                Left/Right steps 1%; Shift + Left/Right steps 5%; Home/End moves
                to either end; Escape fades all sound. Shortcuts do not override
                editable controls.
              </p>
            </details>
          </section>

          <section
            id="curve-source"
            className="panel"
            aria-labelledby="source-title"
          >
            <div className="panel-heading">
              <div>
                <p className="step-label">02 · Curve data</p>
                <h3 id="source-title">Choose or create an ordered curve</h3>
              </div>
            </div>
            {importError && (
              <div
                ref={errorSummaryRef}
                className="error-summary"
                role="alert"
                tabIndex={-1}
                aria-labelledby="error-title"
              >
                <h4 id="error-title">Coordinate data needs attention</h4>
                <p>{importError}</p>
                <a href="#coordinate-text">Review the coordinate input</a>
              </div>
            )}
            <div className="source-grid">
              <fieldset>
                <legend>Preset</legend>
                <label htmlFor="preset">Curve preset</label>
                <select
                  id="preset"
                  value={selectedPreset}
                  onChange={(event) =>
                    setSelectedPreset(event.currentTarget.value as PresetName)
                  }
                >
                  {PRESET_NAMES.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <button type="button" onClick={loadPreset}>
                  Load preset
                </button>
              </fieldset>
              <fieldset>
                <legend>Curve settings</legend>
                <div className="stacked-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={closed}
                      onChange={(event) => {
                        setClosed(event.currentTarget.checked);
                        stopSound('Curve closure changed. Audio stopped.');
                      }}
                    />{' '}
                    Closed curve
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={reverse}
                      onChange={(event) => {
                        setReverse(event.currentTarget.checked);
                        stopSound(
                          'Traversal direction changed. Audio stopped.',
                        );
                      }}
                    />{' '}
                    Reverse traversal direction
                  </label>
                </div>
                <button type="button" onClick={() => applyCurve(originalCurve)}>
                  Reset source curve
                </button>
              </fieldset>
            </div>
            <details className="import-details">
              <summary>Paste or upload coordinate data</summary>
              <div className="details-content">
                <div className="format-row">
                  <label htmlFor="coordinate-format">Coordinate format</label>
                  <select
                    id="coordinate-format"
                    value={format}
                    onChange={(event) =>
                      setFormat(event.currentTarget.value as CoordinateFormat)
                    }
                  >
                    <option value="auto">Detect CSV or JSON</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <label htmlFor="coordinate-text">Coordinate data</label>
                <textarea
                  id="coordinate-text"
                  value={coordinateText}
                  onChange={(event) =>
                    setCoordinateText(event.currentTarget.value)
                  }
                  aria-invalid={Boolean(importError)}
                  aria-describedby="coordinate-help coordinate-error"
                  rows={7}
                  spellCheck={false}
                />
                <p id="coordinate-help" className="fine-print">
                  CSV may include an x,y header. JSON may be [[x,y], …] or [
                  {`{"x":x,"y":y}`}, …]. At least 2 and no more than{' '}
                  {MAX_POINTS.toLocaleString('en-GB')} finite points.
                </p>
                <span id="coordinate-error" className="sr-only">
                  {importError}
                </span>
                <div className="button-row">
                  <button type="button" onClick={() => importText('text')}>
                    Import pasted coordinates
                  </button>
                </div>
                <label htmlFor="coordinate-file">
                  Or choose a local .csv or .json file
                </label>
                <input
                  id="coordinate-file"
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(event) => void fileChanged(event)}
                />
                <p className="fine-print">
                  Files stay in your browser and must be no more than{' '}
                  {MAX_FILE_BYTES / 1_000_000} MB.
                </p>
              </div>
            </details>
            <details open={drawing}>
              <summary>Freehand drawing</summary>
              <div className="details-content">
                <p>
                  Draw in the plot with pointer, pen or touch. Text and file
                  import remain the complete keyboard-accessible alternatives.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => {
                      stopSound();
                      setDrawing(true);
                      setDrawingPoints([]);
                      setImportError('');
                    }}
                  >
                    Start drawing
                  </button>
                  <button
                    type="button"
                    onClick={finishDrawing}
                    disabled={!drawing}
                  >
                    Finish drawing
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawingPoints([])}
                    disabled={!drawing || drawingPoints.length === 0}
                  >
                    Clear stroke
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawing(false);
                      setDrawingPoints([]);
                      setAnnouncement(
                        'Drawing cancelled; the previous curve is unchanged.',
                      );
                    }}
                    disabled={!drawing}
                  >
                    Cancel
                  </button>
                </div>
                {drawing && (
                  <p className="drawing-status" role="status">
                    Drawing mode active: {drawingPoints.length} raw points
                    captured.
                  </p>
                )}
              </div>
            </details>
            <div className="curve-summary" aria-labelledby="summary-title">
              <h4 id="summary-title">Curve summary</h4>
              <dl>
                <div>
                  <dt>Name/source</dt>
                  <dd>
                    {curve.name} · {curve.source}
                  </dd>
                </div>
                <div>
                  <dt>Points</dt>
                  <dd>{curve.points.length.toLocaleString('en-GB')}</dd>
                </div>
                <div>
                  <dt>X range</dt>
                  <dd>
                    {formatNumber(automaticDomains.x.minimum)} to{' '}
                    {formatNumber(automaticDomains.x.maximum)}
                  </dd>
                </div>
                <div>
                  <dt>Y range</dt>
                  <dd>
                    {formatNumber(automaticDomains.y.minimum)} to{' '}
                    {formatNumber(automaticDomains.y.maximum)}
                  </dd>
                </div>
                <div>
                  <dt>Polyline length</dt>
                  <dd>{formatNumber(geometry.totalLength)}</dd>
                </div>
                <div>
                  <dt>Closure</dt>
                  <dd>
                    {closed ? 'Closed; final point returns to first' : 'Open'}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="button-secondary"
                onClick={downloadConfiguration}
              >
                Download curve and mapping JSON
              </button>
            </div>
          </section>

          <section
            id="axis-mapping"
            className="panel"
            aria-labelledby="mapping-title"
          >
            <div className="panel-heading">
              <div>
                <p className="step-label">03 · Axis mapping</p>
                <h3 id="mapping-title">Map signed values to pitch</h3>
              </div>
              <button
                type="button"
                onClick={() => void previewAxis('both', 0.5)}
                disabled={!audioAvailable}
              >
                Test both voices
              </button>
            </div>
            <p>
              Each value is normalised within its domain, interpolated
              continuously from MIDI C3 (48) to C5 (72), then converted to
              frequency. Increasing signed values raise pitch by default.
            </p>
            <div className="global-audio-controls">
              <label htmlFor="master-volume">
                Safe master volume: {Math.round(masterVolume * 100)}%
              </label>
              <input
                id="master-volume"
                type="range"
                min="0"
                max="0.4"
                step="0.01"
                value={masterVolume}
                onChange={(event) =>
                  setMasterVolume(event.currentTarget.valueAsNumber)
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={useSharedDomain}
                  onChange={(event) =>
                    setUseSharedDomain(event.currentTarget.checked)
                  }
                />{' '}
                Use one shared numeric domain for X and Y
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={centreVoices}
                  onChange={(event) =>
                    setCentreVoices(event.currentTarget.checked)
                  }
                />{' '}
                Centre both voices (mono-friendly)
              </label>
            </div>
            <div className="axis-grid">
              {axes.map((axis) => (
                <AxisControls
                  key={axis.key}
                  config={axis}
                  domain={activeDomains[axis.key]}
                  onChange={(next) => updateAxis(axis.key, next)}
                  onPreview={(position) => void previewAxis(axis.key, position)}
                  onTest={() => void previewAxis(axis.key, 0.5)}
                />
              ))}
            </div>
          </section>
        </section>

        <section className="explanation" aria-labelledby="how-title">
          <div>
            <p className="eyebrow">Method</p>
            <h2 id="how-title">How the mapping works</h2>
          </div>
          <div className="method-grid">
            <article>
              <span>1</span>
              <h3>Keep axes independent</h3>
              <p>
                X controls the X voice’s pitch and Y controls a distinguishable
                Y timbre. Neither axis is consumed as time.
              </p>
            </article>
            <article>
              <span>2</span>
              <h3>Map value to pitch</h3>
              <p>
                u = clamp((value − minimum) / (maximum − minimum), 0, 1).
                Fractional MIDI values create continuous pitch.
              </p>
            </article>
            <article>
              <span>3</span>
              <h3>Traverse by a clock</h3>
              <p>
                Audio-context time sets duration; visual frame rate does not.
                Ordered points may double back, intersect or form a closed path.
              </p>
            </article>
          </div>
        </section>

        <section
          id="accessibility"
          className="access-section"
          aria-labelledby="access-title"
        >
          <div>
            <p className="eyebrow">Access and limitations</p>
            <h2 id="access-title">Designed for more than one way of sensing</h2>
          </div>
          <div className="access-grid">
            <div>
              <h3>Audio control</h3>
              <p>
                No autoplay. Play or calibration creates the audio context after
                a deliberate action. Stop sound is prominent, and Escape fades
                all audio.
              </p>
            </div>
            <div>
              <h3>Keyboard and screen readers</h3>
              <p>
                Every action has a native control. Discrete state changes and
                manual steps are announced; rapidly changing coordinates are not
                announced by default.
              </p>
            </div>
            <div>
              <h3>Visual and numeric alternatives</h3>
              <p>
                The SVG, curve summary and live readout expose position,
                progress, values, notes and frequencies without relying only on
                colour, movement or hearing.
              </p>
            </div>
            <div>
              <h3>Mono and reduced motion</h3>
              <p>
                Timbres differ independently of stereo position, and voices can
                be centred. Reduced-motion preferences remove interface
                transitions; sonification traversal remains user-controlled.
              </p>
            </div>
          </div>
          <div className="limitation-note">
            <h3>Known limitations</h3>
            <p>
              TIMUDS currently supports two dimensions, basic CSV rather than
              quoted-field dialects, synthetic timbres only, and no claim of
              perceptual, clinical, WCAG or scientific validation. Automated
              accessibility checks cannot certify conformance.
            </p>
            <p>
              Found an accessibility problem?{' '}
              <a href={issueUrl()} target="_blank" rel="noreferrer">
                Open an accessibility issue in the project repository
              </a>
              . On a local preview this link opens GitHub’s general issues page.
            </p>
          </div>
        </section>
      </main>
      <footer>
        <p>
          <strong>TIMUDS</strong> · Entirely client-side · No accounts,
          analytics, cookies, telemetry or uploaded data.
        </p>
      </footer>
    </>
  );
}
