# Compact Public Layout Design

## Problem

The public academic site uses large-desktop typography and spacing on a 13-inch laptop. At the user's observed viewport, the homepage headline and portrait are clipped below the fold, while standard route mastheads consume most of the first screen before page content begins.

## Approved direction

Retain the current editorial identity, Source Serif 4/Inter typography, copy, portrait treatment, navigation, cards, and color system. Correct only responsive scale and vertical density.

## Homepage contract

- The headline uses a maximum of `4rem`, scales fluidly below that value, and remains visually dominant without becoming display-wall typography.
- The hero uses compact block padding and a viewport-aware minimum height rather than a fixed 650px composition.
- The portrait remains fully visible at laptop widths and is capped at a balanced editorial size.
- At `1280 × 800`, the complete headline, portrait, supporting paragraph, primary actions, and profile controls appear within the initial viewport.

## Route masthead contract

- Standard page titles use a maximum of `3.65rem`.
- Page padding, masthead bottom padding, and the gap before route content are reduced by roughly half.
- The first substantive route content must begin within the initial `800px` viewport at laptop width.
- Post and course mastheads inherit the same compact rhythm.

## Responsive behavior

- Desktop and laptop layouts retain the two-column hero.
- Mobile retains its portrait-first stack, with smaller title scale and no horizontal overflow.
- Existing dark mode, navigation behavior, touch targets, and accessibility remain unchanged.

## Verification

- Add source-contract checks for the compact title and spacing tokens before implementation.
- Build Jekyll and run existing public-site and Course App regression checks.
- Review homepage plus representative route mastheads at `1280 × 800`, `1440 × 1000`, and `390 × 844`.
- At `1280 × 800`, assert the homepage hero's bottom is within the viewport and representative route content begins above the fold.

## Scope exclusions

- No copy changes.
- No component, navigation, data, or route changes.
- No changes under `assets/course-materials/**` or `supabase/**`.
