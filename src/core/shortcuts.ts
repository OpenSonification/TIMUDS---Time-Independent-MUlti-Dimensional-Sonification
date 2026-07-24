import type { ShortcutScope } from './types';

export type ShortcutCommand =
  | 'toggle-play-hold'
  | 'stop'
  | 'reset'
  | 'step-back-1'
  | 'step-forward-1'
  | 'step-back-10'
  | 'step-forward-10'
  | 'start'
  | 'end'
  | 'emergency-stop'
  | 'open-help';

export interface ShortcutInput {
  key: string;
  scope: ShortcutScope;
  targetInsideWorkspace: boolean;
  targetOwnsKeyboard: boolean;
  targetAllowsLetterCommands: boolean;
  dialogOpen: boolean;
  defaultPrevented: boolean;
  composing: boolean;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  requireAltForLetters: boolean;
  endIsAvailable: boolean;
}

function letterModifierAllowed(input: ShortcutInput): boolean {
  return input.requireAltForLetters ? input.altKey : !input.altKey;
}

export function resolveShortcut(input: ShortcutInput): ShortcutCommand | null {
  const key = input.key;
  const normalised = key.length === 1 ? key.toLowerCase() : key;
  const isArrow = normalised === 'ArrowLeft' || normalised === 'ArrowRight';
  const isLetterCommand = normalised === 's' || normalised === 'r';
  const isHelp = normalised === '?' || normalised === '/';
  const targetBlocksCommand =
    input.targetOwnsKeyboard &&
    !(input.targetAllowsLetterCommands && isLetterCommand);

  if (
    input.scope === 'off' ||
    input.defaultPrevented ||
    input.composing ||
    targetBlocksCommand ||
    input.dialogOpen ||
    input.ctrlKey ||
    input.metaKey ||
    (input.scope === 'workspace' && !input.targetInsideWorkspace)
  )
    return null;

  if (
    input.altKey &&
    !((isLetterCommand || isHelp) && input.requireAltForLetters)
  )
    return null;
  if (
    input.shiftKey &&
    !isArrow &&
    !isLetterCommand &&
    !isHelp &&
    normalised !== ' '
  )
    return null;
  if (input.repeat && normalised !== 'ArrowLeft' && normalised !== 'ArrowRight')
    return null;

  if (normalised === ' ') return 'toggle-play-hold';
  if (normalised === 's' && letterModifierAllowed(input)) return 'stop';
  if (normalised === 'r' && letterModifierAllowed(input)) return 'reset';
  if (normalised === 'ArrowLeft')
    return input.shiftKey ? 'step-back-10' : 'step-back-1';
  if (normalised === 'ArrowRight')
    return input.shiftKey ? 'step-forward-10' : 'step-forward-1';
  if (normalised === 'Home' && !input.shiftKey && !input.altKey) return 'start';
  if (
    normalised === 'End' &&
    input.endIsAvailable &&
    !input.shiftKey &&
    !input.altKey
  )
    return 'end';
  if (normalised === 'Escape' && !input.shiftKey && !input.altKey)
    return 'emergency-stop';
  if (isHelp && letterModifierAllowed(input)) return 'open-help';
  return null;
}
