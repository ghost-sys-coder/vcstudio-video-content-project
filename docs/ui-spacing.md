# Application spacing

Spacing is defined in `app/spacing.css` and loaded by `app/globals.css`. It is shared by Light and Dark. Use Tailwind's 4px scale for internal details: 4, 8, 12, 16, 20, 24, 32, 40, and 48px. Choose a value for a relationship rather than adding an offset to an individual screen.

## Shared geometry

| Relationship                          | Phone | Tablet, from 640px | Desktop, from 1024px |
| ------------------------------------- | ----- | ------------------ | -------------------- |
| Page gutter on each side              | 16px  | 24px               | 32px                 |
| Page sections / header to content     | 24px  | 24px               | 32px                 |
| Standard card-grid gap                | 16px  | 16px               | 24px                 |
| Panel and default shadcn card padding | 16px  | 24px               | 24px                 |
| Bottom page clearance                 | 32px  | 32px               | 48px                 |
| Title to description / label          | 8px   | 8px                | 8px                  |
| Related content within a section      | 16px  | 16px               | 16px                 |

The navbar and main content share `app-container`, capped at 1600px and centered on wide displays. The navbar stays 56px high with 16px top clearance. The desktop inset surface uses the shared 12px shell margin; workbench height accounts for both vertical margins. The shell owns the page gutters and vertical clearance; routed pages add no competing outer padding. A collapsed sidebar changes the available width without changing these rules. The inset surface is a structural `div`, with one main-content landmark inside it.

Navigation controls reserve their own space instead of shrinking out of view. The application uses 44px sidebar/account targets, truncates long workspace/account labels, and shows the account name from 1024px. Below 1024px the public header uses a shadcn Sheet for section links and account actions; the single header row remains 56px high. The sheet scrolls on short screens, closes after navigation and when resized to desktop, and retains keyboard focus management. Keep these breakpoints consistent when extending the navigation.

Sidebar tooltips are disabled while expanded and on mobile, where labels are already visible. Hiding their popup alone leaves an invisible tooltip able to consume Escape before the mobile drawer can close.

## Page composition

```tsx
<section className="app-page">
  <header className="app-page-header">
    <div className="app-heading">
      <h1>Projects</h1>
      <p>Manage the workspace's productions.</p>
    </div>
    <Button>Create project</Button>
  </header>
  <div className="app-grid md:grid-cols-2 xl:grid-cols-3">
    {/* Existing shadcn cards or domain card components. */}
  </div>
</section>
```

- `app-page` supplies a vertical page stack. Do not add `space-y-*`, competing `gap-*`, or sibling `mt-*` to that stack.
- `app-page-header` wraps a title group and its actions when space is limited.
- `app-heading` supplies the 8px title/description rhythm and clears competing heading/paragraph block margins. Do not add 2px text offsets.
- `app-section` groups related content with a 16px gap.
- `app-grid` supplies responsive grid spacing; its column definition remains specific to the workflow.
- `app-panel` supplies padding for custom panels. Shadcn `Card` uses the same token automatically; `size="sm"` remains a deliberate compact option.
- `app-form-page` constrains forms to 1024px, aligned with the common left edge. `app-reading-page` constrains prose to 768px. Neither creates another page gutter.
- `app-workbench` accounts for the shell's chrome and dynamic viewport height. Use it for a bounded conversation/editor surface instead of subtracting a fixed navbar height from `100vh`.

Keep navigation, labels, counters, tables, editing controls, timeline geometry, and dense thumbnail grids at appropriate 4/8/12/16px spacing. Media aspect ratios and renderer coordinates are functional geometry and do not inherit page spacing. Avoid changing those values during a general page-spacing update.

## Form controls

Use the existing shadcn `Select` primitives, with `FormSelect` for a named form field or a simple controlled choice. `FormSelect` supplies labels before the popup opens and preserves uncontrolled form reset behavior. Every `SelectItem` must have an explicit string value, including `value=""` for an empty choice. Use `Input` for neighboring text, number, date, time, and color fields. Both `SelectTrigger` and `Input` are 40px tall by default; keep that height consistent across a row. A multiline textarea, checkbox, radio, or range slider retains its appropriate geometry.

## Other surfaces

The public site uses `app-public-container` with the same responsive gutters and a 1280px cap. Its hero, graphic mockups, and promotional sections retain their larger composition spacing. Legal headers and articles share `app-legal-container`, capped at the 768px reading width. Authentication, onboarding, and invitations use `app-standalone` for viewport-safe centering and the same responsive gutters. Dialogs and sheets retain the existing shadcn spacing and viewport clearances.

## Verification

Check representative screens at 390, 768, 1280, 1680, and 2560px, with expanded/collapsed navigation and Light/Dark themes. Confirm navbar/content alignment, consistent section gaps, readable form widths, wrapping heading actions, no horizontal page overflow, and usable editor/chat heights. Exercise dialogs and existing actions with mocked data. Marketing Studio must remain paused; UI verification does not authorize database reads, worker starts, provider calls, or schedule changes.
