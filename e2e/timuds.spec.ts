import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function mockAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class Parameter {
      value = 0;
      calls: string[] = [];
      setTargetAtTime(value: number): void {
        this.value = value;
        this.calls.push('target');
      }
      setValueAtTime(value: number): void {
        this.value = value;
        this.calls.push('value');
      }
      linearRampToValueAtTime(value: number): void {
        this.value = value;
        this.calls.push('linear');
      }
      exponentialRampToValueAtTime(value: number): void {
        this.value = value;
        this.calls.push('exponential');
      }
      cancelScheduledValues(): void {
        this.calls.push('cancel');
      }
    }
    class Node {
      connect<T>(destination: T): T {
        return destination;
      }
      disconnect(): void {}
    }
    class Oscillator extends Node {
      frequency = new Parameter();
      detune = new Parameter();
      type = 'sine';
      start(): void {}
      stop(): void {}
      setPeriodicWave(): void {}
    }
    class Gain extends Node {
      gain = new Parameter();
    }
    class Filter extends Node {
      type = 'lowpass';
      frequency = new Parameter();
      Q = new Parameter();
    }
    class Panner extends Node {
      pan = new Parameter();
    }
    class Compressor extends Node {
      threshold = new Parameter();
      knee = new Parameter();
      ratio = new Parameter();
      attack = new Parameter();
      release = new Parameter();
    }
    class BufferSource extends Node {
      buffer: object | null = null;
      loop = false;
      playbackRate = new Parameter();
      start(): void {}
      stop(): void {}
    }
    class InstrumentedAudioContext {
      state = 'running';
      destination = new Node();
      sampleRate = 48_000;
      gains: Gain[] = [];
      private started = performance.now();
      get currentTime(): number {
        return (performance.now() - this.started) / 1000;
      }
      createGain(): Gain {
        const gain = new Gain();
        this.gains.push(gain);
        return gain;
      }
      createDynamicsCompressor(): Compressor {
        return new Compressor();
      }
      createOscillator(): Oscillator {
        return new Oscillator();
      }
      createBiquadFilter(): Filter {
        return new Filter();
      }
      createStereoPanner(): Panner {
        return new Panner();
      }
      createPeriodicWave(): object {
        return {};
      }
      createBuffer(_channels: number, length: number): object {
        return {
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource(): BufferSource {
        return new BufferSource();
      }
      decodeAudioData(): Promise<object> {
        return Promise.resolve({
          duration: 1.25,
          numberOfChannels: 2,
          sampleRate: 48_000,
        });
      }
      resume(): Promise<void> {
        return Promise.resolve();
      }
      close(): Promise<void> {
        this.state = 'closed';
        return Promise.resolve();
      }
      constructor() {
        (
          window as typeof window & {
            __timudsAudio?: InstrumentedAudioContext;
          }
        ).__timudsAudio = this;
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      value: InstrumentedAudioContext,
      configurable: true,
    });

    class SpokenUtterance {
      lang = '';
      pitch = 1;
      rate = 1;
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      volume = 1;

      constructor(text: string) {
        this.text = text;
      }
    }
    const speechLog = {
      cancellations: 0,
      spoken: [] as string[],
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: SpokenUtterance,
      configurable: true,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel: () => {
          speechLog.cancellations += 1;
        },
        getVoices: () => [],
        speak: (utterance: SpokenUtterance) => {
          speechLog.spoken.push(utterance.text);
        },
      },
      configurable: true,
    });
    (
      window as typeof window & {
        __timudsSpeech?: typeof speechLog;
      }
    ).__timudsSpeech = speechLog;
  });
}

function seriousViolations(
  results: Awaited<ReturnType<AxeBuilder['analyze']>>,
) {
  return results.violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );
}

function midiUpload(name = 'major-triad.mid') {
  const track = [
    0, 0x90, 60, 100, 0, 0x90, 64, 100, 0, 0x90, 67, 100, 0, 0xff, 0x2f, 0,
  ];
  return {
    name,
    mimeType: 'audio/midi',
    buffer: Buffer.from([
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
  };
}

function audioSampleUpload(name = 'piano.mp3') {
  return {
    name,
    mimeType: 'audio/mpeg',
    buffer: Buffer.from([1, 2, 3, 4]),
  };
}

test.beforeEach(async ({ page }) => {
  await mockAudioContext(page);
  await page.goto('/');
});

test('loads silently, exposes skip links and uses relative production assets', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Hear a curve in two dimensions/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Ready\. Audio has not started/).first(),
  ).toBeVisible();
  await expect(page.locator('svg[role="img"] path.curve-line')).toHaveAttribute(
    'd',
    /Z$/,
  );
  await expect(page.locator('script[type="module"]')).toHaveAttribute(
    'src',
    /^\.\/assets\//,
  );
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', {
    name: 'Skip to the TIMUDS workspace',
  });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('#curve-controls > summary').click();
  await expect(page.getByText('Circle · preset')).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('enables audio deliberately and operates the complete transport', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Enable audio' }).click();
  await page.getByText('Technical details').click();
  await expect(page.getByText('Audio sounding').locator('..')).toContainText(
    'No',
  );
  await expect(page.getByLabel('Voice over')).not.toBeChecked();
  await page.getByLabel('Voice over').check();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText(/^Playing$/).first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __timudsSpeech?: { spoken: string[] };
            }
          ).__timudsSpeech?.spoken,
      ),
    )
    .toContain('Highest X coordinate. X 1. Y 0.');
  const holdButton = page.getByRole('button', { name: 'Hold' });
  await holdButton.click();
  await expect(
    page.getByText(/Holding at current point/).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Move to start' }).click();
  const stepForwardButton = page.getByRole('button', {
    name: 'Step forwards',
  });
  await stepForwardButton.click();
  await expect(page.getByLabel('Position along curve')).toHaveValue('0.01');
  await expect(stepForwardButton).toBeFocused();
  await page.keyboard.press('Shift+R');
  await expect(page.getByLabel('Position along curve')).toHaveValue('0');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText(/^Playing$/).first()).toBeVisible();
  await stepForwardButton.click();
  await expect(stepForwardButton).toBeFocused();
  await page.keyboard.press('Shift+S');
  await expect(page.getByText(/^Stopped$/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Stop all sound' }).first().click();
  await expect(page.getByText('Audio sounding').locator('..')).toContainText(
    'No',
  );
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('switches sound modes safely and exposes guarded keyboard help', async ({
  page,
}) => {
  await page.locator('#sound-controls > summary').click();
  await expect(page.getByLabel('Spatial voice')).toBeChecked();
  await expect(page.getByLabel(/Stereo width/)).toHaveValue('0.75');

  await page.getByLabel('Axis voices').check();
  const xVoice = page.getByRole('group', { name: 'X-axis voice' });
  const yVoice = page.getByRole('group', { name: 'Y-axis voice' });
  await expect(xVoice.getByLabel('Instrument sound')).toHaveValue('warm');
  await expect(yVoice.getByLabel('Instrument sound')).toHaveValue('reed');
  await expect(xVoice.getByLabel('Low MIDI note')).toHaveValue('60');
  await expect(yVoice.getByLabel('Low MIDI note')).toHaveValue('60');
  await expect(xVoice.getByLabel(/Listening gain/)).toHaveValue('0.76');
  await expect(yVoice.getByLabel(/Listening gain/)).toHaveValue('0.76');
  await yVoice.getByLabel('Instrument sound').selectOption('warm');
  await expect(
    page.getByText(/same instrument across overlapping pitch ranges/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Restore contrasting sounds' })
    .click();
  await expect(yVoice.getByLabel('Instrument sound')).toHaveValue('reed');
  await expect(
    page.getByText(/same instrument across overlapping pitch ranges/),
  ).toHaveCount(0);

  await page.getByLabel('Spatial voice').check();
  await page.getByLabel('Mono-compatible output').check();
  await expect(page.getByLabel('Axis voices')).toBeChecked();
  await expect(page.getByLabel('Spatial voice')).toBeDisabled();

  const help = page.getByRole('button', { name: 'Keyboard help' }).first();
  await help.click();
  const dialog = page.getByRole('dialog', { name: 'Keyboard help' });
  await expect(dialog).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
  await dialog.getByRole('button', { name: 'Close keyboard help' }).click();
  await expect(help).toBeFocused();

  const workspaceTarget = page.locator('.workspace-grid');
  await workspaceTarget.dispatchEvent('keydown', {
    key: ' ',
    code: 'Space',
    bubbles: true,
  });
  await expect(page.getByText(/^Playing$/).first()).toBeVisible();
  await workspaceTarget.dispatchEvent('keydown', {
    key: ' ',
    code: 'Space',
    bubbles: true,
  });
  await expect(
    page.getByText(/Holding at current point/).first(),
  ).toBeVisible();
  await workspaceTarget.dispatchEvent('keydown', {
    key: 's',
    code: 'KeyS',
    bubbles: true,
  });
  await expect(page.getByText(/^Stopped$/).first()).toBeVisible();
  const masterCalls = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __timudsAudio?: { gains: Array<{ gain: { calls: string[] } }> };
        }
      ).__timudsAudio?.gains[0]?.gain.calls ?? [],
  );
  expect(masterCalls).toContain('cancel');
  expect(masterCalls).toContain('linear');
});

test('imports a triangle and exposes validation errors accessibly', async ({
  page,
}) => {
  await page.locator('#curve-controls > summary').click();
  await page.getByText('Paste or upload coordinate data').click();
  const text = page.getByLabel('Coordinate data');
  await text.fill('x,y\n0,1\n-1,-1\n1,-1');
  await page.getByRole('button', { name: 'Import pasted coordinates' }).click();
  await expect(page.getByText('Imported coordinates · text')).toBeVisible();
  await expect(page.getByText('3').first()).toBeVisible();
  await text.fill('x,y\n0,0\nwrong,1');
  await page.getByRole('button', { name: 'Import pasted coordinates' }).click();
  await expect(page.getByRole('alert')).toBeFocused();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('creates a freehand curve with pointer input', async ({ page }) => {
  await page.locator('#curve-controls > summary').click();
  await page.getByText('Freehand drawing').click();
  await page.getByRole('button', { name: 'Start drawing' }).click();
  const plot = page.getByRole('img', { name: 'Ordered two-dimensional curve' });
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.25, {
    steps: 8,
  });
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.65, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(
    page.getByText(/Drawing mode active: (?!0 )\d+ raw points captured/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish drawing' }).click();
  await expect(page.getByText('Freehand curve · drawing')).toBeVisible();
});

test('uses the native follow-curve slider with standard keyboard behaviour', async ({
  page,
}) => {
  const slider = page.getByLabel('Position along curve');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('0.01');
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('0');
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('1');
  await page.getByLabel('Curve preset').focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1');
});

test('explores x and y independently with focus-scoped arrows', async ({
  page,
}) => {
  await page.locator('#sound-controls > summary').click();
  await page.getByLabel('Axis voices').check();
  await page.selectOption('#axis-x-timbre', 'bright');
  await expect(page.locator('#axis-x-timbre')).toHaveValue('bright');
  await page.getByLabel('Mono-compatible output').check();
  await page.locator('#advanced-controls > summary').click();
  await page
    .getByRole('button', { name: 'Enter two-dimensional exploration' })
    .click();
  const controller = page.getByRole('group', {
    name: 'Plane movement controller',
  });
  await expect(controller).toBeFocused();
  const xValue = page.getByText('X value').locator('..').locator('dd');
  const yValue = page.getByText('Y value').locator('..').locator('dd');
  await expect(xValue).toHaveText('1');
  await expect(yValue).toHaveText('0');
  await page.keyboard.press('ArrowLeft');
  await expect(xValue).toHaveText('0.95');
  await expect(yValue).toHaveText('0');
  await page.keyboard.press('ArrowUp');
  await expect(yValue).toHaveText('0.05');
  await page.getByText('Advanced Y mapping').click();
  await page
    .getByRole('group', { name: 'Y-axis voice' })
    .getByLabel('Invert pitch direction')
    .check();
  await controller.focus();
  await page.keyboard.press('ArrowUp');
  await expect(yValue).toHaveText('0.1');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(xValue).toHaveText('0.75');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Enter two-dimensional exploration' }),
  ).toBeFocused();
  await expect(
    page
      .locator('#current-position .position-summary')
      .getByText('Navigation', { exact: true })
      .locator('..'),
  ).toContainText('Following curve');
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('selects independent instruments and imports a local MIDI note map', async ({
  page,
}) => {
  await page.locator('#sound-controls > summary').click();
  await page.getByLabel('Axis voices').check();
  const valueMapping = page.getByLabel('What the coordinate value changes');
  await expect(valueMapping).toHaveValue('pitch');
  await expect(valueMapping.locator('option')).toHaveCount(4);
  await valueMapping.selectOption('volume');
  await expect(
    page
      .locator('#current-position .position-summary')
      .getByText('Value mapping')
      .locator('..'),
  ).toContainText('Volume');
  await expect(
    page
      .locator('#current-position .position-summary')
      .getByText('X volume')
      .locator('..'),
  ).toContainText('100%');
  await expect(
    page
      .locator('#current-position .position-summary')
      .getByText('Y volume')
      .locator('..'),
  ).toContainText('55%');
  await expect(page.getByText('Audio enabled').locator('..')).toContainText(
    'No',
  );
  await valueMapping.selectOption('pitch');
  await page.getByText('Technical details').click();
  const xVoice = page.getByRole('group', { name: 'X-axis voice' });
  const yVoice = page.getByRole('group', { name: 'Y-axis voice' });

  await xVoice.getByLabel('Instrument sound').selectOption('trumpet');
  await yVoice.getByLabel('Instrument sound').selectOption('drum');
  await expect(xVoice.getByLabel('Instrument sound')).toHaveValue('trumpet');
  await expect(yVoice.getByLabel('Instrument sound')).toHaveValue('drum');
  await expect(
    yVoice.getByLabel('Instrument sound').locator('option'),
  ).toHaveCount(16);

  await xVoice.getByLabel('MIDI file for x-axis').setInputFiles(midiUpload());
  await expect(xVoice.locator('.midi-map-summary')).toContainText(
    '3 distinct notes from 3 note-on events',
  );
  await expect(xVoice.getByLabel('Low MIDI note')).toBeDisabled();
  await expect(xVoice.getByLabel('High MIDI note')).toBeDisabled();
  await expect(page.getByText('X note').locator('..').locator('dd')).toHaveText(
    'G4',
  );
  await expect(page.getByText('Audio enabled').locator('..')).toContainText(
    'No',
  );
  await expect(page.getByLabel(/Test sound length/)).toHaveValue('2');
  await xVoice
    .getByLabel('Audio sample for x-axis')
    .setInputFiles(audioSampleUpload());
  await expect(xVoice.locator('.audio-sample-summary')).toContainText(
    'piano.mp3: decoded locally, 1.25 seconds',
  );
  await expect(xVoice.getByLabel('Instrument sound')).toBeDisabled();
  await xVoice.getByLabel('Original sample note').fill('64');
  await expect(xVoice.locator('.audio-sample-summary')).toContainText(
    'MIDI 64, E4',
  );
  await xVoice.getByRole('button', { name: 'Test X' }).click();
  await expect(
    page.getByText(/X voice playing Held note for 2\.0 seconds/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Stop all sound' }).first().click();
  await xVoice.getByRole('button', { name: 'Remove X uploaded sound' }).click();
  await expect(xVoice.getByLabel('Instrument sound')).toBeEnabled();

  await page.getByLabel('Test pattern').selectOption('clave');
  await yVoice.getByRole('button', { name: 'Test Y' }).click();
  await expect(
    page.getByText(/Y voice playing Son-clave pulse for 2\.0 seconds/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Stop all sound' }).first().click();
  await expect(page.getByText('Audio sounding').locator('..')).toContainText(
    'No',
  );

  await yVoice
    .getByLabel('MIDI file for y-axis')
    .setInputFiles(midiUpload('y-major-triad.midi'));
  await expect(yVoice.locator('.midi-map-summary')).toContainText(
    '3 distinct notes from 3 note-on events',
  );
  await expect(yVoice.getByLabel('Low MIDI note')).toBeDisabled();

  await yVoice.getByLabel('MIDI file for y-axis').setInputFiles({
    name: 'broken.mid',
    mimeType: 'audio/midi',
    buffer: Buffer.from([1, 2, 3, 4]),
  });
  await expect(yVoice.getByRole('alert')).toContainText(
    'MThd header is missing',
  );
  await expect(yVoice.getByLabel('MIDI file for y-axis')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(yVoice.locator('.midi-map-summary')).toContainText(
    'y-major-triad.midi',
  );

  await xVoice.getByRole('button', { name: 'Remove X MIDI note map' }).click();
  await expect(xVoice.getByLabel('Low MIDI note')).toBeEnabled();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('leaves the explorer with Tab and keeps optional WASD scoped', async ({
  page,
}) => {
  await page.locator('#advanced-controls > summary').click();
  await page
    .getByRole('button', { name: 'Enter two-dimensional exploration' })
    .click();
  const controller = page.getByRole('group', {
    name: 'Plane movement controller',
  });
  const yValue = page.getByText('Y value').locator('..').locator('dd');
  await page.keyboard.type('w');
  await expect(yValue).toHaveText('0');
  await page.getByLabel('Enable WASD in the two-dimensional explorer').check();
  await controller.focus();
  await page.keyboard.type('w');
  await expect(yValue).toHaveText('0.05');
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('ArrowLeft');
  }
  await page.waitForTimeout(350);
  await expect(page.locator('.sr-only[role="status"]')).toHaveCount(1);
  await expect(page.locator('.sr-only[role="status"]')).toContainText(
    /Explorer position|boundary reached/,
  );
  await page.keyboard.press('Tab');
  await expect(controller).not.toBeFocused();
  await page.keyboard.type('w');
  await expect(yValue).toHaveText('0.05');
  await page.locator('#curve-controls > summary').click();
  await page.getByText('Paste or upload coordinate data').click();
  const text = page.getByLabel('Coordinate data');
  await text.focus();
  await page.keyboard.type('wasd');
  await expect(text).toHaveValue(/wasd/);
});

test('inspects, adds, reorders and deletes points without dragging', async ({
  page,
}) => {
  await page.locator('#curve-controls > summary').click();
  await page.getByLabel('Curve preset').selectOption('Triangle');
  await page.getByRole('button', { name: 'Load preset' }).click();
  await page.getByText('Inspect and edit source points').click();
  await expect(
    page.getByRole('table', { name: /Ordered source points/ }),
  ).toBeVisible();
  await page.getByLabel('New point X value').fill('2');
  await page.getByLabel('New point Y value').fill('3');
  await page.getByRole('button', { name: 'Add point' }).click();
  const pointCount = page
    .locator('.curve-summary')
    .getByText('Points', { exact: true })
    .locator('..');
  await expect(pointCount).toContainText('4');
  await page.getByLabel('X value for point 4').fill('2.5');
  await page.getByRole('button', { name: 'Update point 4' }).click();
  await page.getByRole('button', { name: 'Move point 4 earlier' }).click();
  await page.getByRole('button', { name: 'Delete point 3' }).click();
  await expect(page.getByLabel('Point number', { exact: true })).toBeFocused();
  await expect(pointCount).toContainText('3');
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download curve and mapping JSON' })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('timuds-curve-and-mapping.json');
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('has no serious axe findings in error, explorer, dark and narrow states', async ({
  page,
}) => {
  await page.locator('#curve-controls > summary').click();
  await page.getByText('Paste or upload coordinate data').click();
  await page.getByLabel('Coordinate data').fill('broken');
  await page.getByRole('button', { name: 'Import pasted coordinates' }).click();
  await expect(page.getByRole('alert')).toBeFocused();
  await page.locator('#advanced-controls > summary').click();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );

  await page.getByRole('textbox', { name: 'Coordinate data' }).fill('0,0\n1,1');
  await page.getByRole('button', { name: 'Import pasted coordinates' }).click();
  await page
    .getByRole('button', { name: 'Enter two-dimensional exploration' })
    .click();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );

  await page.emulateMedia({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    forcedColors: 'active',
  });
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );

  await page.emulateMedia({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    forcedColors: 'none',
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
