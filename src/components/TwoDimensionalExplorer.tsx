import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type {
  ExplorerStepName,
  ExplorerSteps,
} from '../core/keyboardNavigation';
import type { AxisKey, NumericDomain, Point } from '../core/types';

export type ExplorerListeningMode = 'sustained' | 'short' | 'on-demand';

interface TwoDimensionalExplorerProps {
  active: boolean;
  point: Point;
  domains: Record<AxisKey, NumericDomain>;
  steps: Record<AxisKey, ExplorerSteps>;
  stepName: ExplorerStepName;
  customStep: number;
  wasdEnabled: boolean;
  listeningMode: ExplorerListeningMode;
  previewDuration: number;
  audioAvailable: boolean;
  onEnter: () => void;
  onExit: () => void;
  onControllerKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onControllerBlur: () => void;
  onCoordinateChange: (axis: AxisKey, value: number) => void;
  onStepNameChange: (name: ExplorerStepName) => void;
  onCustomStepChange: (value: number) => void;
  onWasdChange: (enabled: boolean) => void;
  onListeningModeChange: (mode: ExplorerListeningMode) => void;
  onPreviewDurationChange: (seconds: number) => void;
  onHear: () => void;
  onAddToCurve: () => void;
  onMoveTraversalToNearest: () => void;
}

function inputStep(step: number): number {
  return step > 0 ? step : 0.001;
}

export function TwoDimensionalExplorer({
  active,
  point,
  domains,
  steps,
  stepName,
  customStep,
  wasdEnabled,
  listeningMode,
  previewDuration,
  audioAvailable,
  onEnter,
  onExit,
  onControllerKeyDown,
  onControllerBlur,
  onCoordinateChange,
  onStepNameChange,
  onCustomStepChange,
  onWasdChange,
  onListeningModeChange,
  onPreviewDurationChange,
  onHear,
  onAddToCurve,
  onMoveTraversalToNearest,
}: TwoDimensionalExplorerProps) {
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const controllerRef = useRef<HTMLDivElement>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (active && !wasActiveRef.current) controllerRef.current?.focus();
    wasActiveRef.current = active;
  }, [active]);

  function exitAndRestoreFocus(): void {
    onExit();
    window.setTimeout(() => enterButtonRef.current?.focus(), 0);
  }

  function handleControllerKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      exitAndRestoreFocus();
      return;
    }
    onControllerKeyDown(event);
  }

  return (
    <section
      id="keyboard-explorer"
      className="panel explorer-panel"
      aria-labelledby="explorer-title"
    >
      <div className="panel-heading">
        <div>
          <p className="step-label">02 · Independent coordinates</p>
          <h3 id="explorer-title">Two-dimensional keyboard explorer</h3>
        </div>
        {active ? (
          <button type="button" onClick={exitAndRestoreFocus}>
            Return to curve position
          </button>
        ) : (
          <button type="button" ref={enterButtonRef} onClick={onEnter}>
            Enter two-dimensional exploration
          </button>
        )}
      </div>
      <p id="explorer-intro">
        This mode changes x and y independently. It starts at the current curve
        coordinate and keeps the loaded curve unchanged.
      </p>
      <p className="mode-indicator">
        Mode: {active ? 'exploring the plane' : 'following the curve'}
      </p>

      <div
        ref={controllerRef}
        className={`plane-controller${active ? ' is-active' : ''}`}
        role="group"
        tabIndex={active ? 0 : -1}
        aria-labelledby="controller-title"
        aria-describedby="controller-instructions controller-screen-reader-note"
        aria-keyshortcuts={
          wasdEnabled
            ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Escape W A S D'
            : 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Escape'
        }
        onKeyDown={handleControllerKeyDown}
        onBlur={onControllerBlur}
      >
        <h4 id="controller-title">Plane movement controller</h4>
        <p id="controller-instructions">
          Left and Right change x. Up and Down change y. Shift uses the coarse
          step. Escape returns to the saved curve position.
        </p>
        <p className="controller-coordinate">
          x {point.x.toFixed(4)}
          <span aria-hidden="true"> / </span>
          <span className="sr-only">, </span>y {point.y.toFixed(4)}
        </p>
        {!active && (
          <p className="fine-print">
            Activate exploration before using this controller or its coordinate
            controls.
          </p>
        )}
      </div>

      <div className="native-coordinate-grid">
        {(['x', 'y'] as const).map((axis) => (
          <fieldset key={axis} className={`coordinate-field axis-${axis}`}>
            <legend>{axis.toUpperCase()} coordinate</legend>
            <p id={`${axis}-coordinate-help`} className="fine-print">
              Minimum {domains[axis].minimum.toFixed(4)}. Maximum{' '}
              {domains[axis].maximum.toFixed(4)}. Fine step{' '}
              {steps[axis].fine.toFixed(4)}. Standard step{' '}
              {steps[axis].standard.toFixed(4)}. Coarse step{' '}
              {steps[axis].coarse.toFixed(4)}.
            </p>
            <label htmlFor={`explorer-${axis}-range`}>
              {axis.toUpperCase()} coordinate slider
            </label>
            <input
              id={`explorer-${axis}-range`}
              type="range"
              min={domains[axis].minimum}
              max={domains[axis].maximum}
              step={inputStep(steps[axis].fine)}
              value={point[axis]}
              disabled={!active}
              aria-describedby={`${axis}-coordinate-help`}
              onChange={(event) =>
                onCoordinateChange(axis, event.currentTarget.valueAsNumber)
              }
            />
            <label htmlFor={`explorer-${axis}-number`}>
              {axis.toUpperCase()} coordinate
            </label>
            <input
              id={`explorer-${axis}-number`}
              type="number"
              min={domains[axis].minimum}
              max={domains[axis].maximum}
              step={inputStep(steps[axis].fine)}
              value={point[axis]}
              disabled={!active}
              aria-describedby={`${axis}-coordinate-help`}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value)) onCoordinateChange(axis, value);
              }}
            />
          </fieldset>
        ))}
      </div>

      <fieldset className="explorer-settings">
        <legend>Exploration controls</legend>
        <div className="field-grid">
          <label htmlFor="explorer-step">Arrow-key step size</label>
          <select
            id="explorer-step"
            value={stepName}
            onChange={(event) =>
              onStepNameChange(event.currentTarget.value as ExplorerStepName)
            }
          >
            <option value="fine">Fine</option>
            <option value="standard">Standard</option>
            <option value="coarse">Coarse</option>
            <option value="custom">Custom</option>
          </select>
          <label htmlFor="custom-explorer-step">Custom coordinate step</label>
          <input
            id="custom-explorer-step"
            type="number"
            min="0.000001"
            step="0.001"
            value={customStep}
            disabled={stepName !== 'custom'}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) onCustomStepChange(value);
            }}
          />
          <label htmlFor="explorer-listening">Movement listening</label>
          <select
            id="explorer-listening"
            value={listeningMode}
            onChange={(event) =>
              onListeningModeChange(
                event.currentTarget.value as ExplorerListeningMode,
              )
            }
          >
            <option value="short">Short preview after movement</option>
            <option value="sustained">Sustained sound</option>
            <option value="on-demand">
              Only when Hear current position is used
            </option>
          </select>
          <label htmlFor="preview-duration">Short preview duration</label>
          <input
            id="preview-duration"
            type="number"
            min="0.1"
            max="3"
            step="0.1"
            value={previewDuration}
            disabled={listeningMode !== 'short'}
            onChange={(event) =>
              onPreviewDurationChange(
                Math.min(
                  3,
                  Math.max(0.1, event.currentTarget.valueAsNumber || 0.6),
                ),
              )
            }
          />
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={wasdEnabled}
            onChange={(event) => onWasdChange(event.currentTarget.checked)}
          />{' '}
          Enable WASD in the two-dimensional explorer
        </label>
        <p className="fine-print">
          When enabled and the controller has focus, W increases y, A decreases
          x, S decreases y and D increases x. WASD is inactive everywhere else.
        </p>
      </fieldset>

      <div className="button-row explorer-actions">
        <button type="button" onClick={onHear} disabled={!audioAvailable}>
          Hear current position
        </button>
        <button type="button" onClick={onAddToCurve} disabled={!active}>
          Add this coordinate to the curve
        </button>
        <button
          type="button"
          onClick={onMoveTraversalToNearest}
          disabled={!active}
        >
          Move curve traversal to nearest point
        </button>
        {active && (
          <button type="button" onClick={exitAndRestoreFocus}>
            Return to curve position
          </button>
        )}
      </div>
      <p id="controller-screen-reader-note" className="fine-print">
        Screen readers may use arrow or character keys in browse or Quick Nav
        modes. The native x and y sliders and number inputs provide the same
        coordinate changes with conventional form controls.
      </p>
    </section>
  );
}
