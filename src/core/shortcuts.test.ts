import { describe, expect, it } from 'vitest';
import { resolveShortcut, type ShortcutInput } from './shortcuts';

const base: ShortcutInput = {
  key: ' ',
  scope: 'workspace',
  targetInsideWorkspace: true,
  targetOwnsKeyboard: false,
  targetAllowsLetterCommands: false,
  targetAllowsStop: false,
  dialogOpen: false,
  defaultPrevented: false,
  composing: false,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  requireAltForLetters: false,
  endIsAvailable: true,
};

function resolve(key: string, changes: Partial<ShortcutInput> = {}) {
  return resolveShortcut({ ...base, key, ...changes });
}

describe('central shortcut resolver', () => {
  it.each([
    [' ', {}, 'toggle-play-hold'],
    ['s', {}, 'stop'],
    ['S', {}, 'stop'],
    ['S', { shiftKey: true }, 'stop'],
    ['r', {}, 'reset'],
    ['R', { shiftKey: true }, 'reset'],
    ['ArrowLeft', {}, 'step-back-1'],
    ['ArrowRight', {}, 'step-forward-1'],
    ['ArrowLeft', { shiftKey: true }, 'step-back-10'],
    ['ArrowRight', { shiftKey: true }, 'step-forward-10'],
    ['Home', {}, 'start'],
    ['End', {}, 'end'],
    ['Escape', {}, 'emergency-stop'],
    ['?', { shiftKey: true }, 'open-help'],
  ])('maps %s safely', (key, changes, command) => {
    expect(resolve(key, changes)).toBe(command);
  });

  it('supports workspace, site-wide and off scopes', () => {
    expect(resolve('s', { targetInsideWorkspace: false })).toBe('stop');
    expect(resolve('r', { targetInsideWorkspace: false })).toBeNull();
    expect(
      resolve('r', {
        scope: 'site-wide',
        targetInsideWorkspace: false,
      }),
    ).toBe('reset');
    expect(resolve('s', { scope: 'off' })).toBeNull();
  });

  it.each([
    ['editing control', { targetOwnsKeyboard: true }],
    ['prevented event', { defaultPrevented: true }],
    ['IME composition', { composing: true }],
    ['Control modifier', { ctrlKey: true }],
    ['Meta modifier', { metaKey: true }],
  ])('rejects %s', (_name, changes) => {
    expect(resolve('s', changes)).toBeNull();
    expect(resolve('ArrowRight', changes)).toBeNull();
  });

  it('keeps Stop available across the page and in a dialog', () => {
    const nonEditableControl = {
      targetInsideWorkspace: false,
      targetOwnsKeyboard: true,
      targetAllowsStop: true,
    };
    expect(resolve('s', nonEditableControl)).toBe('stop');
    expect(resolve('S', { ...nonEditableControl, shiftKey: true })).toBe(
      'stop',
    );
    expect(resolve('r', nonEditableControl)).toBeNull();
    expect(resolve('s', { dialogOpen: true })).toBe('stop');
    expect(resolve('r', { dialogOpen: true })).toBeNull();
  });

  it('allows S and R from a focused button without taking over its native keys', () => {
    const focusedButton = {
      targetOwnsKeyboard: true,
      targetAllowsLetterCommands: true,
      targetAllowsStop: true,
    };
    expect(resolve('s', focusedButton)).toBe('stop');
    expect(resolve('r', focusedButton)).toBe('reset');
    expect(resolve('S', { ...focusedButton, shiftKey: true })).toBe('stop');
    expect(resolve('R', { ...focusedButton, shiftKey: true })).toBe('reset');
    expect(resolve(' ', focusedButton)).toBeNull();
    expect(resolve('ArrowRight', focusedButton)).toBeNull();
    expect(resolve('?', focusedButton)).toBeNull();
  });

  it('retains one-shot repeat protection while permitting arrow repeat', () => {
    expect(resolve(' ', { repeat: true })).toBeNull();
    expect(resolve('s', { repeat: true })).toBeNull();
    expect(resolve('ArrowRight', { repeat: true })).toBe('step-forward-1');
  });

  it('can require Alt for letter and help shortcuts', () => {
    expect(resolve('s', { requireAltForLetters: true })).toBeNull();
    expect(resolve('s', { requireAltForLetters: true, altKey: true })).toBe(
      'stop',
    );
    expect(
      resolve('?', { requireAltForLetters: true, shiftKey: true }),
    ).toBeNull();
    expect(
      resolve('?', {
        requireAltForLetters: true,
        altKey: true,
        shiftKey: true,
      }),
    ).toBe('open-help');
  });

  it('does not handle End on a closed curve', () => {
    expect(resolve('End', { endIsAvailable: false })).toBeNull();
  });
});
