# TC2007B Course App Command Center design

Date: 2026-07-20

Status: Approved design direction; implementation not started

Primary surface: `assets/course-materials/information-security/app/index.html`

Approved direction: Instructor Command Center

## Decision summary

Redesign the signed-in instructor home from a metadata-first card grid into a role-aware command center. The selected course, section, and class session become persistent context. The current session and its next useful action become the main focus. Released materials and supported review shortcuts remain visible as compact secondary panels. Identity, role, enrollment, sign-out, and semester-management tools move into quieter account and navigation treatments.

Retain the established Inter and JetBrains Mono typography, blue/teal academic identity, light and dark themes, accessible focus behavior, and all existing authenticated capabilities. This project changes information architecture and presentation; it does not change authentication, authorization, Supabase contracts, release rules, grading logic, or route behavior.

## Design references

- [Superdesign project canvas](https://superdesign.dev/teams/951c9f69-2cdd-4b5d-a93a-fc8a7c1f71fb/projects/6d1a4771-270c-4743-ae56-c16d7f700312)
- [Approved Instructor Command Center draft](https://p.superdesign.dev/draft/8c4fd3ed-fdc2-4ca4-9675-3b7e7de58566)
- [Guided Class Workflow alternative](https://p.superdesign.dev/draft/4d749227-b7e4-490a-8a29-2bba23d2761f)
- [Current-interface reproduction](https://p.superdesign.dev/draft/bcf84ace-fd08-4a4c-8d18-e52ae45b8552)

The Superdesign draft is a visual and structural reference, not an independent source of product truth. Existing source files, permissions, routes, and returned API data remain authoritative. Placeholder or invented draft data must not be implemented.

## Current-state problem

The current signed-in page exposes the necessary operations, but its visual hierarchy does not match the instructor workflow:

- Profile, role, and enrollment metadata occupy the first and strongest dashboard row.
- The active teaching context and current-session shortcuts appear below that metadata.
- Instructor destinations are rendered as a long stack of visually identical links.
- Auto-fit cards create large empty columns and uneven card heights.
- The page does not clearly communicate the next action for the selected live class.
- Student and instructor concerns share the same grid without enough role-based prioritization.

The result is functionally complete but operationally slow: a returning instructor must scan past identity information before reaching the controls used during class.

## Product and security boundary

The public GitHub Pages course site remains the public course front door. The authenticated Supabase-backed Course App remains the protected classroom system for released content, activities, submissions, grades, student records, and instructor operations.

This redesign must not move protected data into public HTML or treat visual hiding as authorization. Existing server-side authorization, role checks, roster gating, release controls, and authenticated API requests remain unchanged.

## Users and jobs to be done

### Instructor

The home page should answer four questions immediately:

1. Which course, section, and session am I operating?
2. Is the selected session scheduled, live, or completed?
3. What is the next useful action for that state?
4. Which materials and review tools are available for this context?

The broader instructor sequence remains:

1. Manage sections and roster.
2. Prepare class sessions and the content library.
3. Configure release controls.
4. Run the live class and record participation.
5. Review gradebook, student records, insights, and audit history.

### Student

The same home route remains role-aware. A student should continue to see released materials and student actions, without instructor navigation or controls. A later design iteration may refine the student-specific composition, but instructor-only UI must never leak into the student state.

## Approved information architecture

### 1. Application navigation

On desktop, use a compact left navigation with these groups:

- Overview
  - Course Home (`index.html`)
- Teach
  - Class Sessions (`sessions.html`)
  - Release Controls (`releases.html`)
  - Participation (`participation.html`)
- Review
  - Gradebook (`gradebook.html`)
  - Student Records (`student-records.html`)
  - Learning Insights (`insights.html`)
  - Audit Log (`audit.html`)
- Manage
  - Course Sections (`sections.html`)
  - Course Roster (`roster.html`)
  - Content Library (`content-library.html`)

The current destination must have an explicit active state. The navigation is role-gated and must only render instructor destinations when the authenticated context grants the applicable role.

On narrow screens, the navigation becomes a labelled menu or drawer. It must not consume permanent horizontal space below 900px and must preserve keyboard access, focus order, and a visible close action.

### 2. Compact application header

The top header contains:

- Course App identity and current page title.
- A compact account control showing the signed-in instructor name.
- Account details, refresh, theme, and sign-out actions within or adjacent to that account control.

Email, role, student/employee identifier, and enrollment details no longer receive primary dashboard cards. They remain available in the account treatment or a quiet supporting summary.

### 3. Persistent teaching-context bar

Course, section, and session selectors form one coherent horizontal context bar directly below the header. Preserve the existing select elements and their behavior:

- `courseContextSelect`
- `sectionContextSelect`
- `sessionContextSelect`

Show the selected session state using text and a semantic status treatment, such as Scheduled, Live, or Completed. Color may reinforce the state but must not be the only signal.

Changing any selector continues to update the shared context and contextual route links using the existing logic. Loading or unavailable context must disable dependent controls and explain why.

### 4. Current-session workspace

The dominant panel shows the selected session's real data:

- Session title and date.
- Section label.
- Session status.
- Available release state or released-item summary when present.
- One primary next action determined from supported state.
- A small number of secondary actions.

For the current verified context, the design may display:

- `2026-07-14 · Class 1: Introduction to Cybersecurity · Live`
- Section A
- Manage selected session
- Prepare selected releases

The implementation must render returned data rather than hard-code this example.

No new attendance percentages, response rates, class-health scores, scheduled-item counts, affiliations, or version numbers may be invented. If future APIs provide such data, they require a separate product decision before appearing here.

### 5. Released materials

Render released content as compact, scannable rows rather than tall generic cards. Each row may include:

- Material or activity type.
- Title.
- Released/live state.
- Associated class/session label when available.
- Direct link to the protected content or activity.

The verified example contains:

- Week 1 Lecture 1: Introduction to Cybersecurity.
- Week 1 Quiz: Security Foundations.

Empty state: explain that no materials are released for the selected context and provide the instructor-only release-control action when allowed.

### 6. Contextual review shortcuts

Keep these supported contextual actions visible near the current-session workspace:

- View section insights.
- Review section gradebook.

They are navigation shortcuts, not summary analytics. Do not display fabricated metrics on the home page.

### 7. Secondary tools

Frequently used supporting actions may appear as compact shortcuts after the current-session workspace. Avoid duplicating every sidebar item as a large card. The primary page should generally expose no more than four contextual shortcuts; the left navigation remains the complete destination map.

## Visual system

The implementation follows `.superdesign/design-system.md` and the existing token contract in `app.css`.

### Typography

- Inter remains the primary UI family.
- JetBrains Mono remains reserved for dates, identifiers, and compact technical metadata.
- Use the existing title, section, card, body, and eyebrow hierarchy.

### Color and surfaces

- Retain the existing neutral light and dark surfaces.
- Blue remains the primary action and active-navigation color.
- Teal remains the restrained accent for product/category labels.
- Status colors retain their semantic meaning.
- Avoid new gradients, decorative illustration, glass effects, and unrelated accent colors.

### Density and shape

- Desktop shell target: approximately 1180-1240px of content beside a 232-256px navigation rail.
- Controls remain at least 44px high.
- Use 8px, 12px, and 16px radii from the current system.
- Use borders and surface shifts for most grouping; reserve shadows for major floating layers and primary panels.
- Eliminate grid sizing that creates large empty columns or forces unrelated cards to equal height.

## Responsive behavior

### Desktop, 1200px and wider

- Persistent left navigation.
- Sticky compact header.
- Horizontal teaching-context bar.
- Current-session workspace uses a two-thirds main region and one-third supporting region.

### Tablet, 760-1199px

- Collapsible navigation.
- Teaching-context controls may wrap to two rows.
- Current-session and supporting panels stack when space becomes constrained.

### Mobile, below 760px

- Single-column content.
- Navigation is closed by default and opened with a labelled button.
- Course, section, and session selectors stack.
- Primary action becomes full width; secondary actions follow in logical order.
- Account, theme, and sign-out actions remain reachable without covering content.
- No horizontal scrolling is allowed except inside existing wide data tables on their dedicated routes.

## State model and data flow

1. `app.js` establishes the authenticated session through the existing auth helpers.
2. It fetches the current course context and roles using the existing Supabase-backed APIs.
3. The UI selects the learner or instructor composition based on returned roles; it does not infer authorization from URL parameters or DOM state.
4. Instructor context selectors render from returned courses, sections, and sessions.
5. A selector change updates the current context and regenerates contextual links using existing IDs and query parameters.
6. Released materials and actions render from the authenticated response.
7. Refresh repeats the supported context load; sign-out uses the current authentication path.

The visual redesign may reorganize render functions and DOM containers, but it must not change response schemas or weaken role checks.

## Loading, empty, and error states

### Loading

- Show stable panel skeletons or concise loading messages so the layout does not jump dramatically.
- Disable controls whose options are not yet available.
- Keep the existing `aria-live` status line for meaningful state changes.

### Empty

- No enrolled sections: explain that section enrollment is required and suppress session-dependent actions.
- No sessions: provide the instructor-only Manage Class Sessions action.
- No released items: explain the empty state and provide Prepare Release Controls when permitted.
- No student actions: retain an explicit, quiet explanation rather than a blank panel.

### Error

- Preserve the existing error tone and readable status message.
- Do not erase already loaded context when a refresh fails.
- Authentication or permission errors must not expose protected response details.
- Provide a retry action only when retrying is meaningful.

## Accessibility requirements

- Preserve semantic landmarks, heading order, labels, and list structure.
- Every icon-only control needs an accessible name.
- Sidebar active state must be conveyed beyond color.
- Context status must use visible text in addition to color.
- Navigation drawer focus must be contained while open and returned to its trigger when closed.
- Maintain existing focus-ring tokens and AA contrast.
- Preserve `prefers-reduced-motion` behavior.
- Ensure keyboard users can reach account, context, primary action, materials, shortcuts, navigation, and status feedback in a logical order.

## Implementation boundaries

### In scope

- Restructure the signed-in instructor branch in `index.html`.
- Extend `app.css` with command-center shell, navigation, header, context bar, workspace, responsive, and state styles.
- Adapt `app.js` render targets and orchestration as required by the new DOM structure.
- Preserve or deliberately map existing element IDs used by scripts and verification tools.
- Add focused verifier coverage for the new shell and role-gated navigation.

### Out of scope

- Redesigning every management route in the same implementation.
- New Supabase tables, functions, response fields, or analytics.
- Authentication or authorization changes.
- New course content, sessions, releases, grades, or student records.
- Framework migration or new UI dependencies.
- Replacing the existing light/dark token system.

The first implementation should establish the signed-in home and reusable CSS patterns. Applying the shell to other routes can follow as a separate, testable phase after the home is validated.

## Component boundaries

Even though the app is vanilla HTML and JavaScript, treat the following regions as independent UI units:

- App navigation: role-gated destination groups and active state.
- Account control: identity summary and account actions.
- Teaching-context bar: selectors, session state, and dependent availability.
- Current-session workspace: selected-session summary and next actions.
- Released-material list: protected content/activity rows and empty state.
- Review shortcuts: contextual navigation only.
- Status feedback: loading, success, warning, and error announcements.

Each unit should be renderable from explicit data and should not reach into another unit's DOM to discover state.

## Verification strategy

### Automated repository verification

- Run the existing authenticated app-shell verifier.
- Update or add verifier assertions for the new structural markers, retained IDs, role-gated destinations, and contextual links.
- Run the broader course-platform verifier if shared behavior changes.

### Manual visual verification

Test the deployed or local page at representative desktop, tablet, and mobile widths in both themes:

- Instructor with a selected live session and released items.
- Instructor with no sessions.
- Instructor with no released items.
- Student role without instructor controls.
- Signed-out authentication state.
- Loading and API-error states.

Compare the desktop instructor state with the approved Command Center draft while treating real source data as authoritative.

### Interaction verification

- Course, section, and session selector changes update context correctly.
- Contextual links preserve course, section, and session query parameters.
- Every existing instructor destination remains reachable.
- Released content and activity links remain protected and functional.
- Refresh, sign-out, theme switching, keyboard navigation, and mobile navigation work.

## Acceptance criteria

The design is successfully implemented when:

1. The current course, section, session, state, and primary next action are visible without scrolling on a typical desktop viewport.
2. Profile and role metadata no longer dominate the dashboard.
3. Instructor destinations are grouped as Teach, Review, and Manage with an explicit active state.
4. The current-session workspace uses only real supported data and actions.
5. Released materials remain directly accessible and contextually labelled.
6. Student users do not see instructor-only navigation or controls.
7. Existing authentication, permissions, release behavior, route destinations, and API contracts remain unchanged.
8. Light and dark themes, responsive layouts, focus states, reduced motion, and status announcements remain functional.
9. Existing and new app-shell verification checks pass.

## Recommended implementation sequence

1. Add verifier expectations for the new shell and role-gated navigation.
2. Introduce the command-center DOM structure while retaining script-critical IDs.
3. Add the desktop layout and existing-token styling.
4. Adapt instructor rendering and contextual-link placement.
5. Preserve and verify the student and signed-out branches.
6. Add tablet/mobile navigation and stacking behavior.
7. Verify themes, accessibility, empty/error states, and existing routes.
8. Deploy the signed-in home as a focused pilot before extending the shell to other app pages.
