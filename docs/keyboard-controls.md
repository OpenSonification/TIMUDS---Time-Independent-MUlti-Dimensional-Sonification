# Keyboard controls

Every command below also has a visible native control. Page shortcuts start in
**Workspace only** scope. They can be switched off or deliberately extended to
the whole page under Accessibility; this preference is validated and stored
locally. While shortcuts are enabled, S is a page-wide safety exception. The
other commands follow the selected scope.

| Key                  | Scope      | Action                              |
| -------------------- | ---------- | ----------------------------------- |
| Space                | Selected   | Play, or hold while playing         |
| S                    | Whole page | Stop all sound with a fade          |
| R                    | Selected   | Stop and return to the start        |
| Left / Right         | Selected   | Move backwards / forwards by 1%     |
| Shift + Left / Right | Selected   | Move backwards / forwards by 10%    |
| Home                 | Selected   | Move to the start                   |
| End                  | Selected   | Move to the end of an open curve    |
| Escape               | Selected   | Emergency fade when sound is active |
| ?                    | Selected   | Open Keyboard help                  |

Lowercase and Shift-modified uppercase S/R are equivalent.
An optional setting requires Alt for S, R and ?. Control and Command modified
shortcuts are left to the browser and assistive technology.

## Safeguards

The central resolver does not handle any command when:

- shortcuts are off;
- IME composition is active;
- the event was already handled;
- Control or Command is pressed;
- a one-shot command is an auto-repeat.

For commands other than S, workspace scope must contain the event target and an
open dialog blocks the page command. S remains available across the page and
inside Keyboard help. Inputs, text areas, selects, contenteditable regions and
equivalent ARIA input widgets keep S as well as their other keys.

Arrow repeats remain available. End is omitted for closed curves. Native range
controls keep their browser keyboard behaviour. A focused button continues to
own Space and Enter, but does not swallow the S and R commands after Play,
Hold, Stop or another button has been activated. Editable controls, selects,
ranges and other input widgets still block those letter shortcuts.

## Two-dimensional explorer

The Advanced disclosure contains a separate focused plane controller. Left and
Right change x; Up and Down change numeric y; Shift uses the coarse step; and
Escape returns to the saved curve position. WASD is optional, off by default
and restricted to that controller. Native X and Y sliders and number inputs
provide the same movements for screen-reader and form-control use.

Keyboard help is a modal dialog with the complete table, current scope and a
Stop control. Closing it restores focus to the control that opened it.
