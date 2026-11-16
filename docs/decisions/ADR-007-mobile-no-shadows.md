# ADR-007: The mobile app draws no drop shadows

Status: **accepted** (owner direction 2026-11-16, from a reference design: cards on a tinted page, separated only by borders and fill colours).

## Context

- The WP1 to WP3 tokens carried an `elevation` scale (`card`, `overlay`) and a `shadowColor`, copied from the web app's near-flat `shadow-card`. `Card`, `Toast` and `SheetModal` used it, so on a phone every card and sheet had a soft shadow.
- The owner wants a flat look: sections, boxes and blocks are told apart by a border and a different background colour, with no shadow around them.
- RN shadows are also inconsistent: iOS draws `shadow*`, Android draws `elevation` (a different, harder shadow), and Android shadows are costly in long lists on mid-range phones.

## Decision

1. **No shadows anywhere in `apps/mobile`.** No `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`, `boxShadow` or `textShadow*` in `src/` or `app/`. The `elevation` tokens are deleted.
2. **Surfaces are separated by a 1px border and a fill that differs from what is behind them**, in both themes:
   - page: `colors.background`; card / section block: `colors.card` + `colors.border` (`Card`);
   - bottom sheet: `colors.popover` + a 1px `colors.inputBorder` outline on the top and sides, over the dimmed scrim;
   - toast: `colors.popover` + `colors.inputBorder` outline.
3. **The modal backdrop is a scrim, not a shadow.** `scrimColor` (black) at 50% opacity stays; it replaces the old `shadowColor` name.
4. **Enforced by a test**, not by memory: `apps/mobile/test/no-shadows.test.ts` fails when a forbidden style appears in `src` or `app` (comments are ignored), and when `card`, `popover`, `border` and `inputBorder` stop differing from `background` in either theme. It runs in `pnpm run test:node` and so in CI.
5. **If a surface needs more emphasis, change its fill or border, never add a shadow.** A different rule needs a new ADR and the owner's yes.

## Consequences

- Cards read as flat tiles on the tinted page; depth comes from colour, which also costs nothing to draw.
- The WP2/WP3 specs that mention `elevation.card` / `elevation.overlay` are superseded by this ADR (a note was added to them; they are history, not rewritten).
- Pressed, focused and selected states already use fill and outline changes (`press-overlay`, focus ring), so they are unaffected.
- Borders carry the separation, so the `border` and `inputBorder` tokens must stay visibly different from the fills they sit on. They are shared with the web tokens (a drift check guards them), so a change to them is a design decision, not a tweak.
- Not verified on a device when this ADR was written (see the PR).

## Alternatives rejected

- Keep a very light shadow on cards only: the owner explicitly does not want shadows around sections.
- Platform-specific (iOS shadow, Android flat): two looks to maintain and test.
