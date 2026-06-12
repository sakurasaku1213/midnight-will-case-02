# Evidence Next Use

## Purpose

Evidence details now show a "next use" panel when opened from the case file.
The panel turns each evidence item into an actionable bridge back to the game loop:
analysis, presenting, cross-examination, or final deduction.

## Behavior

- Ready and completed uses are clickable and jump to the matching command mode.
- Locked uses stay visible but disabled, so the player can read what prerequisite is missing.
- Quick-look evidence dialogs stay lightweight and do not show navigation actions.

## QA

- `desktop-casefile-evidence-next-use.png` verifies the desktop evidence action panel.
- `desktop-casefile-evidence-next-use-jump.png` verifies a mode jump from evidence detail.
- `mobile-casefile-evidence-next-use.png` verifies the mobile layout.
