import axe from 'axe-core';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

class MockAudioParam {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}

class MockNode {
  connect<T>(node: T): T {
    return node;
  }
  disconnect = vi.fn();
}

class MockOscillator extends MockNode {
  frequency = new MockAudioParam();
  detune = new MockAudioParam();
  type: OscillatorType = 'sine';
  start = vi.fn();
  stop = vi.fn();
  setPeriodicWave = vi.fn();
}

class MockGain extends MockNode {
  gain = new MockAudioParam();
}

class MockFilter extends MockNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
}

class MockPanner extends MockNode {
  pan = new MockAudioParam();
}

class MockCompressor extends MockNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}

class MockBufferSource extends MockNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  static constructions = 0;
  state: AudioContextState = 'running';
  destination = new MockNode();
  currentTime = 0;
  sampleRate = 48_000;
  constructor() {
    MockAudioContext.constructions += 1;
  }
  createGain = () => new MockGain();
  createDynamicsCompressor = () => new MockCompressor();
  createOscillator = () => new MockOscillator();
  createBiquadFilter = () => new MockFilter();
  createStereoPanner = () => new MockPanner();
  createPeriodicWave = () => ({}) as PeriodicWave;
  createBuffer = (_channels: number, length: number) =>
    ({
      getChannelData: () => new Float32Array(length),
    }) as unknown as AudioBuffer;
  createBufferSource = () => new MockBufferSource();
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

function installAudioMock(): void {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: MockAudioContext,
  });
}

function midiFile(name = 'major-triad.mid'): File {
  const track = [
    0, 0x90, 60, 100, 0, 0x90, 64, 100, 0, 0x90, 67, 100, 0, 0xff, 0x2f, 0,
  ];
  return new File(
    [
      new Uint8Array([
        0x4d,
        0x54,
        0x68,
        0x64,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        1,
        0,
        96,
        0x4d,
        0x54,
        0x72,
        0x6b,
        0,
        0,
        0,
        track.length,
        ...track,
      ]),
    ],
    name,
    { type: 'audio/midi' },
  );
}

beforeEach(() => {
  MockAudioContext.constructions = 0;
  window.localStorage.clear();
  installAudioMock();
});

afterEach(() => {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: undefined,
  });
});

describe('TIMUDS workspace', () => {
  it('loads the circle in a silent state without creating audio', () => {
    const { container } = render(<App />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Hear a curve in two dimensions/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Circle · preset')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Ready\. Audio has not started/).length,
    ).toBeGreaterThan(0);
    expect(MockAudioContext.constructions).toBe(0);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'Skip to current position' }),
    ).toHaveAttribute('href', '#current-position');
    expect(screen.getByLabelText('Position along curve')).toHaveAttribute(
      'type',
      'range',
    );
    expect(screen.getByLabelText('X coordinate slider')).toBeInTheDocument();
    expect(screen.getByText('Additional keyboard notes')).toBeInTheDocument();
    const ids = [...container.querySelectorAll('[id]')].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('loads a selected preset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(
      screen.getByLabelText('Curve preset'),
      'Lissajous curve',
    );
    await user.click(screen.getByRole('button', { name: 'Load preset' }));
    expect(screen.getByText('Lissajous curve · preset')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();
  });

  it('focuses a useful error summary while preserving malformed input', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText('Coordinate data');
    await user.clear(input);
    await user.type(input, 'x,y{enter}0,0{enter}bad,1');
    await user.click(
      screen.getByRole('button', { name: 'Import pasted coordinates' }),
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent(/Line 3, x must be a finite number/);
    expect(input).toHaveValue('x,y\n0,0\nbad,1');
  });

  it('plays, holds, stops and resets only after user action', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(MockAudioContext.constructions).toBe(1);
    expect(screen.getAllByText(/^Playing$/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Hold' }));
    expect(
      screen.getAllByText(/Holding at current point/).length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getAllByRole('button', { name: 'Stop all sound' })[0]!,
    );
    expect(screen.getAllByText(/^Stopped$/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Reset traversal' }));
    expect(screen.getByText(/Normalised progress: 0\.000/)).toBeInTheDocument();
  });

  it('starts in Spatial voice and keeps X and Y independently readable', () => {
    render(<App />);
    expect(screen.getByLabelText('Spatial voice')).toBeChecked();
    expect(screen.getByLabelText('Axis voices')).not.toBeChecked();
    const readout = within(
      document.querySelector<HTMLElement>('#current-position')!,
    );
    expect(readout.getByText('X').nextElementSibling).toHaveTextContent('1');
    expect(readout.getByText('Y').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByLabelText(/Stereo width/)).toHaveValue('0.75');
    expect(screen.getByLabelText(/Blend hollow and bright/)).toBeChecked();
    expect(screen.getByLabelText('Progress tick')).toHaveValue('12.5');
    expect(readout.getByText('Y sign').nextElementSibling).toHaveTextContent(
      'Zero',
    );
    expect(screen.queryByRole('group', { name: 'X-axis voice' })).toBeNull();
  });

  it('uses separated Axis voice defaults and offers a one-step overlap repair', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Axis voices'));
    const xVoice = screen.getByRole('group', { name: 'X-axis voice' });
    const yVoice = screen.getByRole('group', { name: 'Y-axis voice' });
    expect(within(xVoice).getByLabelText('Low MIDI note')).toHaveValue(48);
    expect(within(xVoice).getByLabelText('High MIDI note')).toHaveValue(60);
    expect(within(yVoice).getByLabelText('Low MIDI note')).toHaveValue(67);
    expect(within(yVoice).getByLabelText('High MIDI note')).toHaveValue(79);

    fireEvent.change(within(xVoice).getByLabelText('High MIDI note'), {
      target: { value: '70' },
    });
    expect(
      screen.getByText(/X and Y pitch ranges overlap/i),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Restore separated ranges' }),
    );
    expect(within(xVoice).getByLabelText('High MIDI note')).toHaveValue(60);
    expect(
      screen.queryByText(/X and Y pitch ranges overlap/i),
    ).not.toBeInTheDocument();
  });

  it('switches to centred Axis voices when mono compatibility is enabled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Mono-compatible output'));
    expect(screen.getByLabelText('Axis voices')).toBeChecked();
    expect(screen.getByLabelText('Spatial voice')).toBeDisabled();
    expect(
      screen.getByRole('group', { name: 'X-axis voice' }),
    ).toBeInTheDocument();
  });

  it('restores validated sound and shortcut preferences without audio state', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(screen.getByLabelText('Axis voices'));
    await user.selectOptions(
      screen.getByLabelText('Shortcut scope'),
      'site-wide',
    );
    await waitFor(() =>
      expect(window.localStorage.getItem('timuds.preferences')).toContain(
        '"site-wide"',
      ),
    );
    first.unmount();

    render(<App />);
    expect(screen.getByLabelText('Axis voices')).toBeChecked();
    expect(screen.getByLabelText('Shortcut scope')).toHaveValue('site-wide');
    expect(MockAudioContext.constructions).toBe(0);
    expect(window.localStorage.getItem('timuds.preferences')).not.toContain(
      '"transport"',
    );
  });

  it('opens shortcut help, restores focus and leaves editable controls alone', async () => {
    const user = userEvent.setup();
    render(<App />);
    const helpButton = screen.getAllByRole('button', {
      name: 'Keyboard help',
    })[0]!;
    await user.click(helpButton);
    expect(
      screen.getByRole('dialog', { name: 'Keyboard help' }),
    ).toHaveAttribute('open');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Close keyboard help',
      }),
    );
    await waitFor(() => expect(helpButton).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Play' }));
    const input = screen.getByLabelText('Coordinate data');
    await user.click(input);
    await user.keyboard('s');
    expect((input as HTMLTextAreaElement).value).toContain('s');
    expect(screen.getAllByText(/^Playing$/).length).toBeGreaterThan(0);

    fireEvent.keyDown(document.querySelector('.workspace-grid')!, {
      key: 's',
    });
    expect(screen.getAllByText(/^Stopped$/).length).toBeGreaterThan(0);
  });

  it('keeps native controls and applies guarded workspace shortcuts', async () => {
    const user = userEvent.setup();
    render(<App />);
    const slider = screen.getByLabelText('Position along curve');
    fireEvent.change(slider, { target: { value: '0.01' } });
    expect(slider).toHaveValue('0.01');
    const plot = screen.getByRole('img', {
      name: 'Ordered two-dimensional curve',
    });
    expect(plot).not.toHaveAttribute('tabindex');
    document.body.focus();
    await user.keyboard('{ArrowRight}');
    expect(slider).toHaveValue('0.02');
  });

  it('updates visible coordinate and pitch data after a manual move', async () => {
    const user = userEvent.setup();
    render(<App />);
    const xValue = screen.getByText('X value').nextElementSibling;
    expect(xValue).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: 'Step forwards' }));
    expect(screen.getByText(/Normalised progress: 0\.010/)).toBeInTheDocument();
    expect(xValue).not.toHaveTextContent(/^1$/);
    expect(
      screen.getByText('X frequency').nextElementSibling,
    ).toHaveTextContent(/Hz/);
  });

  it('explores x and y independently and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole('button', {
        name: 'Enter two-dimensional exploration',
      }),
    );
    const controller = screen.getByRole('group', {
      name: 'Plane movement controller',
    });
    expect(controller).toHaveFocus();
    const xValue = screen.getByText('X value').nextElementSibling;
    const yValue = screen.getByText('Y value').nextElementSibling;
    expect(xValue).toHaveTextContent('1');
    expect(yValue).toHaveTextContent('0');
    await user.keyboard('{ArrowLeft}');
    expect(xValue).toHaveTextContent('0.95');
    expect(yValue).toHaveTextContent('0');
    await user.keyboard('{ArrowUp}');
    expect(yValue).toHaveTextContent('0.05');
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(xValue).toHaveTextContent('0.75');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Enter two-dimensional exploration',
        }),
      ).toHaveFocus(),
    );
    expect(screen.getAllByText('Following curve').length).toBeGreaterThan(0);
  });

  it('keeps WASD off by default and scoped to the focused explorer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole('button', {
        name: 'Enter two-dimensional exploration',
      }),
    );
    const controller = screen.getByRole('group', {
      name: 'Plane movement controller',
    });
    const yValue = screen.getByText('Y value').nextElementSibling;
    await user.keyboard('w');
    expect(yValue).toHaveTextContent('0');
    await user.click(
      screen.getByLabelText('Enable WASD in the two-dimensional explorer'),
    );
    controller.focus();
    await user.keyboard('w');
    expect(yValue).toHaveTextContent('0.05');
    const coordinateText = screen.getByLabelText('Coordinate data');
    await user.click(coordinateText);
    await user.keyboard('wasd');
    expect((coordinateText as HTMLTextAreaElement).value).toContain('wasd');
  });

  it('adds an explorer coordinate only after the visible action', async () => {
    const user = userEvent.setup();
    render(<App />);
    const pointCount = screen.getByText('Points', {
      selector: '.curve-summary dt',
    }).nextElementSibling;
    expect(pointCount).toHaveTextContent('128');
    await user.click(
      screen.getByRole('button', {
        name: 'Enter two-dimensional exploration',
      }),
    );
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(pointCount).toHaveTextContent('128');
    await user.click(
      screen.getByRole('button', {
        name: 'Add this coordinate to the curve',
      }),
    );
    expect(pointCount).toHaveTextContent('129');
  });

  it('selects independent instruments and imports a local MIDI note map silently', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Axis voices'));
    const xVoice = screen.getByRole('group', { name: 'X-axis voice' });
    const yVoice = screen.getByRole('group', { name: 'Y-axis voice' });

    await user.selectOptions(
      within(xVoice).getByLabelText('Instrument sound'),
      'trumpet',
    );
    await user.selectOptions(
      within(yVoice).getByLabelText('Instrument sound'),
      'drum',
    );
    expect(within(xVoice).getByLabelText('Instrument sound')).toHaveValue(
      'trumpet',
    );
    expect(within(yVoice).getByLabelText('Instrument sound')).toHaveValue(
      'drum',
    );

    await user.upload(
      within(xVoice).getByLabelText('MIDI file for x-axis'),
      midiFile(),
    );
    await waitFor(() =>
      expect(
        within(xVoice).getByText(/3 distinct notes from 3 note-on events/i),
      ).toBeInTheDocument(),
    );
    expect(within(xVoice).getByLabelText('Low MIDI note')).toBeDisabled();
    expect(within(xVoice).getByLabelText('High MIDI note')).toBeDisabled();
    expect(screen.getByText('X note').nextElementSibling).toHaveTextContent(
      'G4',
    );
    await user.upload(
      within(yVoice).getByLabelText('MIDI file for y-axis'),
      midiFile('y-major-triad.midi'),
    );
    await waitFor(() =>
      expect(
        within(yVoice).getByText(/3 distinct notes from 3 note-on events/i),
      ).toBeInTheDocument(),
    );
    expect(within(yVoice).getByLabelText('Low MIDI note')).toBeDisabled();
    expect(screen.getByText('Y note').nextElementSibling).toHaveTextContent(
      'E4',
    );
    expect(MockAudioContext.constructions).toBe(0);

    await user.click(
      within(xVoice).getByRole('button', {
        name: 'Remove X MIDI note map',
      }),
    );
    expect(within(xVoice).getByLabelText('Low MIDI note')).toBeEnabled();
    expect(
      within(xVoice).queryByText(/3 distinct notes from 3 note-on events/i),
    ).not.toBeInTheDocument();
  });

  it('associates a malformed MIDI error with the correct axis file input', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Axis voices'));
    const yVoice = screen.getByRole('group', { name: 'Y-axis voice' });
    const input = within(yVoice).getByLabelText('MIDI file for y-axis');
    await user.upload(
      input,
      new File([new Uint8Array([1, 2, 3, 4])], 'broken.mid', {
        type: 'audio/midi',
      }),
    );
    const alert = await within(yVoice).findByRole('alert');
    expect(alert).toHaveTextContent(/MThd header is missing/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-errormessage', alert.id);
    expect(MockAudioContext.constructions).toBe(0);
  });

  it('keeps inspection usable when Web Audio is unavailable', () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    render(<App />);
    expect(
      screen.getByText(/This browser has no Web Audio support/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(
      screen.getByRole('img', { name: 'Ordered two-dimensional curve' }),
    ).toBeInTheDocument();
    expect(screen.getByText('X value')).toBeInTheDocument();
    expect(screen.getByLabelText('X coordinate slider')).toBeDisabled();
    expect(
      screen.getByText(/current-position section remains selectable/i),
    ).toBeInTheDocument();
  });

  it('has no serious or critical axe violations in representative states', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    let results = await axe.run(container, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
    expect(
      results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    await user.click(
      screen.getByRole('button', {
        name: 'Enter two-dimensional exploration',
      }),
    );
    results = await axe.run(container, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
    expect(
      results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    const input = screen.getByLabelText('Coordinate data');
    await user.clear(input);
    await user.type(input, 'broken');
    await user.click(
      screen.getByRole('button', { name: 'Import pasted coordinates' }),
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    results = await axe.run(container, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
    expect(
      results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
  }, 15_000);
});
