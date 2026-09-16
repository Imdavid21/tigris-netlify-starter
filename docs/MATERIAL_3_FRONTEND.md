# supershot.fun Material 3 Frontend

Last updated: 2026-09-16

This is the frontend design, component, and interaction source of truth for supershot.fun.

Official references:

- Material foundations: https://m3.material.io/foundations
- Material components: https://m3.material.io/components
- Material styles: https://m3.material.io/styles
- Material motion: https://m3.material.io/styles/motion/overview/how-it-works
- Material web development: https://m3.material.io/develop
- Material Web: https://github.com/material-components/material-web
- Motion for React: https://motion.dev/docs/react

## 1. Current architecture

supershot.fun now uses Google Material 3 at three layers:

1. Material 3 foundations and semantic design roles
2. Google's `@material/web` package for the complete Material Web component catalog
3. Motion for React for orchestration, layout continuity, presence, gestures, and Material-tuned springs

The application remains React 19 / Next.js 16. Protocol and wallet logic remain independent from the visual layer.

`@material/web` is currently in maintenance mode upstream, but the complete package is intentionally installed because supershot.fun now wants the official Material Web implementation available across the frontend. All usage stays behind local React adapters so the package can be changed later without rewriting protocol logic.

## 2. Foundations

Canonical files:

- `apps/web/styles/tokens.css`
- `apps/web/styles/base.css`
- `apps/web/components/material-web-provider.tsx`

Foundations include:

- Material semantic color roles
- light and dark themes
- Material surface hierarchy
- Material typography roles
- Google's official Material Web type-scale stylesheet
- Material shape roles
- elevation levels
- state-layer opacities
- reduced-motion support
- adaptive responsive behavior

Do not introduce a second design-token system.

## 3. Complete Material Web import

Dependency:

- `@material/web`

Full component registration lives in:

- `apps/web/lib/material-web-catalog.ts`

The catalog registers the complete upstream component set:

- elevated, filled, filled-tonal, outlined, and text buttons
- checkbox
- assist, filter, input, and suggestion chips
- chip set
- dialog
- divider
- elevation
- FAB and branded FAB
- filled and outlined fields
- focus ring
- icon
- icon-button variants
- list and list item
- menu, menu item, and sub-menu
- circular and linear progress
- radio
- ripple
- filled and outlined select
- select option
- slider
- switch
- primary and secondary tabs
- tabs container
- filled and outlined text fields

The catalog is registered client-side by `MaterialWebProvider` so custom elements are never evaluated during server rendering.

Google warns that the convenience `all.js` bundle is intended for development/prototyping. supershot.fun therefore imports the full catalog explicitly by component path. This still gives us the complete package while keeping the registration strategy explicit and removable.

## 4. React adapter layer

Reusable adapters live under:

- `apps/web/components/m3/primitives.tsx`
- `apps/web/components/m3/material-controls.tsx`
- `apps/web/components/m3/material-feedback.tsx`

Current adapters include:

- `M3Button`
- `M3IconButton`
- `M3Chip`
- `MaterialTextField`
- `MaterialSelect`
- `MaterialSwitch`
- `MaterialSlider`
- `MaterialCheckbox`
- `MaterialDialog`
- `MaterialLinearProgress`
- `MaterialCircularProgress`
- `MaterialBusy`
- `MaterialDivider`

Adapters render safe native React fallbacks until Material Web finishes registering. After registration they upgrade to official Material Web custom elements.

Do not call Material custom elements directly from protocol/business components unless there is a strong reason. Prefer adapters so React behavior, fallbacks, accessibility, and future migration stay centralized.

## 5. Motion architecture

Canonical files:

- `apps/web/lib/motion-system.ts`
- `apps/web/components/app-motion.tsx`
- `apps/web/components/motion-nav.tsx`
- `apps/web/components/viewport-flow.tsx`

Motion for React is the orchestration runtime. Material Web owns component internals such as ripple and control state. Motion owns movement between application states.

Material spring families:

| Family | Damping ratio | Stiffness |
| --- | ---: | ---: |
| Spatial fast | 0.6 | 800 |
| Spatial default | 0.8 | 380 |
| Spatial slow | 0.8 | 200 |
| Effects fast | 1.0 | 3800 |
| Effects default | 1.0 | 1600 |
| Effects slow | 1.0 | 800 |

Rules:

1. Position, scale, size, reflow, and shared-element movement use spatial springs.
2. Opacity and effect-only changes use effects springs.
3. Use `AnimatePresence` when disappearance would otherwise snap.
4. Use layout interpolation for sorting, filtering, resizing, and responsive reflow.
5. Use shared `layoutId` when the same object persists across screens.
6. Keep transaction confirmations and errors restrained.
7. Animations must be interruptible and follow user input.
8. Respect `prefers-reduced-motion`.

## 6. Loading and feedback

supershot.fun uses multiple loading patterns based on context:

- Next route-level loading uses Material circular and linear progress.
- Material Web catalog hydration uses a minimal top-edge indeterminate progress cue.
- content-heavy grids keep skeleton placeholders to prevent layout shift.
- wallet connection uses `MaterialBusy` with an animated progress indicator.
- token graduation uses official Material linear progress.

Avoid replacing content-shaped skeletons with generic spinners when doing so would cause layout shift.

## 7. Product motion coverage

### Global shell

- route presence transitions
- spring-smoothed scroll progress
- shared active navigation indicator
- Material icon button and wallet button
- Material catalog hydration feedback

### Search

- backdrop presence
- spring modal entrance/exit
- layout interpolation
- result staggering
- hover/tap feedback

### Explore

- animated sorting/filtering
- card reorder and pagination continuity
- empty-state presence
- token shared-element continuity
- Material linear graduation progress

### Create

- form and preview layout interpolation
- advanced-control disclosure
- transaction state transitions
- hash/error presence

Material field/select adapters are available for continued replacement of native form controls. Preserve form semantics and validation behavior when migrating each field.

### Token market

- shared token identity
- graduation progress
- Market / Limit / Orders transitions
- Buy / Sell feedback
- quote/review expansion
- order presence
- transaction CTA transitions
- error and graduation notice presence

### Portfolio

- tab and list reflow
- state presence

### Analytics and Scanner

- server-rendered data
- lightweight viewport motion boundaries

### Footer

- restrained viewport/stagger motion

## 8. Accessibility and SSR

Keep server components wherever interaction is not required.

Required:

- visible focus states
- keyboard operation
- semantic disabled states
- labels for icon-only controls
- state text that does not rely on color alone
- reduced-motion support
- native fallback before custom-element upgrade

Material Web must remain client-registered. Do not import the full component catalog from a server component.

## 9. Future frontend rules

1. Material 3 remains the only primary design language.
2. Prefer official Material Web components through local React adapters.
3. Do not reintroduce the old purple/cyberpunk design layer.
4. Do not add another component framework such as MUI React unless explicitly required.
5. Do not duplicate an existing Material Web component with new custom CSS without a clear product reason.
6. Keep Motion for React for cross-component and cross-route orchestration.
7. Keep protocol execution independent from animations and component internals.
8. Contract-native trading must remain usable when indexed data is degraded.
9. Verify light mode, dark mode, keyboard, reduced motion, desktop, tablet, and mobile after component changes.
10. Treat Google Material Web maintenance status as an upstream dependency risk. Keep adapters isolated so migration remains possible.
