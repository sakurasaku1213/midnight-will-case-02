# Review Scorecard

## Purpose

The post-clear case review now starts with a scorecard. It gives players a compact
readout of what they completed before they reread the truth and evidence chain.

## Behavior

- Shows evidence collection, hearing contradictions cleared, theory-board completion,
  and final credibility.
- Uses the current game state rather than fixed text, so QA states and saved states
  reflect their actual progress.
- Desktop uses four compact score cards; mobile uses two columns to prevent overflow.

## QA

- `desktop-case-review-scorecard.png` verifies the desktop scorecard.
- `mobile-case-review-scorecard.png` verifies the mobile scorecard.
- `npm.cmd run test:playthrough` asserts that the scorecard contains four items.
