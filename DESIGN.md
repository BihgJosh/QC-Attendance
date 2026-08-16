---
name: Quality Control Unit
description: A precise, approachable operational interface for excellence, accountability, and service.
colors:
  primary: "hsl(199 75% 54%)"
  primary-foreground: "hsl(0 0% 100%)"
  accent: "hsl(277 80% 36%)"
  accent-foreground: "hsl(0 0% 100%)"
  background: "hsl(250 50% 99%)"
  foreground: "hsl(222 47% 11%)"
  card: "hsl(0 0% 100%)"
  secondary: "hsl(210 40% 96%)"
  muted-foreground: "hsl(215 16% 47%)"
  border: "hsl(214 32% 91%)"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  brand-blue: "#39A9DB"
  brand-purple: "#8E14A8"
  royal-purple: "#6D0E83"
  soft-cyan: "#EAF9FF"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.006em"
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.16em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  button-gradient:
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  input-default:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "48px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-default:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: Quality Control Unit

## Overview

**Creative North Star: "The Calm Operations Desk"**

The Quality Control Unit interface presents serious operational work with calm clarity. Cool, pale surfaces keep information readable while the established cyan-to-purple identity supplies recognition, emphasis, and a measured sense of energy.

The system is compact, touch-friendly, and gently dimensional. Strong headings, short labels, precise rounded controls, and restrained surface lift help members scan responsibilities and complete forms without the interface feeling clinical. “Excellence is our culture” is expressed through order, legibility, and dependable states rather than decoration alone.

**Key Characteristics:**

- Cool paper-like backgrounds with white or translucent working surfaces.
- Cyan primary actions and selective purple brand emphasis.
- Bold, tightly tracked headings paired with highly legible Geist body text.
- Rounded, tactile controls with restrained shadows and explicit focus states.
- Mobile-first spacing that opens into centered, bounded desktop layouts.

## Colors

The palette combines a cool near-white operational canvas with confident cyan and purple brand accents, grounded by deep navy text and clear semantic status colors.

### Primary

- **Signal Cyan:** The principal action, link, selection, and focus color; it should mark the next useful interaction rather than wash large reading surfaces.

### Secondary

- **QC Purple:** Brand emphasis and the second endpoint of the signature gradient; use selectively for identity, hierarchy, and high-value accent moments.
- **Royal Purple:** A deeper supporting brand tone used in navigation and atmospheric gradients.

### Neutral

- **Cool Paper:** The default page background, keeping long operational screens bright without becoming stark.
- **Clear White:** The card, popover, and high-clarity working surface.
- **QC Navy:** The primary text color and the foundation of dark branded navigation.
- **Quiet Slate:** Supporting text for explanations, metadata, and secondary status.
- **Mist Border:** Low-contrast boundaries between controls and surfaces.

### Named Rules

**The Signal, Not Wallpaper Rule.** Cyan and purple identify actions, active states, and brand moments; routine content remains on neutral surfaces.

**The Semantic Color Rule.** Success, warning, and danger colors communicate their actual state and are not used as interchangeable decoration.

## Typography

**Display Font:** Geist Sans (with system-ui and sans-serif fallbacks)
**Body Font:** Geist Sans (with system-ui and sans-serif fallbacks)
**Label/Mono Font:** Geist Mono for genuinely monospaced data only

**Character:** A single modern sans-serif family keeps the application direct and operational. Weight, scale, tracking, and case create hierarchy without introducing a decorative display face.

### Hierarchy

- **Display** (700, 3rem, 1 line-height): Major desktop page statements; use sparingly and reduce responsively on small screens.
- **Headline** (700, 1.875rem, 1.1 line-height): Page and major section headings with compact negative tracking.
- **Title** (700, 1.25rem, 1.25 line-height): Card, workflow, and subsection titles.
- **Body** (400, 0.875rem, 1.5 line-height): Forms, explanations, and operational copy; longer text commonly uses a six-unit line height and bounded width.
- **Label** (700, 0.75rem, 0.16em tracking): Eyebrows and compact category labels; uppercase is reserved for these short navigational cues.

### Named Rules

**The Weight Before Ornament Rule.** Establish hierarchy through size, weight, and measured tracking; do not add decorative type treatments to routine product copy.

## Layout

Pages are mobile-first and centered inside bounded containers: the primary application shells use approximately 72–80rem maximum widths, while focused member workflows use a narrower 72rem frame. Outer gutters begin at 1rem, increase to 1.5rem on small screens, and reach 2rem on large screens. Vertical rhythm is built primarily from 0.5, 0.75, 1, 1.5, and 2rem intervals.

Operational groups stack by default, become two-column grids where field relationships remain clear, and expand to three columns only for peer tool cards on wide screens. Navigation retains minimum 44px touch targets and accounts for device safe-area insets. Mobile fields render at a 1rem font size to preserve native usability and prevent unwanted zoom.

**The Bounded Workspace Rule.** Let the ambient page extend edge to edge, but keep navigation, reading, and forms inside a centered maximum-width workspace.

**The Mobile Sequence Rule.** Preserve the task's reading and action order when columns collapse; never rely on desktop position alone to explain hierarchy.

## Elevation & Depth

The system uses a hybrid of tonal layering, translucent glass, and restrained offset shadows. Default surfaces sit close to the page; raised or interactive surfaces gain a broader shadow and, on precise pointing devices, may lift by one or two pixels. Branded navigation uses deeper shadow against the ambient background. Glass surfaces retain a visible border and must fall back to opaque backgrounds when reduced transparency is requested.

### Shadow Vocabulary

- **Surface:** `0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px -18px rgba(15, 23, 42, 0.22)` for default cards and contained work areas.
- **Raised Surface:** `0 2px 5px rgba(15, 23, 42, 0.06), 0 22px 52px -24px rgba(15, 23, 42, 0.30)` for emphasized or hovered surfaces.
- **Control:** `0 1px 2px rgba(15, 23, 42, 0.05), 0 5px 14px -10px rgba(15, 23, 42, 0.22)` for buttons, inputs, and compact controls.

### Named Rules

**The Restrained Lift Rule.** Depth clarifies containment and interaction; routine surfaces never float dramatically above the page.

## Shapes

Corners are consistently soft and precise. Controls use a 10px radius, core surfaces and navigation commonly use 14px, and larger or emphasized containers may use 18px. Status badges and avatars use fully rounded silhouettes. Borders are one pixel and low contrast, becoming more visible on hover, focus, or high-contrast preferences.

**The Nested Radius Rule.** Smaller elements inside a rounded surface use an equal or smaller radius so the visual nesting remains orderly.

## Components

### Buttons

- **Shape:** Compact rounded rectangles (10px) with at least 44px default height and semibold labels.
- **Primary:** Signal Cyan with white text and 8px × 20px padding; the gradient variant moves from brand cyan to QC Purple for selected high-value actions.
- **Hover / Focus:** Hover slightly strengthens fill or shadow. Keyboard focus uses a visible two-pixel ring with offset; active presses scale to 97.5%. Disabled controls reduce opacity and saturation.
- **Secondary / Ghost / Outline:** Secondary uses the pale neutral fill, outline uses a lightly translucent page surface and border, and ghost stays visually quiet until hover.

### Chips

- **Style:** Fully rounded, compact labels with tinted semantic backgrounds and strong matching text.
- **State:** Use for roles, statuses, and short categories. Selected interactive pills may invert to a solid primary fill; passive badges remain softly tinted.

### Cards / Containers

- **Corner Style:** Soft large corners (14px), occasionally 18px for prominent containers.
- **Background:** Clear white, translucent card, or glass over the ambient canvas.
- **Shadow Strategy:** Default Surface shadow; Raised Surface only for emphasis or interaction.
- **Border:** A low-contrast one-pixel Mist Border where separation is needed.
- **Internal Padding:** Usually 20–24px, expanding to 32px in roomy desktop form sections.

### Inputs / Fields

- **Style:** 48px-high controls with a 10px radius, light border, translucent background, 16px horizontal padding, and Control shadow.
- **Focus:** Primary-tinted border plus a three-pixel translucent primary ring; never remove focus indication without replacement.
- **Error / Disabled:** Errors use explicit danger feedback; disabled fields use a muted background, lower opacity, and a not-allowed cursor.

### Navigation

Navigation is a compact rounded bar with the QC logo, concise product identity, and 40–44px icon or text actions. Branded top bars use a deep navy-to-purple gradient with white text, muted inactive links, subtle translucent hover fills, and cyan focus rings. Desktop links may sit inline; mobile navigation becomes a clearly labeled compact menu without changing information order.

## Do's and Don'ts

### Do:

- **Do** use neutral surfaces for sustained reading and reserve brand color for identity, state, and action.
- **Do** maintain 44px minimum touch targets and visible keyboard focus across navigation and controls.
- **Do** preserve the established 10px control and 14px surface corner rhythm.
- **Do** provide opaque and reduced-motion behavior when the user's accessibility preferences request it.
- **Do** use semantic colors with accompanying labels or icons where status meaning matters.

### Don't:

- **Don't** turn a surface-specific composition, including the profile's membership-passport presentation, into a mandatory global layout.
- **Don't** cover routine forms or dense operational content in strong gradients.
- **Don't** use large shadows, continuous floating motion, or decorative lift that competes with task completion.
- **Don't** use uppercase tracked labels for sentences, body copy, or primary form instructions.
- **Don't** rely on translucency, color, or a profile image as the sole carrier of meaning.
