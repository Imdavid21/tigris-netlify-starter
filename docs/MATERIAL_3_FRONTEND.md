# Celestial Material 3 Frontend

Last updated: 2026-09-16

This document is the design and implementation guide for the Celestial frontend after the migration to Google Material 3.

Official design references:

- Foundations: https://m3.material.io/foundations
- Components: https://m3.material.io/components
- Styles: https://m3.material.io/styles
- Motion: https://m3.material.io/styles/motion/overview/how-it-works
- Develop: https://m3.material.io/develop
- Material Web: https://github.com/material-components/material-web

## 1. Implementation decision

Material 3 is the source of truth for design roles, interaction patterns, state layers, typography, shape, elevation, adaptive layout, and motion.

Celestial does **not** depend on `@material/web` for the full interface.

Reason:

- Google's Material Web package implements Material 3 web components.
- The official Material Web repository currently states that the project is in maintenance mode pending new maintainers.
- Material's own web availability discussion confirms that web is unavailable for many newer Material components for the same reason.
- Celestial is already a React 19 / Next.js 16 application.

The safer architecture is therefore:

1. use Material 3 specifications as the design contract
2. use Material system tokens as CSS custom properties
3. keep semantic HTML and React components native
4. maintain a small Celestial M3 primitive layer for common controls
5. preserve server rendering and existing product logic
6. avoid coupling core product execution to a maintenance-mode component runtime

This is an implementation of Material 3 for Celestial, not an imitation of an Android screen.

## 2. Foundations

Canonical foundation files:

- `apps/web/styles/tokens.css`
- `apps/web/styles/base.css`

### Color

The old palette variables are now compatibility aliases.

New canonical roles use Material system naming:

- `--md-sys-color-primary`
- `--md-sys-color-on-primary`
- `--md-sys-color-primary-container`
- `--md-sys-color-on-primary-container`
- secondary roles
- tertiary roles
- error roles
- background / surface roles
- outline roles
- inverse roles
- surface container levels

Celestial's acid-lime identity is retained through the Material role system rather than through arbitrary component-level hex values.

Do not add hard-coded page colors unless they represent data visualization that cannot be expressed by a semantic role.

### Surface hierarchy

Use Material surface containers instead of adding borders and shadows everywhere.

Preferred hierarchy:

- page: `surface` / `background`
- low-emphasis region: `surface-container-low`
- ordinary card: `surface-container`
- control/input: `surface-container-high`
- strongest neutral container: `surface-container-highest`

Elevation should describe hierarchy, not decorate every panel.

### Typography

Primary family:

- Roboto Flex

Material type roles are defined for:

- display large / medium / small
- headline large / medium / small
- title large / medium / small
- body large / medium / small
- label large / medium / small

Use role variables instead of one-off font sizes.

Market numbers can retain tabular numerals.

### Shape

Canonical Material shape roles:

- none
- extra small: 4px
- small: 8px
- medium: 12px
- large: 16px
- extra large: 28px
- full

Use large and extra-large containers selectively. Controls should use their appropriate component shape rather than making every element a pill.

### Elevation

Levels 0 through 5 are defined in the token layer.

Default product surfaces should usually remain at level 0. Use level 1 or 2 for interactive elevated cards, floating search, menus, and overlays.

### State layers

Canonical interaction opacities are defined for:

- hover
- focus
- pressed
- dragged
- disabled container
- disabled content

Interactive components should use state layers instead of random hover colors.

## 3. Component system

Reusable Celestial Material primitives live under:

- `apps/web/components/m3/`

Current primitives:

- `M3Button`
  - filled
  - tonal
  - outlined
  - text
  - elevated
- `M3IconButton`
- `M3Chip`

Do not wrap every DOM element just to call it Material. Create a React primitive when it provides reusable behavior, accessibility, state handling, or token mapping.

## 4. Product component mapping

### Global shell

Old pattern -> current Material 3 pattern

- custom sticky header -> top app bar pattern
- small bordered search -> Material search bar
- network pill -> assist-chip style control
- theme toggle -> icon button
- wallet button -> filled tonal button
- Create -> filled action button
- search overlay -> elevated search surface with spatial spring motion

### Explore

- old segmented controls -> filter chips
- old bordered search -> search bar
- market tiles -> elevated cards
- launch status -> status/filter chip language
- graduation -> linear progress indicator
- loading -> Material surface skeletons
- degraded index -> secondary-container notice

### Create

- plain inputs -> Material filled text-field treatment
- section numbers -> compact tonal badges
- form sections -> surface containers
- economics summary -> grouped container cells
- advanced controls -> progressive disclosure
- final review -> secondary-container review surface
- launch action -> filled button
- preview -> elevated supporting card

### Token market

Desktop adaptive structure:

- primary pane: market/chart/data/about
- supporting pane: sticky trade terminal

Material patterns used:

- headline identity block
- status chips
- linear graduation progress
- primary tabs for Market / Limit / Orders
- filled trade amount field
- outlined suggestion chips
- filled transaction action
- tonal review surface
- cards and lists for trades/holders/about

The same market route still survives graduation.

### Portfolio

- summary -> surface container
- claimable fees -> prominent tonal container
- wallet metrics -> grouped cards
- previous segmented tab control -> Material tab treatment
- rows -> Material list treatment
- claim/connect actions -> filled/outlined buttons

### Analytics

- protocol summary -> tonal hero container
- metrics -> card/grid system
- status -> chip
- buyback history -> list rows
- charts -> low-surface chart containers

### Scanner

- contract identity -> headline + supporting metadata
- explorer actions -> filled/outlined actions
- metrics -> grouped containers
- holders/activity -> lists
- buy/sell state -> semantic chips

### Footer

The footer is a low surface container with normal Material hierarchy, not a promotional card.

## 5. Motion physics

Canonical implementation:

- `apps/web/lib/material-motion.ts`
- motion tokens in `apps/web/styles/tokens.css`

Material 3 Expressive differentiates **spatial motion** from **effects motion**.

Spatial motion moves or resizes UI and may use under-damped springs. Effects motion changes properties such as opacity and elevation and should settle without bounce.

Celestial spring families:

| Family | Damping ratio | Stiffness |
| --- | ---: | ---: |
| Spatial fast | 0.6 | 800 |
| Spatial default | 0.8 | 380 |
| Spatial slow | 0.8 | 200 |
| Effects fast | 1.0 | 3800 |
| Effects default | 1.0 | 1600 |
| Effects slow | 1.0 | 800 |

The runtime models a unit-mass damped harmonic oscillator and samples the output into Web Animations keyframes.

Current real usage:

- global search overlay entrance uses the spatial-default spring
- cards, controls, and tabs use tokenized spatial/effects transitions
- progress changes use spatial motion

Rules:

1. movement / scale / expansion -> spatial spring
2. color / opacity / elevation -> effects spring
3. do not animate every state
4. do not bounce financial confirmations or error states
5. preserve clear cause and effect
6. respect `prefers-reduced-motion`

## 6. Web development architecture

### React and Next.js

Keep server components wherever interaction is not required.

Use client components only for:

- wallet state
- forms
- transaction flows
- interactive search
- filters/tabs
- charts requiring pointer state
- motion that requires Web Animations

Do not convert the entire application to client rendering for Material.

### CSS

Order:

1. `styles/tokens.css`
2. minimal `app/globals.css`
3. `styles/base.css`
4. page/component CSS Modules

`globals.css` is no longer a design system. It contains only application compatibility primitives.

Component visuals belong in CSS Modules or the reusable M3 primitive layer.

### Design tokens

Material Web documents CSS custom properties as the web representation of Material design tokens. Celestial follows the same model.

Component styles should consume system roles instead of reference values wherever possible.

### Accessibility

Keep native controls where practical:

- `<button>` for button interactions
- `<input>` / `<textarea>` / `<select>` for forms
- `<a>` for navigation

Required:

- visible focus state
- keyboard operation
- semantic disabled state
- `aria-pressed` for selectable chips
- labels on icon-only controls
- adequate text and state contrast
- status text must not rely on color alone

### Responsive behavior

Material 3 guidance is adaptive, not device-branded.

Celestial currently uses practical web breakpoints around content needs rather than copying mobile Android dimensions.

At narrower widths:

- top app-bar navigation condenses
- cards reduce columns
- market layout becomes one pane
- trade terminal moves into document flow
- forms become one column
- analytics grids collapse

### Material Web package

Do not install `@material/web` globally by default.

It may still be used selectively later if a specific maintained component is materially better than our native React implementation and its browser/custom-element behavior is acceptable.

Any such dependency should be isolated behind a local React wrapper so it can be removed without rewriting business logic.

## 7. Migration completed

Material 3 migration now covers:

- semantic foundation tokens
- light/dark themes
- type scale
- shape scale
- elevation
- state layers
- spring motion system
- app header
- global search
- wallet/theme controls
- Explore shell
- Explore search and filters
- token cards
- Create flow
- token market
- price chart
- recent trades and holder lists
- Portfolio
- Analytics
- Scanner
- footer

The obsolete ~48 KB purple/cyberpunk global design layer has been removed.

## 8. Rules for future frontend work

1. Material 3 semantic roles are the default design language.
2. Do not reintroduce the pre-Material purple, cyberpunk, Avenue, or Utopia systems.
3. Do not add a second unrelated design-token system.
4. Prefer system tokens over hard-coded values.
5. Prefer component roles over generic rounded rectangles.
6. Use spatial and effects motion deliberately.
7. Keep execution logic independent from the component system.
8. Keep contract-native trading available when indexed data is degraded.
9. Verify light mode, dark mode, keyboard navigation, reduced motion, desktop, tablet, and mobile after UI changes.
10. Keep Material implementation native to React unless a dependency has a clear maintenance and product advantage.
