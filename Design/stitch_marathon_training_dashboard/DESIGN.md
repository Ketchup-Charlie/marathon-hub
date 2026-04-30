---
name: Performance Terminal
colors:
  surface: '#0e141a'
  surface-dim: '#0e141a'
  surface-bright: '#343a41'
  surface-container-lowest: '#090f15'
  surface-container-low: '#161c23'
  surface-container: '#1a2027'
  surface-container-high: '#252b31'
  surface-container-highest: '#2f353c'
  on-surface: '#dde3ec'
  on-surface-variant: '#c6c6cb'
  inverse-surface: '#dde3ec'
  inverse-on-surface: '#2b3138'
  outline: '#8f9095'
  outline-variant: '#45474b'
  surface-tint: '#c3c6cf'
  primary: '#c3c6cf'
  on-primary: '#2d3137'
  primary-container: '#0d1117'
  on-primary-container: '#797d85'
  inverse-primary: '#5b5e66'
  secondary: '#ffd799'
  on-secondary: '#432c00'
  secondary-container: '#feb300'
  on-secondary-container: '#6a4800'
  tertiary: '#2ddbde'
  on-tertiary: '#003738'
  tertiary-container: '#001414'
  on-tertiary-container: '#008b8d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dfe2eb'
  primary-fixed-dim: '#c3c6cf'
  on-primary-fixed: '#181c22'
  on-primary-fixed-variant: '#43474e'
  secondary-fixed: '#ffdeac'
  secondary-fixed-dim: '#ffba38'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#604100'
  tertiary-fixed: '#5af8fb'
  tertiary-fixed-dim: '#2ddbde'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#004f51'
  background: '#0e141a'
  on-background: '#dde3ec'
  surface-variant: '#2f353c'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  metric-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  code-data:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
spacing:
  unit: 4px
  gutter: 12px
  margin: 16px
  container-padding: 12px
---

## Brand & Style

This design system is engineered for the high-performance athlete who views their body as a high-precision machine. The aesthetic draws heavily from financial terminals and command-line interfaces, prioritizing raw data over decorative elements. 

The design style is a hybrid of **Technical Brutalism** and **Minimalism**. It rejects depth, gradients, and soft edges in favor of high-information density, structural clarity, and absolute flatness. The emotional response is one of clinical focus and disciplined analysis, mirroring the mental state of an elite marathoner.

## Colors

The palette is strictly functional. The primary background uses a deep navy slate to minimize eye strain during long analytical sessions. 

- **Primary (#0d1117):** Used for the base canvas and primary containers.
- **Secondary Amber (#FFB300):** Reserved for high-intensity metrics, warnings, and critical zones (e.g., Anaerobic thresholds or heart rate spikes).
- **Tertiary Teal (#00CED1):** Used for steady-state data, recovery metrics, and successful pace targets.
- **Border Neutral (#30363d):** A subtle grey used for all structural divisions.
- **Text Primary (#F0F6FC):** A high-contrast off-white for maximum legibility against the navy base.

## Typography

This design system utilizes **Space Grotesk** across all levels to maintain a technical, geometric feel that mimics monospace fonts while offering superior readability at varying scales. 

Typography is utilized as a data visualization tool: larger weights and sizes are reserved for live metrics (Pace, BPM), while condensed, uppercase labels are used for axis titles and metadata. Every character must feel intentional and aligned to the grid.

## Layout & Spacing

The layout follows a **Rigid Grid** model with high density. Content is organized into a modular dashboard format where every pixel is accounted for. 

- **Grid:** A 12-column system with tight 12px gutters.
- **Density:** High. Vertical rhythm is based on a 4px baseline grid.
- **Alignment:** All elements must align to the outer stroke of their containers. There is no "breathable" whitespace; instead, clear borders define the separation of data points.

## Elevation & Depth

This design system employs a **Flat UI** philosophy. There are no shadows, blurs, or Z-axis depth markers. 

Hierarchy is established through **Tonal Layering** and **Thin Borders**:
1. **Level 0:** Base background (#0d1117).
2. **Level 1:** Component containers defined by a 1px solid border (#30363d).
3. **Level 2:** Active states or headers using a slight background tint or solid accent fills.

Interaction is indicated by color shifts (e.g., a border changing from Neutral to Teal) rather than physical lifts or shadows.

## Shapes

The shape language is strictly **Rectilinear**. All corners are set to 0px (Sharp). This reinforces the terminal aesthetic and maximizes the screen real estate for data visualization. 

Any deviation from sharp corners is prohibited, as it softens the clinical, analytical tone of the performance tool. Lines are always 1px thick—never thinner, never thicker—unless used as a filled progress bar.

## Components

### Buttons
Buttons are strictly rectangular with 1px borders. 
- **Primary:** Solid Teal background with Primary Navy text.
- **Secondary:** Transparent background with 1px Amber border and Amber text.
- **Hover State:** Invert colors (Background becomes text color, text becomes background color).

### Data Cards
Cards are simple containers with a 1px #30363d border. They should include a top-aligned label in `label-caps` style and a centered or left-aligned `metric-lg` value.

### Inputs
Input fields are underlined or fully boxed with 1px borders. The cursor should be a solid block (Terminal style) when focused. Text entry uses `code-data` styling.

### Status Indicators
Small 8px by 8px squares (not circles).
- **Active/Optimal:** Teal.
- **Warning/Threshold:** Amber.
- **Inactive:** Border-only.

### Sparklines
High-density line charts with no area fill and no smoothing. Angles should be sharp and points visible only on hover.