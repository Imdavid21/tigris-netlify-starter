# Celestial Material 3 Frontend

Last updated: 2026-09-16

This is the frontend design and interaction source of truth for Celestial.

Official references:

- Material foundations: https://m3.material.io/foundations
- Material components: https://m3.material.io/components
- Material styles: https://m3.material.io/styles
- Material motion: https://m3.material.io/styles/motion/overview/how-it-works
- Material web development: https://m3.material.io/develop
- Motion for React: https://motion.dev/docs/react

## 1. Architecture decision

Material 3 defines the design language. Motion for React provides the runtime interaction layer.

Celestial does not depend on `@material/web` for the full product. The application remains a React 19 / Next.js 16 application using semantic HTML, CSS custom properties, CSS Modules, server components, and focused client interaction boundaries.

The frontend stack is now:

1. Material 3 semantic design roles
2. Celestial theme tokens
3. native React/Next components
4. reusable M3 primitives
5. Motion for React for layout, presence, gestures, shared elements, scroll response, and spring orchestration
6. viem and existing protocol logic kept independent from visual motion

## 2. Foundations

Canonical files:

- `apps/web/styles/tokens.css`
- `apps/web/styles/base.css`

### Color

Use Material system color roles. Celestial keeps its acid-lime identity through semantic primary/container roles rather than page-level hex values.

### Typography

Primary family: Roboto Flex.

Use Material display, headline, title, body, and label roles. Financial values may use tabular numerals.

### Shape

Canonical corner scale:

- none: 0
- extra small: 4px
- small: 8px
- medium: 12px
- large: 16px
- extra large: 28px
- full

### Elevation

Use Material elevation levels 0 through 5 to communicate hierarchy. Do not add shadows simply for decoration.

### State layers

Hover, focus, pressed, dragged, and disabled states use the Material state-layer model.

## 3. Reusable Material components

Reusable primitives live in:

- `apps/web/components/m3/primitives.tsx`
- `apps/web/components/m3/M3.module.css`

Current primitives:

- `M3Button`
  - filled
  - tonal
  - outlined
  - text
  - elevated
- `M3IconButton`
- `M3Chip`

These primitives are Motion-enabled. Press, hover, selection, and selected-icon changes inherit the common spring system.

## 4. Motion runtime

Runtime dependency:

- `motion`
- imported from `motion/react`

Canonical motion files:

- `apps/web/lib/motion-system.ts`
- `apps/web/components/app-motion.tsx`
- `apps/web/components/motion-nav.tsx`
- `apps/web/components/viewport-flow.tsx`

The earlier custom Web Animations spring sampler was removed after Motion became the runtime.

### Material spring mapping

Material 3 Expressive separates spatial motion from effects motion.

| Family | Damping ratio | Stiffness |
| --- | ---: | ---: |
| Spatial fast | 0.6 | 800 |
| Spatial default | 0.8 | 380 |
| Spatial slow | 0.8 | 200 |
| Effects fast | 1.0 | 3800 |
| Effects default | 1.0 | 1600 |
| Effects slow | 1.0 | 800 |

`motion-system.ts` converts damping ratio and stiffness into Motion spring damping values with unit mass.

### Motion rules

1. Position, scale, size, reflow, expansion, and shared-element movement use spatial springs.
2. Opacity and effect-only changes use critically damped effect springs.
3. Mounting and unmounting should use `AnimatePresence` where disappearance would otherwise feel abrupt.
4. Reordering and responsive changes should use Motion layout interpolation instead of manual coordinate animation.
5. Shared identities should use `layoutId` when an object conceptually persists across views.
6. Financial confirmations and error states should be clear and restrained, not playful or bouncy.
7. Continuous motion must remain interruptible. The UI should follow rapid user input rather than finish stale animations.
8. Respect the user's reduced-motion preference through the global `MotionConfig`.

## 5. Global motion architecture

### Routes

`AppMotion` wraps route content using `AnimatePresence` and pathname-keyed transitions.

Route changes use:

- subtle opacity
- shallow vertical displacement
- tiny scale continuity
- short blur removal
- Material spatial/effect springs

The global shell also includes a spring-smoothed scroll progress indicator.

### Navigation

The primary navigation uses a shared `layoutId` indicator. The active destination glides between Explore, Analytics, and Portfolio instead of recreating a disconnected active state.

### Shared token identity

Explore token media and the token market hero share a normalized `layoutId` based on the token route. This lets a token retain spatial identity when moving between discovery and market context.

## 6. Product motion mapping

### Search

Search uses:

- backdrop presence
- modal spatial spring entrance and exit
- result-list layout interpolation
- staggered result entrance
- row exit animation
- hover/tap physical response

### Explore

Explore uses:

- layout interpolation during sorting
- card reordering
- filter/time-range button press physics
- card enter/exit presence
- pagination continuity
- empty-state presence
- launch-count transitions
- graduation-panel presence

### Token cards

Cards use:

- spatial layout interpolation
- hover lift
- press compression
- image fade/settle
- animated graduation progress
- shared identity with token market

### Create

Create uses:

- spring layout for the form and preview
- animated progressive disclosure for advanced controls
- preview identity/value changes
- transaction-status label presence
- hash/error presence
- physical CTA response

No transaction sequencing or contract logic is animated away or delayed.

### Token market and trading terminal

The market uses:

- shared token identity
- animated graduation progress
- layout-aware chart/data/about panes
- Market / Limit / Orders presence transitions
- Buy / Sell control feedback
- quick-amount transitions
- expanding/collapsing limit controls
- quote-review height interpolation
- open-order list presence
- CTA label transitions
- graduation notice presence
- error presence

Execution logic remains independent from the motion layer.

### Price chart

Charts use:

- range transition presence
- animated line reveal
- crosshair/dot presence
- tooltip spring motion
- range-control press feedback

### Recent trades and holders

Rows enter, leave, and reflow using layout presence so live/indexed data changes do not pop abruptly.

### Portfolio

Portfolio uses:

- tab content presence
- row reflow
- metric/card entrance
- claim/connect button physics
- status/error presence

### Analytics and Scanner

These routes stay server-rendered. Small client motion boundaries add viewport entrance and layout continuity without converting the entire page into client-side rendering.

### Theme

The theme toggle icon rotates/scales through presence while the underlying semantic theme switches immediately.

### Footer

The footer uses restrained viewport stagger and lightweight link/logo response.

## 7. React and Next.js rules

Keep server components unless interaction requires client state.

Client components are appropriate for:

- wallet state
- transaction flows
- search
- filters and tabs
- charts with pointer interaction
- Motion layout/presence boundaries
- gesture/scroll response

Do not convert data-loading server pages to client rendering only to animate them. Use focused client wrappers such as `FlowSection` instead.

## 8. Performance rules

1. Prefer transform and opacity animation.
2. Use layout animation only on surfaces that materially change size or position.
3. Avoid permanent `will-change` on large portions of the page.
4. Do not animate every metric update with a large transition.
5. Do not add infinite decorative motion to trading-critical regions.
6. Keep motion independent from API/RPC timing.
7. Reduced motion must remain functional and readable.

## 9. Accessibility

Keep native semantic controls wherever possible.

Required:

- visible focus states
- keyboard operation
- semantic disabled states
- `aria-pressed` for selectable chips
- labels for icon-only controls
- status must not depend on color only
- `prefers-reduced-motion` respected globally

## 10. Current migration coverage

The Material 3 + Motion system now covers:

- semantic color/type/shape/elevation foundations
- light and dark themes
- app shell
- route transitions
- shared navigation state
- spring-smoothed scroll continuity
- global search
- reusable Material controls
- Explore filtering, sorting, pagination, and cards
- shared token transition into market context
- Create flow
- token market
- trading terminal
- price chart
- recent trades
- holders
- Portfolio
- Analytics
- Scanner
- theme switching
- footer

The obsolete pre-Material purple/cyberpunk styling layer and the temporary custom animation runtime have both been removed.

## 11. Rules for future frontend work

1. Material 3 semantic roles remain the design source of truth.
2. Motion for React is the interaction runtime.
3. Use the shared Material spring presets instead of arbitrary durations.
4. Prefer continuous spatial relationships over isolated entrance animations.
5. Use `layout`, `layoutId`, and `AnimatePresence` deliberately.
6. Do not animate for decoration alone.
7. Keep protocol execution independent from UI animation.
8. Never delay signature, quote, or transaction state to make an animation finish.
9. Test light mode, dark mode, reduced motion, keyboard use, desktop, tablet, and mobile after motion changes.
10. Do not reintroduce the old cyberpunk, Avenue, Utopia, or unrelated animation systems.
