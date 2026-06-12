# Hearing Breakthrough

## Purpose

Cross-examination now keeps a short breakthrough sequence visible after the player
successfully presents evidence. It turns a correct answer into a readable courtroom beat:
what collapsed, which record caused it, and what the next contradiction should target.

## Behavior

- The first contradiction leaves the player in cross-examination and shows a partial sequence.
- The panel marks the solved contradiction and highlights the next target evidence.
- The final contradiction can use the same complete state when the hearing remains visible in QA states.
- Mobile stacks the two breakthrough steps vertically to avoid horizontal overflow.

## QA

- `desktop-hearing-breakthrough.png` verifies the post-success desktop sequence.
- `mobile-hearing-breakthrough.png` verifies the mobile sequence and no overflow.
- `npm.cmd run test:playthrough` asserts that the sequence contains two steps.
