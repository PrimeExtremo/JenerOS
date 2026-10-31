# jener.dev portfolio: combined design brief

Built from every installed web and design skill. When rules disagree, the order is: accessibility (Apple, Vercel) → taste-skill house rules → the dealt direction → motion-design → copy.

## Direction (taste-skill draw, seed 490705673)
- **The pinned poster.** Something holds still while what Jener builds passes under it.
- **Idea:** the layers Jener builds, from boot to pixel, become the pinned poster. The headline holds while the real screens pass.
- **The one interactive piece:** a Dark/Light switch in the hero frame that flips the real JenerOS screens (CSS `:has()`, no script).
- **Type:** Big Shoulders 800 uppercase for display; Public Sans 400/600 for text. Self-hosted, because the CSP blocks Google Fonts.
- **Colour:** mustard ground `#e1ac10`, black ink `#0b0b0b`, darker mustard surface `#cd9d0f`. Royal blue `#24338f` only on the primary action. Contact is the inverse (black ground, mustard ink).
- **Sections:**
  1. Hero: a sentence split by a frame, with a scroll-driven reel.
  2. Work: full panels, one midline row.
  3. Showcase: one frame, three distances.
  4. Stack: a pinned title with layers passing behind it.
  5. Contact: the email as display type.
  6. Footer: one quiet line.

## House rules (taste-skill)
- Headlines at most two lines at every width.
- None of these: eyebrows, monospace, index numbers, thin rules, gradients, resting shadows or glows, glass or backdrop blur, the assistant palette, tiny tracked caps, icon cards, styled accent words.
- At most two typefaces and five type sizes.
- At least four real pictures: JenerOS interface crops, the portrait, a CC0 single-board-computer photo, and the preview film as the moving picture.
- Every found picture is credited.

## Apple HIG
- Motion is purposeful and optional; `prefers-reduced-motion` removes travel and keeps all content.
- No launch-screen branding, so the old opening title sequence is removed.
- Never animate into or out of blur. The accent goes only on the primary action.
- Familiar components: a plain top bar, real links, one button style.

## Vercel web interface guidelines
- Visible `:focus-visible` on every control and a skip link.
- `alt` text and width/height on every image; lazy-load below the fold.
- `color-scheme` and `theme-color` match the page.
- Animate only transform and opacity, and never `transition: all`.
- `text-wrap: balance` on headings; safe-area insets; no horizontal scroll.
- Real `mailto:` and `https:` links.

## Motion design
- Premium personality: one signature ease `cubic-bezier(.16,1,.3,1)`.
- Entrances rise 24px with opacity, staggered 70ms, with a total stagger under 500ms.
- Scroll-driven moves are tied to scroll (sticky and `animation-timeline`), never hijacking it.

## Copy (stop-slop)
Plain, specific, active, with the reader as "you". No adverbs, em dashes or quotable slogans.
