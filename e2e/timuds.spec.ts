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

test('loads silently, exposes skip links and uses relative production assets', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { level: 1, name: /Listen around/ }),
  ).toBeVisible();
  await expect(page.getByText('Circle · preset')).toBeVisible();
  await expect(
    page.getByText(/Silent\. Audio has not started/).first(),
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
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('enables audio deliberately and operates the complete transport', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Enable audio' }).click();
  await expect(page.getByText('Audio sounding').locator('..')).toContainText(
    'No',
  );
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText(/^Playing$/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Hold' }).click();
  await expect(
    page.getByText(/Holding at current point/).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Move to start' }).click();
  await page.getByRole('button', { name: 'Step forwards' }).click();
  await expect(page.getByLabel('Position along curve')).toHaveValue('0.01');
  await page.getByRole('button', { name: 'Step backwards' }).click();
  await expect(page.getByLabel('Position along curve')).toHaveValue('0');
  await page.getByRole('button', { name: 'Stop all sound' }).first().click();
  await expect(page.getByText('Audio sounding').locator('..')).toContainText(
    'No',
  );
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
  await page.selectOption('#axis-x-timbre', 'bright');
  await expect(page.locator('#axis-x-timbre')).toHaveValue('bright');
  await page.getByLabel('Centre both voices (mono-friendly)').check();
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
      .locator('#current-position')
      .getByText('Mode', { exact: true })
      .locator('..'),
  ).toContainText('Following curve');
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test('leaves the explorer with Tab and keeps optional WASD scoped', async ({
  page,
}) => {
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
  await page.getByText('Paste or upload coordinate data').click();
  const text = page.getByLabel('Coordinate data');
  await text.focus();
  await page.keyboard.type('wasd');
  await expect(text).toHaveValue(/wasd/);
});

test('inspects, adds, reorders and deletes points without dragging', async ({
  page,
}) => {
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
  await page.getByText('Paste or upload coordinate data').click();
  await page.getByLabel('Coordinate data').fill('broken');
  await page.getByRole('button', { name: 'Import pasted coordinates' }).click();
  await expect(page.getByRole('alert')).toBeFocused();
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
