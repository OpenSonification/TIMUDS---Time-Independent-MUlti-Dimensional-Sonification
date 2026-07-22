import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function mockAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class Parameter {
      value = 0;
      setTargetAtTime(value: number): void {
        this.value = value;
      }
      cancelScheduledValues(): void {}
    }
    class Node {
      connect<T>(destination: T): T {
        return destination;
      }
      disconnect(): void {}
    }
    class Oscillator extends Node {
      frequency = new Parameter();
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
    class InstrumentedAudioContext {
      state = 'running';
      destination = new Node();
      private started = performance.now();
      get currentTime(): number {
        return (performance.now() - this.started) / 1000;
      }
      createGain(): Gain {
        return new Gain();
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
      resume(): Promise<void> {
        return Promise.resolve();
      }
      close(): Promise<void> {
        this.state = 'closed';
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      value: InstrumentedAudioContext,
      configurable: true,
    });
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

test.beforeEach(async ({ page }) => {
  await mockAudioContext(page);
  await page.goto('/');
});

test('loads the default circle silently and production assets are relative', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { level: 1, name: /Hear position/ }),
  ).toBeVisible();
  await expect(page.getByText('Circle · preset')).toBeVisible();
  await expect(
    page.getByText(/Silent — audio has not been enabled/).first(),
  ).toBeVisible();
  await expect(page.locator('svg[role="img"] path.curve-line')).toHaveAttribute(
    'd',
    /Z$/,
  );
  await expect(page.locator('script[type="module"]')).toHaveAttribute(
    'src',
    /^\.\/assets\//,
  );
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('starts two-voice playback, holds, and moves manually in both directions', async ({
  page,
}) => {
  await page.getByRole('button', { name: /^▶ Play$/ }).click();
  await expect(page.getByText(/^Playing$/).first()).toBeVisible();
  await page.getByRole('button', { name: /Hold$/ }).click();
  await expect(
    page.getByText(/Holding position with sound sustained/).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: '+5%' }).click();
  await expect(page.getByText('5.0%').first()).toBeVisible();
  await page.getByRole('button', { name: '−1%' }).click();
  await expect(page.getByText('4.0%').first()).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('imports a triangle and exposes validation errors accessibly', async ({
  page,
}) => {
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

test('changes mapping and operates transport with keyboard', async ({
  page,
}) => {
  await page.selectOption('#axis-x-timbre', 'bright');
  await expect(page.locator('#axis-x-timbre')).toHaveValue('bright');
  await page.getByLabel('Centre both voices (mono-friendly)').check();
  const plot = page.getByRole('img', { name: 'Ordered two-dimensional curve' });
  await plot.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Playing$/).first()).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByText(/Holding position with sound sustained/).first(),
  ).toBeVisible();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByText(/5\.\d%/).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByText(/Stopped at position — audio off/).first(),
  ).toBeVisible();
});
