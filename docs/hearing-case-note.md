# Hearing Case Note

## Purpose

The cross-examination screen now includes a compact case note between the route cards
and the contradiction ledger. It summarizes the current testimony, prerequisite state,
selected evidence, and match result before the player presses the final submit button.

## Behavior

- Ready combinations show a green "submit ready" state.
- Mismatched evidence stays visible as a warning, so the player can compare the wrong axis.
- Blocked testimony explains whether the player should press the statement or clear an earlier contradiction.
- The note keeps four fixed steps so the desktop and mobile layouts stay predictable.

## QA

- `desktop-hearing-case-note.png` verifies the desktop case note in a ready state.
- `mobile-hearing-case-note.png` verifies the mobile two-column layout.
- `npm.cmd run test:playthrough` asserts that the case note has four steps and no mobile overflow.
