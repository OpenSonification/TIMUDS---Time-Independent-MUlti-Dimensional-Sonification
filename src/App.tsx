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
  STOP_FADE_SECONDS,
  webAudioSupported,
  type AudioFrame,
} from './audio/AudioEngine';
import { AxisControls } from './components/AxisControls';
import { CurvePlot, type CurvePlotHandle } from './components/CurvePlot';
import { SourcePointEditor } from './components/SourcePointEditor';
import {
  TwoDimensionalExplorer,
  type ExplorerListeningMode,
} from './components/TwoDimensionalExplorer';
import {
  buildCurveGeometry,
  coordinateDomain,
  interpolateCurve,
  prepareDrawnPath,
} from './core/geometry';
import {
  explorationDomain,
  explorerSteps,
  moveExplorerPoint,
  nearestSourcePointIndex,
  stepForName,
  type ExplorerStepName,
} from './core/keyboardNavigation';
import { INSTRUMENT_OPTIONS, INSTRUMENTS } from './core/instruments';
import { readMidiNoteMap } from './core/midi';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type TimudsPreferences,
} from './core/preferences';
import { getCrossedMilestones, progressCueInterval } from './core/progressCues';
import {
  MAX_FILE_BYTES,
  MAX_POINTS,
  parseCoordinates,
  readCoordinateFile,
  type CoordinateFormat,
} from './core/parser';
import { effectiveDomain, mapValueToPitch, sharedDomain } from './core/pitch';
import { generatePreset, PRESET_NAMES, type PresetName } from './core/presets';
import { resolveShortcut } from './core/shortcuts';
import {
  mapPointForSonification,
  pitchRangesOverlap,
} from './core/sonification';
import { timedProgress, transitionTransport } from './core/transport';
import type {
  AxisConfig,
  AxisKey,
  CurveData,
  NumericDomain,
  Parameterisation,
  Point,
  ProgressCueInterval,
  ShortcutScope,
  SonificationMode,
  TransportState,
} from './core/types';

const DEFAULT_CURVE = generatePreset('Circle');
type AnnouncementDetail =
  'off' | 'coordinates' | 'coordinates-pitches' | 'full';
type PlaybackAnnouncementInterval = 'off' | '1' | '2' | '5' | '10';

const DEFAULT_AXES: AxisConfig[] = [
  {
    key: 'x',
    label: 'X-axis',
    timbre: 'warm',
    automaticDomain: true,
    manualDomain: { minimum: -1, maximum: 1 },
    lowMidi: 48,
    highMidi: 60,
    midiNoteMap: null,
    inverted: false,
    gain: 0.72,
    muted: false,
    solo: false,
    pan: -0.65,
  },
  {
    key: 'y',
    label: 'Y-axis',
    timbre: 'reed',
    automaticDomain: true,
    manualDomain: { minimum: -1, maximum: 1 },
    lowMidi: 67,
    highMidi: 79,
    midiNoteMap: null,
    inverted: false,
    gain: 0.64,
    muted: false,
    solo: false,
    pan: 0.65,
  },
];

function initialTransport(audioAvailable: boolean): TransportState {
  return { status: audioAvailable ? 'ready' : 'unavailable', progress: 0 };
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

function pitchForAxis(value: number, domain: NumericDomain, axis: AxisConfig) {
  return mapValueToPitch(
    value,
    domain,
    axis.lowMidi,
    axis.highMidi,
    axis.inverted,
    axis.midiNoteMap?.notes,
  );
}

function audioFrameForPoint(
  point: Point,
  frameAxes: AxisConfig[],
  domains: Record<AxisKey, NumericDomain>,
  mode: SonificationMode,
  stereoWidth: number,
  spatialTimbre: AxisConfig['timbre'],
  ySignCue: boolean,
  masterVolume: number,
  monoCompatible: boolean,
): AudioFrame {
  const configs = Object.fromEntries(
    frameAxes.map((axis) => [axis.key, axis]),
  ) as Record<AxisKey, AxisConfig>;
  const mapping = mapPointForSonification(
    mode,
    point,
    domains,
    configs,
    stereoWidth,
  );
  if (mapping.mode === 'spatial') {
    return {
      mode: 'spatial',
      frequency: mapping.frequency,
      pan: mapping.pan,
      signBlend: mapping.signBlend,
      timbre: spatialTimbre,
      ySignCue,
      masterVolume,
      monoCompatible,
    };
  }
  return {
    mode: 'axis-voices',
    frequencies: mapping.frequencies,
    axes: frameAxes,
    masterVolume,
    monoCompatible,
  };
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

function keyboardTargetOwnsInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.isContentEditable ||
    target.matches(
      'input, textarea, select, button, a[href], summary, [contenteditable="true"]',
    )
  )
    return true;
  const role = target.getAttribute('role');
  return Boolean(
    role &&
    [
      'button',
      'checkbox',
      'combobox',
      'listbox',
      'menu',
      'menuitem',
      'option',
      'radio',
      'slider',
      'spinbutton',
      'switch',
      'tab',
      'textbox',
    ].includes(role),
  );
}

export function App() {
  const [initialPreferences] = useState<TimudsPreferences>(() =>
    loadPreferences(
      typeof window === 'undefined' ? undefined : window.localStorage,
    ),
  );
  const [audioAvailable] = useState(() => webAudioSupported());
  const [engine] = useState(() => new AudioEngine());
  const [curve, setCurve] = useState<CurveData>(DEFAULT_CURVE);
  const [originalCurve, setOriginalCurve] = useState<CurveData>(DEFAULT_CURVE);
  const [selectedPreset, setSelectedPreset] = useState<PresetName>('Circle');
  const [closed, setClosed] = useState(DEFAULT_CURVE.closed);
  const [reverse, setReverse] = useState(false);
  const [parameterisation, setParameterisation] =
    useState<Parameterisation>('arc-length');
  const [duration, setDuration] = useState(20);
  const [loop, setLoop] = useState(false);
  const [transport, dispatch] = useReducer(
    transitionTransport,
    initialTransport(audioAvailable),
  );
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioSounding, setAudioSounding] = useState(false);
  const [axes, setAxes] = useState<AxisConfig[]>(() =>
    DEFAULT_AXES.map((axis) => ({
      ...axis,
      ...initialPreferences.axes[axis.key],
    })),
  );
  const [midiErrors, setMidiErrors] = useState<Record<AxisKey, string>>({
    x: '',
    y: '',
  });
  const [useSharedDomain, setUseSharedDomain] = useState(false);
  const [sonificationMode, setSonificationModeState] =
    useState<SonificationMode>(
      initialPreferences.monoCompatible
        ? 'axis-voices'
        : initialPreferences.sonificationMode,
    );
  const [stereoWidth, setStereoWidth] = useState(
    initialPreferences.stereoWidth,
  );
  const [monoCompatible, setMonoCompatibleState] = useState(
    initialPreferences.monoCompatible,
  );
  const [ySignCue, setYSignCue] = useState(initialPreferences.ySignCue);
  const [spatialTimbre, setSpatialTimbre] = useState(
    initialPreferences.spatialTimbre,
  );
  const [progressCueSetting, setProgressCueSetting] =
    useState<ProgressCueInterval>(initialPreferences.progressCueInterval);
  const [progressCueVolume, setProgressCueVolume] = useState(
    initialPreferences.progressCueVolume,
  );
  const [shortcutScope, setShortcutScope] = useState<ShortcutScope>(
    initialPreferences.shortcutScope,
  );
  const [requireAltForLetters, setRequireAltForLetters] = useState(
    initialPreferences.requireAltForLetters,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.18);
  const [announcement, setAnnouncement] = useState('Ready.');
  const [announcementDetail, setAnnouncementDetail] =
    useState<AnnouncementDetail>('coordinates');
  const [playbackAnnouncementInterval, setPlaybackAnnouncementInterval] =
    useState<PlaybackAnnouncementInterval>('off');
  const [followStep, setFollowStep] = useState<0.01 | 0.1>(
    initialPreferences.visibleStep,
  );
  const [format, setFormat] = useState<CoordinateFormat>('auto');
  const [coordinateText, setCoordinateText] = useState('x,y\n-1,0\n0,1\n1,0');
  const [importError, setImportError] = useState('');
  const [importErrorTarget, setImportErrorTarget] = useState<
    'text' | 'file' | 'drawing'
  >('text');
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [explorerActive, setExplorerActive] = useState(false);
  const [explorerPoint, setExplorerPoint] = useState<Point>({ x: 1, y: 0 });
  const [explorerStepName, setExplorerStepName] =
    useState<ExplorerStepName>('standard');
  const [customExplorerStep, setCustomExplorerStep] = useState(0.05);
  const [wasdEnabled, setWasdEnabled] = useState(false);
  const [explorerListeningMode, setExplorerListeningMode] =
    useState<ExplorerListeningMode>('short');
  const [previewDuration, setPreviewDuration] = useState(0.6);
  const plotRef = useRef<CurvePlotHandle>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const helpDialogRef = useRef<HTMLDialogElement>(null);
  const helpTriggerRef = useRef<HTMLElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const playbackStartTimeRef = useRef(0);
  const playbackStartProgressRef = useRef(0);
  const lastVisualUpdateRef = useRef(0);
  const lastPlaybackAnnouncementRef = useRef(-1);
  const previewTimerRef = useRef<number | null>(null);
  const explorerAnnouncementTimerRef = useRef<number | null>(null);
  const savedTraversalProgressRef = useRef(0);
  const lastExplorerKeyTimeRef = useRef(0);
  const lastBoundaryRef = useRef<string | null>(null);
  const midiRequestRef = useRef<Record<AxisKey, number>>({ x: 0, y: 0 });
  const lastCueProgressRef = useRef(0);
  const lastAnimationTimeRef = useRef(0);

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
  const curvePoint = useMemo(
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
  const explorerDomains = useMemo(
    () => ({
      x: explorationDomain(activeDomains.x),
      y: explorationDomain(activeDomains.y),
    }),
    [activeDomains],
  );
  const explorerStepOptions = useMemo(
    () => ({
      x: explorerSteps(explorerDomains.x),
      y: explorerSteps(explorerDomains.y),
    }),
    [explorerDomains],
  );
  const displayedPoint = explorerActive ? explorerPoint : curvePoint;
  const axisConfigs = useMemo(
    () =>
      Object.fromEntries(axes.map((axis) => [axis.key, axis])) as Record<
        AxisKey,
        AxisConfig
      >,
    [axes],
  );
  const currentPitches = useMemo(
    () =>
      Object.fromEntries(
        axes.map((axis) => [
          axis.key,
          pitchForAxis(displayedPoint[axis.key], activeDomains[axis.key], axis),
        ]),
      ) as Record<AxisKey, ReturnType<typeof mapValueToPitch>>,
    [activeDomains, axes, displayedPoint],
  );
  const sonificationMapping = useMemo(
    () =>
      mapPointForSonification(
        sonificationMode,
        displayedPoint,
        activeDomains,
        axisConfigs,
        stereoWidth,
      ),
    [activeDomains, axisConfigs, displayedPoint, sonificationMode, stereoWidth],
  );
  const audioFrame = useMemo<AudioFrame>(
    () =>
      sonificationMapping.mode === 'spatial'
        ? {
            mode: 'spatial',
            frequency: sonificationMapping.frequency,
            pan: sonificationMapping.pan,
            signBlend: sonificationMapping.signBlend,
            timbre: spatialTimbre,
            ySignCue,
            masterVolume,
            monoCompatible,
          }
        : {
            mode: 'axis-voices',
            frequencies: sonificationMapping.frequencies,
            axes,
            masterVolume,
            monoCompatible,
          },
    [
      axes,
      masterVolume,
      monoCompatible,
      sonificationMapping,
      spatialTimbre,
      ySignCue,
    ],
  );
  const nearestPointIndex = useMemo(
    () => nearestSourcePointIndex(curve.points, displayedPoint),
    [curve.points, displayedPoint],
  );
  const rangesOverlap = pitchRangesOverlap(
    axisConfigs.x.midiNoteMap?.notes[0] ?? axisConfigs.x.lowMidi,
    axisConfigs.x.midiNoteMap?.notes.at(-1) ?? axisConfigs.x.highMidi,
    axisConfigs.y.midiNoteMap?.notes[0] ?? axisConfigs.y.lowMidi,
    axisConfigs.y.midiNoteMap?.notes.at(-1) ?? axisConfigs.y.highMidi,
  );

  useEffect(() => {
    if (importError) errorSummaryRef.current?.focus();
  }, [importError]);

  useEffect(() => {
    const dialog = helpDialogRef.current;
    if (!dialog) return;
    if (helpOpen && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      window.setTimeout(() => dialog.querySelector<HTMLElement>('h2')?.focus());
    } else if (!helpOpen && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [helpOpen]);

  useEffect(() => {
    const persistedAxes = Object.fromEntries(
      axes.map((axis) => [
        axis.key,
        {
          timbre: axis.timbre,
          lowMidi: axis.lowMidi,
          highMidi: axis.highMidi,
          pan: axis.pan,
        },
      ]),
    ) as TimudsPreferences['axes'];
    const preferences: TimudsPreferences = {
      version: 1,
      sonificationMode,
      progressCueInterval: progressCueSetting,
      shortcutScope,
      requireAltForLetters,
      stereoWidth,
      monoCompatible,
      ySignCue,
      spatialTimbre,
      progressCueVolume,
      visibleStep: followStep,
      axes: persistedAxes,
    };
    savePreferences(
      typeof window === 'undefined' ? undefined : window.localStorage,
      preferences,
    );
  }, [
    axes,
    followStep,
    monoCompatible,
    progressCueSetting,
    progressCueVolume,
    requireAltForLetters,
    shortcutScope,
    sonificationMode,
    spatialTimbre,
    stereoWidth,
    ySignCue,
  ]);

  useEffect(() => {
    if (audioEnabled && audioSounding) engine.applyFrame(audioFrame);
  }, [audioEnabled, audioFrame, audioSounding, engine]);

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
      const now = performance.now();
      engine.applyFrame(
        audioFrameForPoint(
          point,
          axes,
          activeDomains,
          sonificationMode,
          stereoWidth,
          spatialTimbre,
          ySignCue,
          masterVolume,
          monoCompatible,
        ),
      );
      const cueInterval = progressCueInterval(progressCueSetting);
      if (cueInterval !== null) {
        const delayedFrame =
          lastAnimationTimeRef.current > 0 &&
          now - lastAnimationTimeRef.current > 500;
        const milestones = getCrossedMilestones(
          lastCueProgressRef.current,
          result.progress,
          cueInterval,
          {
            direction: 'forward',
            looped: loop,
            maximumCues: delayedFrame ? 0 : 1,
          },
        );
        const milestone = milestones.at(-1);
        if (milestone !== undefined)
          engine.triggerProgressCue(progressCueVolume, milestone === 1);
      }
      lastCueProgressRef.current = result.progress;
      lastAnimationTimeRef.current = now;
      if (now - lastVisualUpdateRef.current > 100 || result.completed) {
        lastVisualUpdateRef.current = now;
        dispatch({ type: 'SEEK', progress: result.progress });
      }
      if (playbackAnnouncementInterval !== 'off') {
        const interval = Number(playbackAnnouncementInterval);
        const announcementIndex = Math.floor(result.elapsed / interval);
        if (
          announcementIndex !== lastPlaybackAnnouncementRef.current &&
          announcementIndex > 0
        ) {
          lastPlaybackAnnouncementRef.current = announcementIndex;
          setAnnouncement(
            `Playback position ${(result.progress * 100).toFixed(0)}%.`,
          );
        }
      }
      if (result.completed) {
        dispatch({ type: 'COMPLETE' });
        setAnnouncement('Playback finished. The final point is sounding.');
        return;
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [
    activeDomains,
    axes,
    closed,
    curve.points,
    duration,
    engine,
    geometry,
    loop,
    masterVolume,
    monoCompatible,
    parameterisation,
    playbackAnnouncementInterval,
    progressCueSetting,
    progressCueVolume,
    reverse,
    sonificationMode,
    spatialTimbre,
    stereoWidth,
    transport.status,
    ySignCue,
  ]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && audioSounding) {
        stopAllSound(
          'The page was hidden, so playback stopped at the current point.',
        );
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  });

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent): void {
      const target = event.target;
      const workspace = workspaceRef.current;
      const command = resolveShortcut({
        key: event.key,
        scope: shortcutScope,
        targetInsideWorkspace:
          target instanceof Node &&
          Boolean(
            workspace?.contains(target) ||
            target === document.body ||
            target === document.documentElement,
          ),
        targetOwnsKeyboard: keyboardTargetOwnsInput(target),
        dialogOpen: helpOpen || Boolean(document.querySelector('dialog[open]')),
        defaultPrevented: event.defaultPrevented,
        composing: event.isComposing,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        requireAltForLetters,
        endIsAvailable: !closed,
      });
      if (!command) return;

      let handled = true;
      switch (command) {
        case 'toggle-play-hold':
          if (transport.status === 'playing') hold();
          else void play();
          break;
        case 'stop':
          stopAllSound('Sound stopped.');
          break;
        case 'reset':
          resetToStart();
          break;
        case 'step-back-1':
          seekCommand(progressRef.current - 0.01, true);
          break;
        case 'step-forward-1':
          seekCommand(progressRef.current + 0.01, true);
          break;
        case 'step-back-10':
          seekCommand(progressRef.current - 0.1, true);
          break;
        case 'step-forward-10':
          seekCommand(progressRef.current + 0.1, true);
          break;
        case 'start':
          seekCommand(0, true);
          break;
        case 'end':
          seekCommand(1, true);
          break;
        case 'emergency-stop':
          if (audioSounding) {
            stopAllSound('Escape stopped all sound.');
          } else {
            handled = false;
          }
          break;
        case 'open-help':
          openKeyboardHelp(target);
          break;
      }
      if (handled) event.preventDefault();
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  });

  useEffect(
    () => () => {
      if (previewTimerRef.current !== null)
        window.clearTimeout(previewTimerRef.current);
      if (explorerAnnouncementTimerRef.current !== null)
        window.clearTimeout(explorerAnnouncementTimerRef.current);
      void engine.close();
    },
    [engine],
  );

  function frameForPoint(point: Point, frameAxes = axes): AudioFrame {
    return audioFrameForPoint(
      point,
      frameAxes,
      activeDomains,
      sonificationMode,
      stereoWidth,
      spatialTimbre,
      ySignCue,
      masterVolume,
      monoCompatible,
    );
  }

  function positionAnnouncement(
    point: Point,
    progress: number | null,
    prefix = 'Position',
  ): string {
    if (announcementDetail === 'off') return '';
    const base = `${prefix}. X ${formatNumber(point.x)}, Y ${formatNumber(point.y)}.`;
    if (announcementDetail === 'coordinates') return base;
    const pitches = Object.fromEntries(
      axes.map((axis) => [
        axis.key,
        pitchForAxis(point[axis.key], activeDomains[axis.key], axis),
      ]),
    ) as Record<AxisKey, ReturnType<typeof mapValueToPitch>>;
    const withPitches = `${base} X ${pitches.x.noteName}, ${pitches.x.frequency.toFixed(1)} hertz. Y ${pitches.y.noteName}, ${pitches.y.frequency.toFixed(1)} hertz.`;
    if (announcementDetail === 'coordinates-pitches' || progress === null)
      return withPitches;
    return `${withPitches} Curve progress ${(progress * 100).toFixed(1)}%. ${reverse ? 'Reverse' : 'Forward'} traversal.`;
  }

  function queueExplorerAnnouncement(point: Point): void {
    if (explorerAnnouncementTimerRef.current !== null)
      window.clearTimeout(explorerAnnouncementTimerRef.current);
    if (announcementDetail === 'off') return;
    explorerAnnouncementTimerRef.current = window.setTimeout(() => {
      const message = positionAnnouncement(point, null, 'Explorer position');
      if (message) setAnnouncement(message);
    }, 250);
  }

  function clearPreviewTimer(): void {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }

  function setProgress(next: number, announce = false): void {
    const progress = clampProgress(next);
    progressRef.current = progress;
    lastCueProgressRef.current = progress;
    lastAnimationTimeRef.current = 0;
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
      clearPreviewTimer();
      engine.startSound(frameForPoint(point));
      setAudioSounding(true);
      dispatch({ type: 'HOLD' });
    }
    if (announce) {
      const message = positionAnnouncement(point, progress, 'Curve position');
      if (message) setAnnouncement(message);
    }
  }

  function seekCommand(next: number, announce = false): void {
    if (transport.status === 'playing') hold();
    setProgress(next, announce);
  }

  async function enableAudio(): Promise<boolean> {
    if (!audioAvailable) return false;
    try {
      await engine.enable();
      setAudioEnabled(true);
      setAnnouncement(
        'Audio enabled. No sound is playing. Use Play, Hear current position or a test button.',
      );
      return true;
    } catch {
      engine.stopAllSound();
      setAudioSounding(false);
      dispatch({ type: 'ERROR' });
      setAnnouncement(
        'Audio failed to start. The curve and text readout remain available.',
      );
      return false;
    }
  }

  async function play(): Promise<void> {
    if (!audioAvailable) return;
    try {
      clearPreviewTimer();
      await engine.enable();
      setAudioEnabled(true);
      if (explorerActive) {
        setExplorerActive(false);
        plotRef.current?.setCurrentPoint(curvePoint);
      }
      const start = progressRef.current >= 1 ? 0 : progressRef.current;
      if (start !== progressRef.current) setProgress(0);
      const startPoint = interpolateCurve(
        curve.points,
        start,
        closed,
        parameterisation,
        reverse,
        geometry,
      );
      playbackStartProgressRef.current = start;
      playbackStartTimeRef.current = engine.currentTime;
      lastPlaybackAnnouncementRef.current = 0;
      lastCueProgressRef.current = start;
      lastAnimationTimeRef.current = performance.now();
      plotRef.current?.setCurrentPoint(startPoint);
      engine.startSound(frameForPoint(startPoint));
      setAudioSounding(true);
      dispatch({ type: 'PLAY' });
      setAnnouncement(
        sonificationMode === 'spatial'
          ? 'Playing. X controls stereo position and Y controls pitch.'
          : 'Playing the separate X and Y voices.',
      );
    } catch {
      engine.stopAllSound();
      setAudioSounding(false);
      dispatch({ type: 'ERROR' });
      setAnnouncement(
        'Audio failed to start. The curve and readout are still available.',
      );
    }
  }

  function hold(): void {
    if (transport.status !== 'playing') return;
    dispatch({ type: 'SEEK', progress: progressRef.current });
    dispatch({ type: 'HOLD' });
    setAnnouncement(`Holding at ${(progressRef.current * 100).toFixed(1)}%.`);
  }

  function stopAllSound(message = 'Sound stopped at the current point.'): void {
    clearPreviewTimer();
    engine.stopAllSound(STOP_FADE_SECONDS);
    setAudioSounding(false);
    lastCueProgressRef.current = progressRef.current;
    lastAnimationTimeRef.current = 0;
    dispatch({ type: 'SEEK', progress: progressRef.current });
    dispatch({ type: 'STOP' });
    setAnnouncement(message);
  }

  function stopSound(message = 'Sound stopped at the current point.'): void {
    stopAllSound(message);
  }

  function openKeyboardHelp(target: EventTarget | null): void {
    helpTriggerRef.current =
      target instanceof HTMLElement
        ? target
        : (document.activeElement as HTMLElement);
    setHelpOpen(true);
  }

  function closeKeyboardHelp(): void {
    setHelpOpen(false);
    window.setTimeout(() => helpTriggerRef.current?.focus(), 0);
  }

  function changeSonificationMode(next: SonificationMode): void {
    if (next === sonificationMode) return;
    if (next === 'spatial' && monoCompatible) {
      setAnnouncement(
        'Spatial voice is unavailable while mono-compatible output is on.',
      );
      return;
    }
    stopAllSound('Changing sound mode stopped all sound.');
    setSonificationModeState(next);
    setAnnouncement(
      next === 'spatial'
        ? 'Spatial voice selected. X controls stereo position and Y controls pitch.'
        : 'Axis voices selected. X and Y use separate sounds.',
    );
  }

  function changeMonoCompatible(enabled: boolean): void {
    stopAllSound('Changing output mode stopped all sound.');
    setMonoCompatibleState(enabled);
    if (enabled) {
      setSonificationModeState('axis-voices');
      setAnnouncement(
        'Mono-compatible output is on. Axis voices were selected so X remains audible.',
      );
    } else {
      setAnnouncement('Mono-compatible output is off.');
    }
  }

  function restoreSeparatedRanges(): void {
    stopAllSound('Restoring pitch ranges stopped all sound.');
    midiRequestRef.current.x += 1;
    midiRequestRef.current.y += 1;
    setMidiErrors({ x: '', y: '' });
    setAxes((current) =>
      current.map((axis) => ({
        ...axis,
        lowMidi: DEFAULT_PREFERENCES.axes[axis.key].lowMidi,
        highMidi: DEFAULT_PREFERENCES.axes[axis.key].highMidi,
        midiNoteMap: null,
      })),
    );
    setAnnouncement(
      'Separated pitch ranges restored: X MIDI 48 to 60 and Y MIDI 67 to 79.',
    );
  }

  function resetToStart(): void {
    clearPreviewTimer();
    engine.stopAllSound(STOP_FADE_SECONDS);
    setAudioSounding(false);
    progressRef.current = 0;
    lastCueProgressRef.current = 0;
    lastAnimationTimeRef.current = 0;
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
    setAnnouncement('Back at the start. Audio is off.');
  }

  function applyCurve(next: CurveData): void {
    stopAllSound('Changing the curve stopped all sound.');
    setExplorerActive(false);
    setCurve(next);
    setOriginalCurve(next);
    setClosed(next.closed);
    setReverse(false);
    progressRef.current = 0;
    dispatch({ type: 'RESET' });
    setImportError('');
    setImportErrorTarget('text');
    const xDomain = coordinateDomain(next.points, 'x');
    const yDomain = coordinateDomain(next.points, 'y');
    setAnnouncement(
      `${next.name} loaded. ${next.points.length.toLocaleString('en-GB')} points. X range ${formatNumber(xDomain.minimum)} to ${formatNumber(xDomain.maximum)}. Y range ${formatNumber(yDomain.minimum)} to ${formatNumber(yDomain.maximum)}. ${next.closed ? 'Closed curve.' : 'Open curve.'} Audio is off.`,
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
      setImportErrorTarget('text');
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
      setImportErrorTarget('file');
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
      setImportErrorTarget('drawing');
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

  async function importMidiForAxis(key: AxisKey, file: File): Promise<void> {
    const request = midiRequestRef.current[key] + 1;
    midiRequestRef.current[key] = request;
    setMidiErrors((current) => ({ ...current, [key]: '' }));
    try {
      const midiNoteMap = await readMidiNoteMap(file);
      if (midiRequestRef.current[key] !== request) return;
      setAxes((current) =>
        current.map((axis) =>
          axis.key === key ? { ...axis, midiNoteMap } : axis,
        ),
      );
      setAnnouncement(
        `${key.toUpperCase()} MIDI note map loaded from ${midiNoteMap.fileName}. ${midiNoteMap.notes.length} distinct ${midiNoteMap.notes.length === 1 ? 'note' : 'notes'} from ${midiNoteMap.noteOnEvents.toLocaleString('en-GB')} note-on events. Audio remains ${audioSounding ? 'on' : 'off'}.`,
      );
    } catch (error) {
      if (midiRequestRef.current[key] !== request) return;
      const message =
        error instanceof Error
          ? error.message
          : 'The MIDI note map could not be read.';
      setMidiErrors((current) => ({ ...current, [key]: message }));
    }
  }

  function clearMidiForAxis(key: AxisKey): void {
    midiRequestRef.current[key] += 1;
    setMidiErrors((current) => ({ ...current, [key]: '' }));
    setAxes((current) =>
      current.map((axis) =>
        axis.key === key ? { ...axis, midiNoteMap: null } : axis,
      ),
    );
    setAnnouncement(
      `${key.toUpperCase()} MIDI note map removed. The continuous low-to-high MIDI range is active.`,
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
      clearPreviewTimer();
      const point = {
        x:
          activeDomains.x.minimum +
          position * (activeDomains.x.maximum - activeDomains.x.minimum),
        y:
          activeDomains.y.minimum +
          position * (activeDomains.y.maximum - activeDomains.y.minimum),
      };
      const previewAxes = axes.map((axis) => ({
        ...axis,
        muted: key !== 'both' && axis.key !== key,
        solo: false,
      }));
      engine.startSound(frameForPoint(point, previewAxes));
      setAudioSounding(true);
      dispatch({ type: 'STOP' });
      setAnnouncement(
        `${key === 'both' ? 'Both voices' : `${key.toUpperCase()} voice`} playing for calibration.`,
      );
      previewTimerRef.current = window.setTimeout(() => {
        stopAllSound('Calibration sound finished.');
      }, 900);
    } catch {
      setAudioSounding(false);
      dispatch({ type: 'ERROR' });
      setAnnouncement('The calibration sound could not be started.');
    }
  }

  async function soundExplorerPoint(point: Point, requested = false) {
    if (!audioAvailable) return;
    if (!requested && !audioEnabled) return;
    if (!requested && explorerListeningMode === 'on-demand') {
      stopAllSound('Explorer sound stopped.');
      return;
    }
    try {
      if (requested) {
        await engine.enable();
        setAudioEnabled(true);
      }
      clearPreviewTimer();
      engine.startSound(frameForPoint(point));
      setAudioSounding(true);
      dispatch({ type: 'STOP' });
      if (explorerListeningMode !== 'sustained') {
        previewTimerRef.current = window.setTimeout(() => {
          stopAllSound('Explorer preview finished.');
        }, previewDuration * 1000);
      }
    } catch {
      setAudioSounding(false);
      dispatch({ type: 'ERROR' });
      setAnnouncement('The explorer sound could not be started.');
    }
  }

  function changeExplorerCoordinate(axis: AxisKey, value: number): void {
    const domain = explorerDomains[axis];
    const bounded = Math.min(domain.maximum, Math.max(domain.minimum, value));
    const next = { ...explorerPoint, [axis]: bounded };
    setExplorerPoint(next);
    plotRef.current?.setCurrentPoint(next);
    queueExplorerAnnouncement(next);
    void soundExplorerPoint(next);
  }

  function enterExplorer(): void {
    savedTraversalProgressRef.current = progressRef.current;
    stopAllSound('Sound stopped before keyboard exploration.');
    setExplorerPoint(curvePoint);
    setExplorerActive(true);
    plotRef.current?.setCurrentPoint(curvePoint);
    setAnnouncement(
      'Keyboard exploration started. Arrow keys change x and y. The curve will not change. Press Escape to return.',
    );
  }

  function exitExplorer(): void {
    stopAllSound('Keyboard exploration ended.');
    setExplorerActive(false);
    const restored = interpolateCurve(
      curve.points,
      savedTraversalProgressRef.current,
      closed,
      parameterisation,
      reverse,
      geometry,
    );
    plotRef.current?.setCurrentPoint(restored);
    setAnnouncement(
      'Keyboard exploration ended. The saved curve position was restored.',
    );
  }

  function explorerControllerKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void {
    const standardSteps = {
      x: stepForName(explorerStepName, explorerDomains.x, customExplorerStep),
      y: stepForName(explorerStepName, explorerDomains.y, customExplorerStep),
    };
    const coarseSteps = {
      x: explorerStepOptions.x.coarse,
      y: explorerStepOptions.y.coarse,
    };
    const movement = moveExplorerPoint(
      explorerPoint,
      event.key,
      explorerDomains,
      standardSteps,
      coarseSteps,
      event.shiftKey,
      wasdEnabled,
    );
    if (!movement.handled) return;
    event.preventDefault();
    const now = performance.now();
    if (event.repeat && now - lastExplorerKeyTimeRef.current < 50) return;
    lastExplorerKeyTimeRef.current = now;
    if (movement.boundary) {
      if (lastBoundaryRef.current !== movement.boundary) {
        lastBoundaryRef.current = movement.boundary;
        const axis = movement.boundary.startsWith('x') ? 'X' : 'Y';
        const edge = movement.boundary.endsWith('minimum')
          ? 'Minimum'
          : 'Maximum';
        setAnnouncement(`${edge} ${axis} boundary reached.`);
      }
      return;
    }
    lastBoundaryRef.current = null;
    setExplorerPoint(movement.point);
    plotRef.current?.setCurrentPoint(movement.point);
    queueExplorerAnnouncement(movement.point);
    void soundExplorerPoint(movement.point);
  }

  function explorerControllerBlur(): void {
    if (audioSounding) {
      stopAllSound('Explorer sound stopped when its controller lost focus.');
    }
  }

  function progressForSourcePoint(index: number): number {
    const bounded = Math.min(Math.max(0, index), curve.points.length - 1);
    let forwardProgress = 0;
    if (parameterisation === 'uniform') {
      const segments = closed
        ? curve.points.length
        : Math.max(1, curve.points.length - 1);
      forwardProgress = bounded / segments;
    } else if (geometry.totalLength > 0) {
      forwardProgress =
        (geometry.segments[bounded]?.cumulativeStart ?? geometry.totalLength) /
        geometry.totalLength;
    }
    return reverse ? 1 - forwardProgress : forwardProgress;
  }

  function moveToSourcePoint(index: number): void {
    const next = progressForSourcePoint(index);
    if (explorerActive) {
      savedTraversalProgressRef.current = next;
      progressRef.current = next;
      dispatch({ type: 'SEEK', progress: next });
      setAnnouncement(
        `Curve traversal moved to source point ${index + 1}. The explorer coordinate is unchanged.`,
      );
      return;
    }
    seekCommand(next, true);
  }

  function moveTraversalToNearest(): void {
    const index = nearestSourcePointIndex(curve.points, explorerPoint);
    const next = progressForSourcePoint(index);
    savedTraversalProgressRef.current = next;
    progressRef.current = next;
    dispatch({ type: 'SEEK', progress: next });
    setAnnouncement(
      `Curve traversal moved to nearest source point, point ${index + 1}. Explorer coordinate is unchanged.`,
    );
  }

  function replaceCurvePoints(points: Point[], message: string): void {
    if (points.length < 2 || points.length > MAX_POINTS) return;
    stopAllSound('Editing the curve stopped all sound.');
    setCurve((current) => ({ ...current, source: 'editor', points }));
    progressRef.current = 0;
    dispatch({ type: 'RESET' });
    plotRef.current?.setCurrentPoint(points[0] ?? { x: 0, y: 0 });
    setAnnouncement(`${message} Traversal reset to the first point.`);
  }

  function addExplorerPointToCurve(): void {
    replaceCurvePoints(
      [...curve.points, explorerPoint],
      `Explorer coordinate X ${formatNumber(explorerPoint.x)}, Y ${formatNumber(explorerPoint.y)} added as point ${curve.points.length + 1}.`,
    );
  }

  function resetApplication(): void {
    stopAllSound('Resetting the application stopped all sound.');
    setCurve(DEFAULT_CURVE);
    setOriginalCurve(DEFAULT_CURVE);
    setSelectedPreset('Circle');
    setClosed(DEFAULT_CURVE.closed);
    setReverse(false);
    setParameterisation('arc-length');
    setDuration(20);
    setLoop(false);
    setAxes(DEFAULT_AXES);
    midiRequestRef.current.x += 1;
    midiRequestRef.current.y += 1;
    setMidiErrors({ x: '', y: '' });
    setUseSharedDomain(false);
    setSonificationModeState(DEFAULT_PREFERENCES.sonificationMode);
    setStereoWidth(DEFAULT_PREFERENCES.stereoWidth);
    setMonoCompatibleState(DEFAULT_PREFERENCES.monoCompatible);
    setYSignCue(DEFAULT_PREFERENCES.ySignCue);
    setSpatialTimbre(DEFAULT_PREFERENCES.spatialTimbre);
    setProgressCueSetting(DEFAULT_PREFERENCES.progressCueInterval);
    setProgressCueVolume(DEFAULT_PREFERENCES.progressCueVolume);
    setShortcutScope(DEFAULT_PREFERENCES.shortcutScope);
    setRequireAltForLetters(DEFAULT_PREFERENCES.requireAltForLetters);
    setMasterVolume(0.18);
    setAnnouncementDetail('coordinates');
    setPlaybackAnnouncementInterval('off');
    setFollowStep(DEFAULT_PREFERENCES.visibleStep);
    setExplorerActive(false);
    setWasdEnabled(false);
    setExplorerListeningMode('short');
    progressRef.current = 0;
    dispatch({ type: 'RESET' });
    setImportError('');
    setImportErrorTarget('text');
    setDrawing(false);
    setDrawingPoints([]);
    plotRef.current?.setCurrentPoint(DEFAULT_CURVE.points[0] ?? { x: 0, y: 0 });
    setAnnouncement(
      'Application reset. The default circle is loaded and audio is off.',
    );
  }

  function downloadConfiguration(): void {
    const payload = {
      application: 'TIMUDS',
      schemaVersion: 2,
      curve: { ...curve, closed },
      traversal: { durationSeconds: duration, parameterisation, reverse, loop },
      mapping: {
        sonificationMode,
        axes,
        sharedDomain: useSharedDomain,
        stereoWidth,
        monoCompatible,
        ySignCue,
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

  const stateLabel: Record<TransportState['status'], string> = {
    ready: 'Ready. Audio has not started.',
    playing: 'Playing',
    holding: 'Holding at current point',
    stopped: 'Stopped',
    unavailable: 'Audio unavailable',
    error: 'Audio error',
  };

  return (
    <>
      <nav className="skip-links" aria-label="Skip links">
        <a className="skip-link" href="#main-content">
          Skip to the TIMUDS workspace
        </a>
        <a className="skip-link" href="#transport">
          Skip to traversal controls
        </a>
        <a className="skip-link" href="#current-position">
          Skip to current position
        </a>
      </nav>
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
            <span className="brand-name">TIMUDS</span>
            <small>2D sonification instrument</small>
          </a>
          <nav aria-label="Page sections">
            <a href="#curve-controls">Curve</a>
            <a href="#sound-controls">Sound</a>
            <a href="#transport">Traversal</a>
            <a href="#advanced-controls">Advanced</a>
            <a href="#accessibility-controls">Accessibility</a>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="hero" id="top" aria-labelledby="page-title">
          <div className="hero-grid">
            <div className="hero-intro">
              <p className="eyebrow">Curve player</p>
              <h1 id="page-title">Hear a curve in two dimensions.</h1>
              <p className="hero-copy">
                Press Play to trace the curve. In the default Spatial voice, X
                moves the sound from left to right and Y changes its pitch.
              </p>
              <button
                type="button"
                className="button-secondary keyboard-help-button"
                onClick={(event) => openKeyboardHelp(event.currentTarget)}
                aria-haspopup="dialog"
              >
                Keyboard help
              </button>
              <div className="notice" role="note">
                <span className="notice-icon" aria-hidden="true">
                  i
                </span>
                <p>
                  Nothing plays until you ask it to. TIMUDS runs locally in this
                  browser and remains an experimental instrument.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={workspaceRef}
          className="workspace"
          aria-labelledby="workspace-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Instrument panel</p>
              <h2 id="workspace-title">Current curve</h2>
            </div>
            <button
              type="button"
              className="stop-prominent"
              onClick={() => stopSound()}
              disabled={!audioEnabled}
            >
              <span aria-hidden="true">■</span> Stop all sound
            </button>
          </div>
          {!audioAvailable && (
            <div className="warning" role="status">
              This browser has no Web Audio support. You can still load, draw
              and inspect curves.
            </div>
          )}
          <p className="sr-only" role="status" aria-atomic="true">
            {announcement}
          </p>

          <div className="workspace-grid">
            <div className="plot-column">
              <CurvePlot
                ref={plotRef}
                points={curve.points}
                currentPoint={displayedPoint}
                closed={closed}
                reverse={reverse}
                equalScale
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
                <span>Positive Y points upwards.</span>
              </div>
            </div>

            <aside
              id="current-position"
              className="live-readout"
              aria-labelledby="readout-title"
              tabIndex={-1}
            >
              <p className="readout-kicker">Live mapping</p>
              <h3 id="readout-title">Current position</h3>
              <dl className="position-summary">
                <div className="coordinate-x">
                  <dt>X</dt>
                  <dd>{formatNumber(displayedPoint.x)}</dd>
                </div>
                <div className="coordinate-y">
                  <dt>Y</dt>
                  <dd>{formatNumber(displayedPoint.y)}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{(transport.progress * 100).toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>
                    {sonificationMode === 'spatial'
                      ? 'Spatial voice'
                      : 'Axis voices'}
                  </dd>
                </div>
                <div>
                  <dt>Navigation</dt>
                  <dd>
                    {explorerActive ? 'Exploring plane' : 'Following curve'}
                  </dd>
                </div>
                <div>
                  <dt>Y sign</dt>
                  <dd>
                    {displayedPoint.y < 0
                      ? 'Negative'
                      : displayedPoint.y > 0
                        ? 'Positive'
                        : 'Zero'}
                  </dd>
                </div>
                <div>
                  <dt>Sound</dt>
                  <dd>{stateLabel[transport.status]}</dd>
                </div>
              </dl>
              <details className="technical-readout">
                <summary>Technical details</summary>
                <dl>
                  <div>
                    <dt>Mode</dt>
                    <dd>
                      {explorerActive ? 'Exploring plane' : 'Following curve'}
                    </dd>
                  </div>
                  <div>
                    <dt>Transport state</dt>
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
                  <div>
                    <dt>Source point</dt>
                    <dd>
                      Nearest point {nearestPointIndex + 1} of{' '}
                      {curve.points.length}
                    </dd>
                  </div>
                  <div className="coordinate-x">
                    <dt>X value</dt>
                    <dd>{formatNumber(displayedPoint.x)}</dd>
                  </div>
                  <div className="coordinate-x">
                    <dt>X note</dt>
                    <dd>{currentPitches.x.noteName}</dd>
                  </div>
                  <div className="coordinate-x">
                    <dt>X frequency</dt>
                    <dd>{currentPitches.x.frequency.toFixed(1)} Hz</dd>
                  </div>
                  <div className="coordinate-y">
                    <dt>Y value</dt>
                    <dd>{formatNumber(displayedPoint.y)}</dd>
                  </div>
                  <div className="coordinate-y">
                    <dt>Y note</dt>
                    <dd>{currentPitches.y.noteName}</dd>
                  </div>
                  <div className="coordinate-y">
                    <dt>Y frequency</dt>
                    <dd>{currentPitches.y.frequency.toFixed(1)} Hz</dd>
                  </div>
                  <div>
                    <dt>X domain</dt>
                    <dd>
                      {formatNumber(activeDomains.x.minimum)} to{' '}
                      {formatNumber(activeDomains.x.maximum)}
                    </dd>
                  </div>
                  <div>
                    <dt>Y domain</dt>
                    <dd>
                      {formatNumber(activeDomains.y.minimum)} to{' '}
                      {formatNumber(activeDomains.y.maximum)}
                    </dd>
                  </div>
                  <div>
                    <dt>Direction</dt>
                    <dd>{reverse ? 'Reverse' : 'Forward'}</dd>
                  </div>
                  <div>
                    <dt>Curve</dt>
                    <dd>{closed ? 'Closed' : 'Open'}</dd>
                  </div>
                  <div>
                    <dt>Audio sounding</dt>
                    <dd>{audioSounding ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt>Audio enabled</dt>
                    <dd>
                      {!audioAvailable
                        ? 'Unavailable'
                        : audioEnabled
                          ? 'Yes'
                          : 'No'}
                    </dd>
                  </div>
                  {axes.map((axis) => (
                    <div key={`${axis.key}-voice-state`}>
                      <dt>{axis.key.toUpperCase()} voice</dt>
                      <dd>
                        {INSTRUMENTS[axis.timbre].label}.{' '}
                        {axis.midiNoteMap
                          ? `${axis.midiNoteMap.fileName} MIDI map with ${axis.midiNoteMap.notes.length} ${axis.midiNoteMap.notes.length === 1 ? 'note' : 'notes'}.`
                          : `Continuous MIDI ${axis.lowMidi} to ${axis.highMidi}.`}{' '}
                        {axis.muted ? 'Muted' : 'Not muted'},{' '}
                        {axis.solo ? 'soloed' : 'not soloed'}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>Traversal position</dt>
                    <dd>
                      {explorerActive
                        ? 'Saved while plane exploration is active'
                        : 'Current curve position'}
                    </dd>
                  </div>
                </dl>
                <p className="mapping-note">
                  Pitch follows the signed value on each axis. A loaded MIDI map
                  quantises that axis to its imported note palette. Gain changes
                  the listening level.
                </p>
              </details>
            </aside>
          </div>

          <section
            id="transport"
            className="panel transport-panel"
            aria-labelledby="transport-title"
            tabIndex={-1}
          >
            <div className="panel-heading">
              <div>
                <h3 id="transport-title">Play the curve</h3>
              </div>
              <span className={`state-chip state-${transport.status}`}>
                {stateLabel[transport.status]}
              </span>
            </div>
            <div className="transport-primary button-row">
              <button
                type="button"
                onClick={() => void enableAudio()}
                disabled={!audioAvailable || audioEnabled}
              >
                Enable audio
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => void play()}
                disabled={!audioAvailable || transport.status === 'playing'}
              >
                <span aria-hidden="true">▶ </span>
                {transport.progress > 0 && transport.progress < 1
                  ? 'Resume'
                  : 'Play'}
              </button>
              <button
                type="button"
                onClick={hold}
                disabled={transport.status !== 'playing'}
              >
                <span aria-hidden="true">Ⅱ </span>Hold
              </button>
              <button
                type="button"
                onClick={() => stopSound()}
                disabled={!audioEnabled}
              >
                <span aria-hidden="true">■ </span>Stop all sound
              </button>
              <button type="button" onClick={resetToStart}>
                <span aria-hidden="true">↺ </span>Reset traversal
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={(event) => openKeyboardHelp(event.currentTarget)}
                aria-haspopup="dialog"
              >
                Keyboard help
              </button>
            </div>
            <p className="fine-print">
              Audio engine:{' '}
              {!audioAvailable
                ? 'unavailable in this browser'
                : audioEnabled
                  ? 'enabled'
                  : 'not enabled'}
              . Enable audio prepares the synthesiser without making sound.
            </p>
            <div className="seek-block">
              <label htmlFor="seek">Position along curve</label>
              <output htmlFor="seek">
                Normalised progress: {transport.progress.toFixed(3)} (
                {(transport.progress * 100).toFixed(1)}%)
              </output>
              <input
                id="seek"
                type="range"
                min="0"
                max="1"
                step={followStep}
                value={transport.progress}
                aria-describedby="follow-curve-help"
                onChange={(event) =>
                  seekCommand(event.currentTarget.valueAsNumber)
                }
              />
              <div className="range-ends" aria-hidden="true">
                <span>Start</span>
                <span>{closed ? 'Closing seam' : 'End'}</span>
              </div>
              <p id="follow-curve-help" className="fine-print">
                Left and Right use the selected step. Home moves to the start.
                End moves to the end; on a closed curve it reaches the closing
                seam predictably.
              </p>
            </div>
            <div className="manual-controls">
              <div className="follow-step-control">
                <label htmlFor="follow-step">Curve step size</label>
                <select
                  id="follow-step"
                  value={followStep}
                  onChange={(event) =>
                    setFollowStep(
                      Number(event.currentTarget.value) as 0.01 | 0.1,
                    )
                  }
                >
                  <option value="0.01">1%</option>
                  <option value="0.1">10%</option>
                </select>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => seekCommand(0, true)}>
                  Move to start
                </button>
                <button
                  type="button"
                  onClick={() =>
                    seekCommand(progressRef.current - followStep, true)
                  }
                >
                  Step backwards
                </button>
                <button
                  type="button"
                  onClick={() =>
                    seekCommand(progressRef.current + followStep, true)
                  }
                >
                  Step forwards
                </button>
                {!closed && (
                  <button type="button" onClick={() => seekCommand(1, true)}>
                    Move to end
                  </button>
                )}
              </div>
            </div>
            <details>
              <summary>Timing and announcement options</summary>
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
                <label htmlFor="announcement-detail">Announcement detail</label>
                <select
                  id="announcement-detail"
                  value={announcementDetail}
                  onChange={(event) =>
                    setAnnouncementDetail(
                      event.currentTarget.value as AnnouncementDetail,
                    )
                  }
                >
                  <option value="off">Off</option>
                  <option value="coordinates">Coordinates only</option>
                  <option value="coordinates-pitches">
                    Coordinates and pitches
                  </option>
                  <option value="full">Full position details</option>
                </select>
                <label htmlFor="playback-announcement-interval">
                  Timed playback announcements
                </label>
                <select
                  id="playback-announcement-interval"
                  value={playbackAnnouncementInterval}
                  onChange={(event) =>
                    setPlaybackAnnouncementInterval(
                      event.currentTarget.value as PlaybackAnnouncementInterval,
                    )
                  }
                >
                  <option value="off">Off</option>
                  <option value="1">Every 1 second</option>
                  <option value="2">Every 2 seconds</option>
                  <option value="5">Every 5 seconds</option>
                  <option value="10">Every 10 seconds</option>
                </select>
              </div>
              <p className="fine-print">
                Arc length gives constant spatial speed. Uniform segment
                progression gives each segment equal time. Closely spaced points
                therefore take longer to pass.
              </p>
              <p className="fine-print">
                Playback announcements are off by default. The current-position
                section remains available as ordinary text. Escape stops active
                audio unless a form control or dialog has the immediate claim to
                that key.
              </p>
            </details>
          </section>

          <details className="workspace-disclosure" id="curve-controls">
            <summary>Curve</summary>
            <div className="disclosure-content">
              <section
                id="curve-source"
                className="panel"
                aria-labelledby="source-title"
              >
                <div className="panel-heading">
                  <div>
                    <p className="step-label">03 · Curve data</p>
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
                    <a
                      href={
                        importErrorTarget === 'file'
                          ? '#coordinate-file'
                          : importErrorTarget === 'drawing'
                            ? '#drawing-controls'
                            : '#coordinate-text'
                      }
                    >
                      {importErrorTarget === 'file'
                        ? 'Review the file input'
                        : importErrorTarget === 'drawing'
                          ? 'Review the drawing controls'
                          : 'Review the coordinate input'}
                    </a>
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
                        setSelectedPreset(
                          event.currentTarget.value as PresetName,
                        )
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
                    <button
                      type="button"
                      onClick={() => applyCurve(originalCurve)}
                    >
                      Reset source curve
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={resetApplication}
                    >
                      Reset the whole application
                    </button>
                  </fieldset>
                </div>
                <details className="import-details">
                  <summary>Paste or upload coordinate data</summary>
                  <div className="details-content">
                    <div className="format-row">
                      <label htmlFor="coordinate-format">
                        Coordinate format
                      </label>
                      <select
                        id="coordinate-format"
                        value={format}
                        onChange={(event) =>
                          setFormat(
                            event.currentTarget.value as CoordinateFormat,
                          )
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
                      aria-invalid={
                        importErrorTarget === 'text' && Boolean(importError)
                      }
                      aria-errormessage={
                        importErrorTarget === 'text' && importError
                          ? 'coordinate-error'
                          : undefined
                      }
                      aria-describedby={
                        importErrorTarget === 'text'
                          ? 'coordinate-help coordinate-error'
                          : 'coordinate-help'
                      }
                      rows={7}
                      spellCheck={false}
                    />
                    <p id="coordinate-help" className="fine-print">
                      CSV may include an x,y header. JSON may be [[x,y], …] or [
                      {`{"x":x,"y":y}`}, …]. Point count: 2–
                      {MAX_POINTS.toLocaleString('en-GB')}. Every value must be
                      finite.
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
                      aria-invalid={
                        importErrorTarget === 'file' && Boolean(importError)
                      }
                      aria-errormessage={
                        importErrorTarget === 'file' && importError
                          ? 'coordinate-error'
                          : undefined
                      }
                      aria-describedby={
                        importErrorTarget === 'file'
                          ? 'file-help coordinate-error'
                          : 'file-help'
                      }
                      onChange={(event) => void fileChanged(event)}
                    />
                    <p id="file-help" className="fine-print">
                      Files stay in your browser and must be no more than{' '}
                      {MAX_FILE_BYTES / 1_000_000} MB.
                    </p>
                  </div>
                </details>
                <details open={drawing}>
                  <summary>Freehand drawing</summary>
                  <div
                    id="drawing-controls"
                    className="details-content"
                    tabIndex={-1}
                  >
                    <p>
                      Draw inside the plot with a pointer, pen or touch. The
                      point editor below provides the same practical authoring
                      steps without drawing.
                    </p>
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => {
                          stopSound();
                          setDrawing(true);
                          setDrawingPoints([]);
                          setImportError('');
                          setImportErrorTarget('text');
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
                        onClick={() =>
                          setDrawingPoints((current) => current.slice(0, -1))
                        }
                        disabled={!drawing || drawingPoints.length === 0}
                      >
                        Undo last sampled point
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
                          setAnnouncement('Drawing cancelled.');
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
                        {closed
                          ? 'Closed; final point returns to first'
                          : 'Open'}
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
                <SourcePointEditor
                  points={curve.points}
                  closed={closed}
                  onMoveToPoint={moveToSourcePoint}
                  onReplacePoints={replaceCurvePoints}
                  onAnnounce={setAnnouncement}
                />
              </section>
            </div>
          </details>

          <details className="workspace-disclosure" id="sound-controls">
            <summary>Sound</summary>
            <div className="disclosure-content">
              <section
                id="axis-mapping"
                className="panel"
                aria-labelledby="mapping-title"
              >
                <div className="panel-heading">
                  <div>
                    <h3 id="mapping-title">Choose how the curve sounds</h3>
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => void previewAxis('both', 0.5)}
                      disabled={!audioAvailable}
                    >
                      Test sound
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void soundExplorerPoint(displayedPoint, true)
                      }
                      disabled={!audioAvailable}
                    >
                      Hear current position
                    </button>
                  </div>
                </div>
                <fieldset className="sound-mode">
                  <legend>Sonification mode</legend>
                  <label>
                    <input
                      type="radio"
                      name="sonification-mode"
                      value="spatial"
                      checked={sonificationMode === 'spatial'}
                      disabled={monoCompatible}
                      onChange={() => changeSonificationMode('spatial')}
                    />{' '}
                    Spatial voice
                  </label>
                  <p className="fine-print">
                    One sound: X sets its left-to-right position and Y sets
                    pitch.
                  </p>
                  <label>
                    <input
                      type="radio"
                      name="sonification-mode"
                      value="axis-voices"
                      checked={sonificationMode === 'axis-voices'}
                      onChange={() => changeSonificationMode('axis-voices')}
                    />{' '}
                    Axis voices
                  </label>
                  <p className="fine-print">
                    Separate X and Y sounds with independent instruments and
                    pitch ranges.
                  </p>
                </fieldset>
                <div className="global-audio-controls">
                  <label htmlFor="master-volume">
                    Master volume: {Math.round(masterVolume * 100)}%
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
                      checked={monoCompatible}
                      onChange={(event) =>
                        changeMonoCompatible(event.currentTarget.checked)
                      }
                    />{' '}
                    Mono-compatible output
                  </label>
                  <p className="fine-print full-row">
                    Mono-compatible output uses centred Axis voices so X cannot
                    be lost when stereo channels are combined.
                  </p>
                  <label htmlFor="progress-cues">Progress tick</label>
                  <select
                    id="progress-cues"
                    value={progressCueSetting}
                    onChange={(event) =>
                      setProgressCueSetting(
                        event.currentTarget.value as ProgressCueInterval,
                      )
                    }
                  >
                    <option value="off">Off</option>
                    <option value="25">Every 25%</option>
                    <option value="12.5">Every 12.5%</option>
                    <option value="10">Every 10%</option>
                  </select>
                  <label htmlFor="progress-cue-volume">
                    Tick volume: {Math.round(progressCueVolume * 100)}%
                  </label>
                  <input
                    id="progress-cue-volume"
                    type="range"
                    min="0"
                    max="0.3"
                    step="0.01"
                    value={progressCueVolume}
                    disabled={progressCueSetting === 'off'}
                    onChange={(event) =>
                      setProgressCueVolume(event.currentTarget.valueAsNumber)
                    }
                  />
                </div>
                {sonificationMode === 'spatial' ? (
                  <div className="spatial-controls field-grid">
                    <label htmlFor="spatial-timbre">Voice sound</label>
                    <select
                      id="spatial-timbre"
                      value={spatialTimbre}
                      onChange={(event) =>
                        setSpatialTimbre(
                          event.currentTarget.value as AxisConfig['timbre'],
                        )
                      }
                      disabled={ySignCue}
                    >
                      {INSTRUMENT_OPTIONS.map((instrument) => (
                        <option key={instrument.value} value={instrument.value}>
                          {instrument.label}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="stereo-width">
                      Stereo width: {Math.round(stereoWidth * 100)}%
                    </label>
                    <input
                      id="stereo-width"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={stereoWidth}
                      onChange={(event) =>
                        setStereoWidth(event.currentTarget.valueAsNumber)
                      }
                    />
                    <label className="full-row">
                      <input
                        type="checkbox"
                        checked={ySignCue}
                        onChange={(event) =>
                          setYSignCue(event.currentTarget.checked)
                        }
                      />{' '}
                      Blend hollow and bright colour around Y zero
                    </label>
                    <p className="fine-print full-row">
                      The blend changes smoothly and is optional; the numeric X
                      and Y readout always carries the same information without
                      sound.
                    </p>
                  </div>
                ) : (
                  <>
                    {rangesOverlap && (
                      <div className="warning range-warning" role="note">
                        <p>
                          The X and Y pitch ranges overlap, so the two voices
                          may be harder to tell apart.
                        </p>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={restoreSeparatedRanges}
                        >
                          Restore separated ranges
                        </button>
                      </div>
                    )}
                    <div className="axis-grid">
                      {axes.map((axis) => (
                        <AxisControls
                          key={axis.key}
                          config={axis}
                          domain={activeDomains[axis.key]}
                          midiError={midiErrors[axis.key]}
                          onChange={(next) => updateAxis(axis.key, next)}
                          onMidiFile={(file) =>
                            importMidiForAxis(axis.key, file)
                          }
                          onMidiClear={() => clearMidiForAxis(axis.key)}
                          onPreview={(position) =>
                            void previewAxis(axis.key, position)
                          }
                          onTest={() => void previewAxis(axis.key, 0.5)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          </details>

          <details className="workspace-disclosure" id="advanced-controls">
            <summary>Advanced</summary>
            <div className="disclosure-content">
              <TwoDimensionalExplorer
                active={explorerActive}
                point={explorerPoint}
                domains={explorerDomains}
                steps={explorerStepOptions}
                stepName={explorerStepName}
                customStep={customExplorerStep}
                wasdEnabled={wasdEnabled}
                listeningMode={explorerListeningMode}
                previewDuration={previewDuration}
                audioAvailable={audioAvailable}
                onEnter={enterExplorer}
                onExit={exitExplorer}
                onControllerKeyDown={explorerControllerKeyDown}
                onControllerBlur={explorerControllerBlur}
                onCoordinateChange={changeExplorerCoordinate}
                onStepNameChange={setExplorerStepName}
                onCustomStepChange={setCustomExplorerStep}
                onWasdChange={setWasdEnabled}
                onListeningModeChange={setExplorerListeningMode}
                onPreviewDurationChange={setPreviewDuration}
                onHear={() => void soundExplorerPoint(explorerPoint, true)}
                onAddToCurve={addExplorerPointToCurve}
                onMoveTraversalToNearest={moveTraversalToNearest}
              />
            </div>
          </details>
        </section>

        <details className="page-disclosure" id="accessibility-controls">
          <summary>Accessibility</summary>
          <div className="disclosure-content">
            <section
              id="accessibility"
              className="access-section"
              aria-labelledby="access-title"
            >
              <div>
                <p className="eyebrow">Access</p>
                <h2 id="access-title">Access notes</h2>
              </div>
              <fieldset className="shortcut-settings">
                <legend>Page shortcuts</legend>
                <div className="field-grid">
                  <label htmlFor="shortcut-scope">Shortcut scope</label>
                  <select
                    id="shortcut-scope"
                    value={shortcutScope}
                    onChange={(event) =>
                      setShortcutScope(
                        event.currentTarget.value as ShortcutScope,
                      )
                    }
                  >
                    <option value="off">Off</option>
                    <option value="workspace">Workspace only</option>
                    <option value="site-wide">Whole page</option>
                  </select>
                  <label className="full-row">
                    <input
                      type="checkbox"
                      checked={requireAltForLetters}
                      onChange={(event) =>
                        setRequireAltForLetters(event.currentTarget.checked)
                      }
                    />{' '}
                    Require Alt with S, R and ? shortcuts
                  </label>
                </div>
                <p className="fine-print">
                  Shortcuts never take over typing, native form controls, open
                  dialogs, browser or assistive-technology modifier commands.
                </p>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={(event) => openKeyboardHelp(event.currentTarget)}
                  aria-haspopup="dialog"
                >
                  Open keyboard help
                </button>
              </fieldset>
              <div className="access-grid">
                <div>
                  <h3>Audio control</h3>
                  <p>
                    Sound begins after Play, Hear current position or a
                    calibration button is pressed. Stop all sound is always
                    visible once audio has been enabled.
                  </p>
                </div>
                <div>
                  <h3>Keyboard and screen readers</h3>
                  <p>
                    The controls use standard HTML elements. Manual explorer
                    announcements are coalesced. Timed coordinate announcements
                    are off by default.
                  </p>
                </div>
                <div>
                  <h3>Text readout</h3>
                  <p>
                    The current-position section remains selectable without
                    audio. It includes coordinates, notes, frequencies, domains,
                    instruments, MIDI pitch sources, voice states and traversal
                    state.
                  </p>
                </div>
                <div>
                  <h3>Mono output and motion</h3>
                  <p>
                    Mono-compatible output uses two centred axis voices so
                    neither dimension depends on stereo. Reduced motion removes
                    interface transitions.
                  </p>
                </div>
              </div>
              <details className="keyboard-reference">
                <summary>Additional keyboard notes</summary>
                <div className="details-content keyboard-help-grid">
                  <section aria-labelledby="keyboard-general">
                    <h3 id="keyboard-general">General page navigation</h3>
                    <p>
                      Use <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> to
                      move between controls. Use <kbd>Enter</kbd> or{' '}
                      <kbd>Space</kbd> on native buttons. The first Tab reveals
                      skip links.
                    </p>
                  </section>
                  <section aria-labelledby="keyboard-follow">
                    <h3 id="keyboard-follow">Follow-curve navigation</h3>
                    <p>
                      On Position along curve, <kbd>Left</kbd> and{' '}
                      <kbd>Right</kbd> change progress. <kbd>Home</kbd> selects
                      the start and <kbd>End</kbd> selects the end or closing
                      seam. Named buttons provide the same actions.
                    </p>
                  </section>
                  <section aria-labelledby="keyboard-plane">
                    <h3 id="keyboard-plane">
                      Two-dimensional plane navigation
                    </h3>
                    <p>
                      Enter the mode, then focus stays on the bounded
                      controller.
                      <kbd>Left</kbd>/<kbd>Right</kbd> change x and{' '}
                      <kbd>Up</kbd>/<kbd>Down</kbd> change numeric y.{' '}
                      <kbd>Shift</kbd> uses the coarse step. <kbd>Escape</kbd>{' '}
                      returns to the curve. <kbd>Tab</kbd> leaves normally.
                    </p>
                  </section>
                  <section aria-labelledby="keyboard-wasd">
                    <h3 id="keyboard-wasd">Optional WASD controls</h3>
                    <p>
                      WASD starts off. When enabled, it works only on the
                      focused plane controller: <kbd>W</kbd> increases y,{' '}
                      <kbd>A</kbd> decreases x, <kbd>S</kbd> decreases y and{' '}
                      <kbd>D</kbd> increases x.
                    </p>
                  </section>
                  <section aria-labelledby="keyboard-safety">
                    <h3 id="keyboard-safety">Audio-safety control</h3>
                    <p>
                      When audio is sounding, <kbd>Escape</kbd> fades it outside
                      editable fields and dialogs. The visible Stop all sound
                      button performs the same safety action.
                    </p>
                  </section>
                  <section aria-labelledby="keyboard-screen-reader">
                    <h3 id="keyboard-screen-reader">Screen-reader note</h3>
                    <p>
                      Browse and Quick Nav modes may retain arrow or character
                      keys. The native position, x and y controls remain
                      available. You do not need to turn off your screen reader.
                    </p>
                  </section>
                </div>
              </details>
              <details className="definitions">
                <summary>Terms used in TIMUDS</summary>
                <dl className="term-list">
                  <div>
                    <dt>Sonification</dt>
                    <dd>Using sound to present information from data.</dd>
                  </div>
                  <div>
                    <dt>Axis domain</dt>
                    <dd>
                      The minimum and maximum numeric values for one axis.
                    </dd>
                  </div>
                  <div>
                    <dt>Pitch mapping</dt>
                    <dd>
                      The rule that converts a coordinate into a frequency.
                    </dd>
                  </div>
                  <div>
                    <dt>Arc-length traversal</dt>
                    <dd>Movement at an even spatial speed along the curve.</dd>
                  </div>
                  <div>
                    <dt>Open curve</dt>
                    <dd>A curve that ends at its final supplied point.</dd>
                  </div>
                  <div>
                    <dt>Closed curve</dt>
                    <dd>
                      A curve with a final segment back to its first point.
                    </dd>
                  </div>
                  <div>
                    <dt>Two-dimensional exploration</dt>
                    <dd>
                      Moving x and y independently without editing or following
                      the curve.
                    </dd>
                  </div>
                </dl>
              </details>
              <div className="accessibility-statement">
                <h3>Accessibility review status</h3>
                <p>
                  The latest code review is dated 23 July 2026. Automated tests
                  run in Chromium and include keyboard flows and representative
                  axe checks. No screen-reader, mobile-device or
                  disabled-participant test has been recorded yet. Those checks
                  remain required.
                </p>
                <p>
                  TIMUDS targets applicable WCAG 2.2 Level A and AA criteria.
                  This is a design target, not a claim of conformance. TIMUDS is
                  exploratory research software and has not been validated as
                  assistive technology or scientific instrumentation.
                </p>
              </div>
              <div className="limitation-note">
                <h3>Known limitations</h3>
                <p>
                  TIMUDS handles two dimensions and a basic CSV format. Its
                  instruments are synthetic. MIDI import extracts a sorted note
                  palette; it does not replay the file or reproduce its
                  instruments and timing. TIMUDS has not undergone perceptual,
                  clinical or scientific validation. Automated checks do not
                  establish WCAG conformance.
                </p>
                <p>
                  Found an accessibility problem?{' '}
                  <a href={issueUrl()} target="_blank" rel="noreferrer">
                    Open an accessibility issue in the project repository
                  </a>
                  . On a local preview this link opens GitHub's general issues
                  page.
                </p>
              </div>
            </section>
          </div>
        </details>
      </main>
      <dialog
        ref={helpDialogRef}
        className="keyboard-dialog"
        aria-labelledby="keyboard-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          closeKeyboardHelp();
        }}
        onClose={() => {
          if (helpOpen) closeKeyboardHelp();
        }}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Reference</p>
            <h2 id="keyboard-dialog-title" tabIndex={-1}>
              Keyboard help
            </h2>
          </div>
          <button type="button" onClick={closeKeyboardHelp}>
            Close
          </button>
        </div>
        <p>
          Current scope: <strong>{shortcutScope.replace('-', ' ')}</strong>.
          These commands work away from form controls and editable text.
        </p>
        <div className="keyboard-table-wrap">
          <table>
            <caption>Workspace commands</caption>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <kbd>Space</kbd>
                </th>
                <td>Play or hold</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>S</kbd>
                </th>
                <td>Stop all sound</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>R</kbd>
                </th>
                <td>Return to the start</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>Left</kbd> / <kbd>Right</kbd>
                </th>
                <td>Move 1%; add Shift to move 10%</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>Home</kbd>
                </th>
                <td>Move to the start</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>End</kbd>
                </th>
                <td>Move to the end of an open curve</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>Escape</kbd>
                </th>
                <td>Emergency stop outside controls; close this dialog here</td>
              </tr>
              <tr>
                <th scope="row">
                  <kbd>?</kbd>
                </th>
                <td>Open this help</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="fine-print">
          {requireAltForLetters
            ? 'Alt is currently required with S, R and ?.'
            : 'S, R and ? currently work without Alt.'}{' '}
          Screen-reader browse modes may keep character and arrow keys; every
          action also has a visible native control.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="stop-prominent"
            onClick={() => stopAllSound('Sound stopped from keyboard help.')}
            disabled={!audioEnabled}
          >
            Stop all sound
          </button>
          <button type="button" onClick={closeKeyboardHelp}>
            Close keyboard help
          </button>
        </div>
      </dialog>
      <footer>
        <p>TIMUDS / FIELD INSTRUMENT 01</p>
        <p>Runs in this browser. No data is sent.</p>
      </footer>
    </>
  );
}
