# Deduction Ready Panel

## Purpose

The final deduction now shows a submit-ready panel once all four issue evidence slots
are filled. It gives the player one last readable summary before committing the final
conclusion.

## Behavior

- The panel appears only after all four final deduction evidence selections are present.
- It summarizes the four issue roles: culprit, reason, opportunity, and proof.
- Each item includes the selected evidence chip, reinforcing that the conclusion is built
  from records rather than a single guess.
- Mobile stacks the four items vertically to avoid horizontal overflow.

## QA

- `desktop-deduction-ready-panel.png` verifies the desktop submit-ready panel.
- `mobile-deduction-ready-panel.png` verifies the mobile stacked layout.
- `npm.cmd run test:playthrough` asserts that the panel contains four items.
