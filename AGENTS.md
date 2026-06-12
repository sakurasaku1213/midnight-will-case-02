# AGENTS.md

## Project Root

- This folder is the active development root for `midnight-will-case-02`.
- Start implementation chats from this folder, not from `C:\Users\e1470\Downloads`.
- Parent workspace instructions are advisory only after this root is identified.

## Docs

- Read `docs/codex-handoff.md` first: current status audit, document map, and definition of done.
- Active task list with acceptance criteria: `docs/backlog.md`.
- Technical design: `docs/architecture.md`. Episode data schema and flag dictionary: `docs/data-spec.md`.

## Stack

- React + TypeScript + Vite, matching the first game `midnight-will`.
- Narrative data lives in `data/episode-02.json`.
- Game state, save data, and rule logic live under `src/game`.
- App shell and UI composition live under `src/app` and `src/components`.

## Commands

- Install: `npm.cmd install`
- Dev server: `npm.cmd run dev`
- Type/build check: `npm.cmd run build`
- Preview build: `npm.cmd run preview`

## UI Guardrails

- Keep `src/App.tsx` as a thin entry wrapper.
- Do not put new feature UI directly into `src/App.tsx`.
- Add screen-level UI under `src/app`, reusable UI under `src/components`, and rule/data logic under `src/game`.

## Content Rules

- Case 02 is a sequel inspired by `午前0時の遺言書`; keep it legally plausible but fictional.
- Do not copy unpublished client facts or real matter details into `data/`.
- Use evidence, statements, timelines, and final deduction questions as first-class data.

## Validation

- Run `npm.cmd run build` after implementation changes once dependencies are installed.
- For meaningful UI changes, verify desktop and mobile browser layouts before calling the work complete.
