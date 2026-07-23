# Keyboard controls

Every command below also has a visible native control. Page shortcuts start in
**Workspace only** scope. They can be switched off or deliberately extended to
the whole page under Accessibility; this preference is validated and stored
locally.

| Key                  | Workspace action                    |
| -------------------- | ----------------------------------- |
| Space                | Play, or hold while playing         |
| S                    | Stop all sound with a fade          |
| R                    | Stop and return to the start        |
| Left / Right         | Move backwards / forwards by 1%     |
| Shift + Left / Right | Move backwards / forwards by 10%    |
| Home                 | Move to the start                   |
| End                  | Move to the end of an open curve    |
| Escape               | Emergency fade when sound is active |
| ?                    | Open Keyboard help                  |

An optional setting requires Alt for S, R and ?. Control and Command modified
shortcuts are left to the browser and assistive technology.

## Safeguards

The central resolver does not handle a command when:

- shortcuts are off, or workspace scope does not contain the event target;
- an input, textarea, select, button, link, contenteditable region or
  interactive ARIA widget owns the key;
- a dialog is open;
- IME composition is active;
- the event was already handled;
- Control or Command is pressed;
- a one-shot command is an auto-repeat.

Arrow repeats remain available. End is omitted for closed curves. Native range
controls keep their browser keyboard behaviour.

## Two-dimensional explorer

The Advanced disclosure contains a separate focused plane controller. Left and
Right change x; Up and Down change numeric y; Shift uses the coarse step; and
Escape returns to the saved curve position. WASD is optional, off by default
and restricted to that controller. Native X and Y sliders and number inputs
provide the same movements for screen-reader and form-control use.

Keyboard help is a modal dialog with the complete table, current scope and a
Stop control. Closing it restores focus to the control that opened it.
