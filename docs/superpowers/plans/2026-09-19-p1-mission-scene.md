# P1 Mission Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every six-pair round a curriculum-themed scene-restoration mission whose visible world grows after each successful match.

**Architecture:** First create and review a standalone three-treatment v0 at the iPad landscape target. After a treatment is approved, add a pure mission configuration module and a controlled `MissionScene` component driven only by `level.id`, `eliminatedCount`, and total pairs; integrate it into the existing game-side column without changing game-state ownership.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, existing global CSS tokens, CSS layers/animations, Playwright Test.

---

## Safety and scope

- Follow the existing Next.js 16 documentation in `node_modules/next/dist/docs/01-app/` before application changes.
- Preserve the P0 non-blocking loop and the existing deadlock replacement changes.
- Do not call image-generation APIs or add remote assets.
- Do not start production integration until the v0 treatment is accepted.
- Keep the prototype as a design artifact; it must not be linked from the child-facing app.

## File map

- Create `design-demos/p1-mission-scene-v0.html`: standalone prototype with three treatments and progress toggles.
- Create `lib/missionConfig.ts`: typed eight-unit mission copy and six beats per unit.
- Create `components/MissionScene.tsx`: accessible production scene driven by props.
- Create `tests/mission-config.spec.ts`: pure configuration completeness tests.
- Modify `components/GameScreen.tsx`: replace the separate mascot card with `MissionScene` and compact the side column.
- Modify `app/globals.css`: mission layouts, paper-cut objects, state transitions, and reduced-motion behavior.
- Modify `tests/core-loop.spec.ts`: browser assertions for zero, partial, and complete mission progress.

### Task 1: Build and review the v0 design gate

**Files:**
- Create: `design-demos/p1-mission-scene-v0.html`

- [x] **Step 1: Build the landscape comparison canvas**

Create one 1024×768-responsive HTML artifact showing the real 92px navigation rail, production shell padding, a simplified current game board on the left, and the proposed mission column on the right. Add treatment toggles for Paper-cut theatre, Sticker diorama, and Scroll landscape, plus progress toggles for 0/3/6 restored objects. The mission design must use only the width that remains after the rail, board, gaps, and shell padding.

- [x] **Step 2: Apply the declared design system**

Use the existing warm paper, wood, vermilion, amber, sage, fonts, radii, and two-level shadows. Include default, selected, completed, and reduced-motion states. Do not add libraries or external assets.

- [x] **Step 3: Verify the v0 at iPad landscape sizes**

Inspect at 1024×768 and 1180×760. Confirm the board remains visually primary, the mission objective is readable within two seconds, and controls remain above the fold.

- [x] **Step 4: Present the prototype and pause**

Open the artifact for the user and request a choice among the three treatments. Do not continue to Task 2 until one is accepted.

### Task 2: Add typed mission configuration

**Files:**
- Create: `lib/missionConfig.ts`
- Create: `tests/mission-config.spec.ts`

- [x] **Step 1: Write failing configuration tests**

Assert that all eight curriculum IDs are present, every built-in mission has exactly six unique beats, every label is non-empty, and `getMissionBeats` returns exactly the requested count. Cover a six-beat built-in round, an eight-beat custom round, and a future built-in round whose requested count exceeds its configured beats.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/mission-config.spec.ts`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement the configuration module**

Export `MissionConfig`, `MissionBeat`, `MISSION_CONFIG`, `getMissionConfig(levelId, title)`, and `getMissionBeats(config, totalCount)`. Built-in beats come first; accessible numbered generic beats fill any remaining slots. Custom levels receive `totalCount` generic “词语星光” beats so each successful match has one object.

- [x] **Step 4: Run the focused test**

Run: `npm test -- tests/mission-config.spec.ts`

Expected: PASS.

### Task 3: Build the production MissionScene component

**Files:**
- Create: `components/MissionScene.tsx`
- Modify: `app/globals.css`
- Create: `tests/mission-scene.spec.tsx`

- [x] **Step 1: Write failing component-state tests**

Use `renderToStaticMarkup` from `react-dom/server` inside the Playwright test runner so this task does not require adding a component-test framework or temporary app route. Cover progress 0, 3, and 6 for a built-in mission and 0/7/8 for a custom mission; verify restored beat count, mission copy, accessible labels, and complete-state announcement.

- [x] **Step 2: Implement the controlled component**

Accept `levelId`, `levelTitle`, `restoredCount`, `totalCount`, and character props. Obtain exactly `totalCount` beats through `getMissionBeats` and derive visible beats with `index < restoredCount`; never store duplicate scene progress in component state.

- [x] **Step 3: Implement accepted visual treatment and motion**

Use CSS-only layers plus local/brand-safe sticker glyphs. Animate only newly restored objects. Add `@media (prefers-reduced-motion: reduce)` rules that remove transforms and long transitions.

- [x] **Step 4: Run the component tests**

Run: `npm test -- tests/mission-scene.spec.tsx`

Expected: PASS.

### Task 4: Integrate the mission into the game column

**Files:**
- Modify: `components/GameScreen.tsx`
- Modify: `app/globals.css`
- Modify: `tests/core-loop.spec.ts`

- [x] **Step 1: Add failing game-flow and layout assertions**

Assert the first unit starts at `0 / 6`, one correct match restores exactly one beat, a wrong match changes none, and the sixth match sets the mission complete state. Assert the completion modal is absent for the first 700ms and appears afterward. At 1024×768, verify the board retains its current rendered width and the mission title, scene, numeric progress, hint, and restart controls are all visible inside the viewport.

- [x] **Step 2: Replace the separate mascot card**

Render `MissionScene` after the level heading, pass `eliminatedCount` directly, remove the redundant large mascot message card, and keep hint/restart controls reachable at 1024×768.

Add a presentation-only `completionReady` state in `GameScreen`: when `isComplete` becomes true, start a 700ms timer before rendering `CompletionModal`. Clear the timer and reset `completionReady` on restart, level change, or unmount. Continue persisting completion immediately; do not copy or delay `eliminatedCount`.

- [x] **Step 3: Compact duplicate progress UI**

Keep one concise numeric progress indication for accessibility, but avoid showing two equally prominent progress bars. The mission scene should be the primary progress signal.

- [x] **Step 4: Run game-flow tests**

Run: `npm test -- tests/core-loop.spec.ts`

Expected: PASS.

### Task 5: Final visual and technical verification

**Files:**
- Modify only files needed to resolve verified failures.

- [x] **Step 1: Run static and automated checks**

Run: `npx tsc --noEmit`, scoped ESLint for changed files, and `npm test`.

Expected: zero type/test errors and no new lint errors.

- [x] **Step 2: Run production build**

Run: `npm run build`.

Expected: successful Next.js production build.

- [x] **Step 3: Inspect representative states**

Visually inspect first unit at 0, 1, 3, and 6 restored objects; another built-in unit; a custom level; 1024×768; 1180×760; and reduced-motion mode.

- [x] **Step 4: Verify regression boundaries**

Confirm pairing, speech, hint, restart, stars, word-card collection, word-book progress, and completion modal still work. Confirm no request to `/api/generate-image` occurs.

- [ ] **Step 5: Prepare V2 handoff**

Review `git diff --check`, commit the approved production change, and push `main` to the `v2` remote after user acceptance.
