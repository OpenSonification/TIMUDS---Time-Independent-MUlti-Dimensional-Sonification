import axe from 'axe-core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

class MockAudioParam {
  value = 0;
  setTargetAtTime = vi.fn();
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

class MockAudioContext {
  static constructions = 0;
  state: AudioContextState = 'running';
  destination = new MockNode();
  currentTime = 0;
  constructor() {
    MockAudioContext.constructions += 1;
  }
  createGain = () => new MockGain();
  createDynamicsCompressor = () => new MockCompressor();
  createOscillator = () => new MockOscillator();
  createBiquadFilter = () => new MockFilter();
  createStereoPanner = () => new MockPanner();
  createPeriodicWave = () => ({}) as PeriodicWave;
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

beforeEach(() => {
  MockAudioContext.constructions = 0;
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
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Listen around/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Circle · preset')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Silent\. Audio has not started/).length,
    ).toBeGreaterThan(0);
    expect(MockAudioContext.constructions).toBe(0);
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
    await user.click(screen.getByRole('button', { name: /^▶ Play$/ }));
    expect(MockAudioContext.constructions).toBe(1);
    expect(screen.getAllByText(/^Playing$/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Hold$/ }));
    expect(
      screen.getAllByText(/Holding at current point/).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /Stop sound/ })[0]!);
    expect(screen.getAllByText(/Stopped\. Audio off/).length).toBeGreaterThan(
      0,
    );
    await user.click(screen.getByRole('button', { name: /Reset to start/ }));
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('supports workspace keyboard play, stepping and Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const plot = screen.getByRole('img', {
      name: 'Ordered two-dimensional curve',
    });
    plot.focus();
    await user.keyboard(' ');
    expect(screen.getAllByText(/^Playing$/).length).toBeGreaterThan(0);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('1.0%')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getAllByText(/Stopped\. Audio off/).length).toBeGreaterThan(
      0,
    );
  });

  it('updates visible coordinate and pitch data after a manual move', async () => {
    const user = userEvent.setup();
    render(<App />);
    const xValue = screen.getByText('X value').nextElementSibling;
    expect(xValue).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: '+5%' }));
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(xValue).not.toHaveTextContent(/^1$/);
    expect(screen.getByText('X pitch').nextElementSibling).toHaveTextContent(
      /Hz/,
    );
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
    expect(screen.getByRole('button', { name: /^▶ Play$/ })).toBeDisabled();
    expect(
      screen.getByRole('img', { name: 'Ordered two-dimensional curve' }),
    ).toBeInTheDocument();
    expect(screen.getByText('X value')).toBeInTheDocument();
  });

  it('has no serious or critical axe violations in the default and error states', async () => {
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
  });
});
