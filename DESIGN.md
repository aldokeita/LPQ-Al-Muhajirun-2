# LPQ Al-Muhajirun Design Contract

Status: locked foundation

This document is the visual source of truth for LPQ Al-Muhajirun. It applies
Hallmark's structure-first discipline without copying Hallmark themes or turning
the product into a design showcase.

## Visual Thesis

**A Living Learning Journal**

LPQ Al-Muhajirun should feel like a trusted record of a child's Qur'an learning
journey: warm, composed, encouraging, and operationally clear. Creativity must
make progress easier to understand and the institution easier to trust.

The product is:

- modern Islamic educational;
- premium but approachable;
- child-friendly without becoming childish;
- editorial on public pages;
- calm and work-focused inside dashboards.

The product is not:

- a generic SaaS template;
- a gaming interface outside explicitly playful features;
- a collection of unrelated glass, glow, and gradient effects;
- an ornamental Islamic theme built from visual cliches.

## Audience And Jobs

- **Public and wali santri:** understand the institution, learning method,
  activities, announcements, and registration path.
- **Admin:** scan operational health and complete data work efficiently.
- **Guru:** run today's class, attendance, assessment, and follow-up.
- **Santri/wali:** understand personal progress, attendance, payments, and notes.
- **Pentashih:** review only the assignments that require attention.

## Typography

Use the 2+1 rule. Do not introduce another font family without updating this
contract.

- **Display:** Montserrat. Headings and major institutional statements.
- **Body/UI:** Poppins. Body copy, forms, tables, navigation, and controls.
- **Outlier:** Cinzel. Wordmark or rare ceremonial/institutional moments only.
- **Deprecated:** Outfit. Existing usage may remain temporarily, but new work
  must not add more Outfit usage.

Rules:

- Display line-height: 1.05-1.2.
- Body line-height: 1.5-1.7.
- Prose measure: 45-75 characters, with 65ch as the normal ceiling.
- Use a clear weight ladder; avoid relying on small size differences alone.
- Do not scale type directly from viewport width without minimum and maximum
  constraints.

## Color

The semantic tokens in `src/styles/design-tokens.css` are authoritative for new
work. Existing HSL variables remain as compatibility aliases during gradual
migration.

- **Anchor:** institutional emerald.
- **Light paper:** warm ivory, never pure white as the dominant page surface.
- **Dark paper:** deep green-charcoal, never pure black.
- **Accent:** warm gold, used as a highlighter rather than a large fill.
- **Supporting color:** cyan may clarify information; violet is reserved for
  exceptional or playful contexts.
- Status must never rely on color alone; pair it with text or an icon.

Accent color should remain visually scarce. A screen dominated by emerald,
cyan, violet, and gold at the same time has lost hierarchy.

## Space, Shape, And Depth

- Spacing follows a 4px-based named scale.
- CSS Grid is preferred for page composition; Flexbox for component internals.
- Public pages may use deliberate asymmetry and generous negative space.
- Dashboards prioritize scanning density, alignment, and stable dimensions.
- Avoid nested cards and identical three-card feature rows.
- Operational cards should normally use an 8px radius. Larger radii are
  reserved for hero media, modal surfaces, and explicitly immersive moments.
- Elevation uses borders and restrained shadows. Glass is a special surface,
  not the default material for every container.

## Page Grammar

Different jobs require different structures while sharing the same tokens.

- **Homepage:** immersive opening, institutional narrative, learning journey,
  asymmetric program information, real activity media, editorial updates, one
  focused final action.
- **Profile and Qiroati pages:** long-form editorial or narrative workflow.
- **News and announcements:** editorial index plus calm reading view.
- **Gallery and facilities:** photographic composition with concise annotation.
- **Registration:** guided sequence with visible progress and clear next action.
- **Admin dashboard:** workbench; primary operational task plus supporting data.
- **Guru dashboard:** daily class workflow.
- **Santri dashboard:** personal progress journey.
- **Pentashih dashboard:** assignment and review queue.
- **TV Display:** stat-led, photographic, and readable from a distance.

Do not repeat `kicker -> heading -> paragraph -> equal cards` for every section.

## Components And States

Every interactive component must account for:

1. default;
2. hover, only where hover is available;
3. focus-visible;
4. active/pressed;
5. disabled;
6. loading;
7. error;
8. success.

Additional rules:

- Touch targets are at least 44x44 CSS pixels.
- Input and adjacent button heights match.
- Border width must not change between input states.
- Error messages explain what failed and what the user should do.
- Forms retain entered data when saving fails.
- Reversible actions prefer an undo affordance over unnecessary confirmation.

## Motion

Motion serves comprehension. One orchestrated moment is better than constant
ambient movement.

- Micro interaction: 120ms.
- Minor transition: 220ms.
- Major transition: 420ms.
- Animate transform and opacity for spatial motion.
- Use exponential ease-out for entrances and ease-in for exits.
- Hero or explicitly playful features may own the strongest motion.
- Dashboards use functional motion for state changes, progress, and feedback.
- Avoid infinite glow, universal hover lift, bouncing UI, and decorative loops.
- Every animation has a reduced-motion alternative.

## Responsive Contract

Design mobile and desktop as intentional compositions.

- Baseline checks: 360-390px, 430px, 768px, 1280px, and 1440px.
- Breakpoints follow content failure, with 40rem, 60rem, and 90rem as defaults.
- Interactive labels do not wrap unexpectedly.
- Use `minmax(0, 1fr)` for image-bearing grid tracks.
- Use `overflow-x: clip` for intentional visual overflow.
- Avoid hover-only functionality.
- Tables become task-focused mobile summaries when horizontal scrolling would
  make the workflow difficult.
- Media includes explicit dimensions and appropriate loading behavior.

## Accessibility

Target relevant WCAG 2.2 AA practices:

- semantic landmarks and heading hierarchy;
- keyboard operation and visible focus;
- sufficient text, icon, and focus-ring contrast;
- meaningful alt text;
- associated labels, help text, and errors;
- understandable status messages;
- reduced-motion support;
- content remains usable without animation, WebGL, blur, or transparency.

## Anti-Patterns

Do not introduce:

- full-page purple/cyan gradient styling;
- equal cards with the same icon-heading-copy formula;
- centered composition for every section;
- card inside card;
- gradients on every button or heading;
- glass on every surface;
- decorative animation without a communication purpose;
- fabricated statistics, testimonials, or institutional content;
- desktop layouts merely shrunk onto mobile;
- visual changes that hide loading, empty, error, or access states.

## Adoption Rule

Apply this contract incrementally:

1. foundation tokens and global states;
2. one page or workflow at a time;
3. responsive and accessibility verification;
4. visual QA against adjacent pages;
5. build and regression checks before commit.

Existing pages are not required to change all at once. New work must use this
contract, and touched legacy areas should move toward it without unrelated
refactors.
