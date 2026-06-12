# Hearing Recovery Note

## Purpose

Wrong evidence in cross-examination now produces a recovery note instead of only a penalty.
The note turns a failed objection into a useful next read: the statement to revisit, why the
chosen evidence missed, and which record should be opened next.

## Behavior

- The recovery note appears only for damage hearing cues.
- It keeps three stable sections: statement, miss reason, and record to reread.
- The record section opens the suggested evidence quick-look.
- Mobile stacks the sections vertically to avoid horizontal overflow.

## QA

- `desktop-hearing-recovery-note.png` verifies the desktop recovery note.
- `mobile-hearing-recovery-note.png` verifies the mobile recovery note.
- `desktop-hearing-miss-recovery-evidence.png` verifies the evidence quick-look from recovery.
- `npm.cmd run test:playthrough` asserts three recovery sections and an evidence action.
