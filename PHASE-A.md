# PHASE A: UX Simplification & Design Overhaul

**Goal:** Make the app feel like a modern, minimalistic desktop product — not a generic SaaS template. Clean enough that a 15-year-old starting their first lawn mowing business could use it without reading a manual. Powerful enough that a freelancer running a $200k/year business trusts it with their money.

**Design direction:** Refined utilitarian. Think Linear, Notion, or Vercel's dashboard — dark sidebar, generous whitespace, crisp typography, no decoration that doesn't earn its place. Nothing flashy. Everything intentional.

**Plain English to users:** "It just works, and it looks good doing it."

**Simplicity rules:**
- Every screen has one primary action. The user should never wonder what to do next.
- Whitespace is not emptiness — it's clarity. Increase it everywhere.
- Icons replace words where the meaning is obvious. Labels stay where they're not.
- Nothing is hidden, but not everything needs to be visible at once.

**Agent rules for this phase:**
- Read `MEMORY.md` before starting.
- Do not touch any API routes, Prisma schema, or business logic.
- Only modify layout, style, and component files.
- After each task: list every file touched and every file intentionally not touched.
- If a component doesn't exist yet (e.g. for a future phase), create it as a placeholder with `{/* TODO: Phase X */}`.

---

## Design Tokens (establish before all other tasks)

These values are the foundation. Every task in Phase A references them. Set them once in `app/globals.css` and use them everywhere via Tailwind or CSS variables.

```css
:root {
  /* Surfaces */
  --bg-base:        #0f0f10;   /* page background */
  --bg-surface:     #18181b;   /* cards, panels */
  --bg-elevated:    #1f1f23;   /* modals, dropdowns */
  --bg-subtle:      #27272a;   /* hover states, dividers */

  /* Borders */
  --border:         #2e2e32;
  --border-strong:  #3f3f46;

  /* Text */
  --text-primary:   #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted:     #71717a;
  --text-disabled:  #52525b;

  /* Brand / accent */
  --accent:         #6366f1;   /* indigo — primary actions */
  --accent-hover:   #4f46e5;
  --accent-subtle:  rgba(99, 102, 241, 0.12);

  /* Semantic */
  --success:        #22c55e;
  --warning:        #f59e0b;
  --danger:         #ef4444;
  --info:           #3b82f6;

  /* Sidebar */
  --sidebar-width:         220px;
  --sidebar-collapsed-width: 60px;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Radius */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  16px;
  --radius-xl:  24px;

  /* Typography */
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
}
```

**Tailwind config additions** (`tailwind.config.ts`):
- Extend `colors` to map the CSS vars: `sidebar`, `surface`, `elevated`, `subtle`, `accent`.
- Extend `borderRadius` to add `sm`, `md`, `lg`, `xl` matching the vars.
- Extend `fontFamily` to add `sans` and `mono`.

**Verify:** Create a test page that uses `bg-surface`, `text-secondary`, and `border` classes. Confirm they render the correct colours.

---

## Task A.1: Root layout — dark shell

**File:** `app/(app)/layout.tsx`

**Goal:** Replace whatever layout exists with the two-panel shell: collapsible sidebar left, scrollable content area right. This is the container for every authenticated page.

**Plan:**
1. The layout renders two children side by side: `<Sidebar />` and `<main>`.
2. `<main>` takes `flex-1 overflow-y-auto bg-[--bg-base] min-h-screen`.
3. Apply a CSS transition on `margin-left` that matches the sidebar width change on collapse/expand. Use a CSS variable `--sidebar-current-width` toggled by a class on `<html>` or `<body>`.
4. Do not put any padding inside `<main>` here — each page manages its own padding.
5. Wrap the whole layout in a `<SidebarProvider>` context (Task A.2) that holds the collapsed state.
6. Apply `bg-[--bg-base] text-[--text-primary] font-sans antialiased` to the `<html>` element in `app/layout.tsx`.
7. Verify: Navigate to `/dashboard`; the page renders with a dark background and a sidebar placeholder on the left.

---

## Task A.2: Sidebar — collapsible, icon-first

**File:** `app/components/layout/Sidebar.tsx` (new or replace existing)
**File:** `app/components/layout/SidebarProvider.tsx` (new context)

**Goal:** A vertical sidebar that is 220px wide when expanded and 60px when collapsed, showing only icons. Collapses and expands via a toggle button. State persists in `localStorage`.

**Plan:**

**Step 1 — SidebarProvider:**
1. Create a React context with `{ collapsed: boolean, toggle: () => void }`.
2. On mount, read `localStorage.getItem('sidebar-collapsed')` and set initial state.
3. `toggle()` flips the state and writes to `localStorage`.
4. Wrap `app/(app)/layout.tsx` in `<SidebarProvider>`.

**Step 2 — Sidebar shell:**
1. The sidebar is `fixed left-0 top-0 h-screen z-30 flex flex-col`.
2. Width: `w-[220px]` expanded, `w-[60px]` collapsed. Apply CSS transition: `transition-all duration-200 ease-in-out`.
3. Background: `bg-[--bg-surface] border-r border-[--border]`.
4. Three sections inside the sidebar: top (logo + collapse toggle), middle (nav items), bottom (user menu + settings).

**Step 3 — Logo area (top):**
1. Show the Invoice Nudger logo/wordmark when expanded. Show just the icon/monogram when collapsed.
2. Below or beside the logo, show the collapse toggle button: a `ChevronLeft` icon (Lucide) when expanded, `ChevronRight` when collapsed. Clicking it calls `toggle()`.
3. Add a subtle `border-b border-[--border]` below the logo area.

**Step 4 — Nav items (middle):**
1. Nav items are an array: `{ label, icon, href, zone }`. Zone is `1 | 2 | 3` (see progressive disclosure rules in NEXT.md).
2. Each nav item: `flex items-center gap-3 px-3 py-2 rounded-[--radius-sm] text-sm cursor-pointer`.
3. Default: `text-[--text-secondary] hover:bg-[--bg-subtle] hover:text-[--text-primary]`.
4. Active route: `bg-[--accent-subtle] text-[--text-primary] font-medium`.
5. When collapsed: hide the label (`opacity-0 w-0 overflow-hidden`), keep only the icon. The icon stays centred in the 60px column.
6. When collapsed, wrap each item in a `title` attribute for native browser tooltip showing the label.
7. Between Zone 1 and Zone 2 items, and between Zone 2 and Zone 3: render a `<hr className="border-[--border] my-2 mx-3" />` divider.
8. Items hidden by progressive disclosure rules (NEXT.md sidebar section) are simply not rendered — no greyed-out placeholders.

**Nav items (full list, in order):**
```ts
const NAV_ITEMS = [
  // Zone 1 — always visible
  { label: 'Dashboard',  icon: LayoutDashboard, href: '/dashboard',  zone: 1 },
  { label: 'Invoices',   icon: FileText,        href: '/invoices',   zone: 1 },
  { label: 'Payments',   icon: CreditCard,      href: '/payments',   zone: 1 },
  { label: 'Clients',    icon: Users,           href: '/clients',    zone: 1 },
  // Zone 2 — engaged user
  { label: 'Quotes',     icon: ClipboardList,   href: '/quotes',     zone: 2 },
  { label: 'Contracts',  icon: FilePen,         href: '/contracts',  zone: 2 },
  { label: 'Recurring',  icon: RefreshCw,       href: '/recurring',  zone: 2 },
  { label: 'Expenses',   icon: Receipt,         href: '/expenses',   zone: 2 },
  { label: 'Tax',        icon: Landmark,        href: '/tax',        zone: 2 },
  // Zone 3 — Pro/Agency
  { label: 'Time',       icon: Timer,           href: '/time',       zone: 3 },
  { label: 'My Money',   icon: Wallet,          href: '/money',      zone: 3 },
  { label: 'Bank',       icon: Building2,       href: '/bank',       zone: 3 },
  { label: 'Accounting', icon: BarChart3,       href: '/accounting', zone: 3 },
  { label: 'Insights',   icon: Lightbulb,       href: '/insights',   zone: 3 },
  { label: 'Payroll',    icon: UsersRound,      href: '/payroll',    zone: 3 },
  { label: 'Health',     icon: HeartPulse,      href: '/health',     zone: 3 },
];
```

All icons from `lucide-react` (already in stack).

**Step 5 — Bottom section:**
1. Pinned to `mt-auto` at the bottom of the sidebar.
2. Add a `border-t border-[--border]` above this section.
3. Two items: Settings (`Settings` icon, href `/settings`) and User avatar.
4. User avatar: show the first letter of the user's name/email in a circle, `bg-[--accent] text-white text-xs font-semibold`. When expanded, show name/email beside it truncated. Clicking opens a small popover with "Account" and "Sign out" options.

**Step 6 — Mobile behaviour:**
1. On screens `< 768px`: hide the sidebar entirely. Show a hamburger button (`Menu` icon) fixed at `top-4 left-4 z-50`.
2. Clicking hamburger opens the sidebar as a slide-over (fixed overlay, full height, 280px wide). Clicking outside closes it.
3. The slide-over overlay: `bg-black/50 backdrop-blur-sm`.

**Verify:**
- Expanded sidebar shows labels and icons. Collapsed shows only icons.
- Toggling collapse is instant (no layout jank).
- Active page highlights correctly.
- Mobile hamburger slides sidebar in and out.

---

## Task A.3: Page shell — consistent header + content area

**File:** `app/components/layout/PageShell.tsx` (new, used on every page)

**Goal:** Every page wraps its content in `<PageShell>`. This enforces consistent spacing, heading style, and header layout across the app.

**Plan:**
1. Props: `{ title: string, description?: string, action?: ReactNode, children: ReactNode }`.
2. Structure:
```tsx
<div className="flex flex-col min-h-screen px-8 py-8 max-w-[1200px] mx-auto">
  {/* Page header */}
  <div className="flex items-start justify-between mb-8">
    <div>
      <h1 className="text-2xl font-semibold text-[--text-primary] tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="text-sm text-[--text-muted] mt-1">{description}</p>
      )}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>

  {/* Page content */}
  <div className="flex-1">{children}</div>
</div>
```
3. The `action` prop is for the primary CTA button (e.g. "+ New Invoice"). It renders top-right, aligned with the title.
4. Verify: Wrap the dashboard page in `<PageShell title="Dashboard">`. Confirm heading renders correctly with correct spacing.

---

## Task A.4: Stat card component

**File:** `app/components/ui/StatCard.tsx` (new)

**Goal:** The standard card for summary numbers (dashboard, tax page, accounting page). Consistent across the app.

**Plan:**
1. Props: `{ label: string, value: string, subLabel?: string, icon?: LucideIcon, trend?: { value: string, positive: boolean }, href?: string, variant?: 'default' | 'highlight' | 'warning' }`.
2. Base styles: `bg-[--bg-surface] border border-[--border] rounded-[--radius-md] p-5`.
3. `variant="highlight"` adds `border-[--accent] bg-[--accent-subtle]`.
4. `variant="warning"` adds `border-[--warning]/30 bg-[--warning]/5`.
5. Layout inside the card:
   - Top row: icon (24px, `text-[--text-muted]`) left, optional trend badge right.
   - Middle: the `value` in `text-2xl font-semibold text-[--text-primary]`.
   - Bottom: the `label` in `text-sm text-[--text-muted]`. Below that, `subLabel` if present.
6. If `href` is provided, the whole card is wrapped in a `<Link>` with `hover:border-[--border-strong] transition-colors`.
7. Trend badge: a small pill `text-xs px-2 py-0.5 rounded-full`. Green if `positive`, red if not.
8. Verify: Render 4 stat cards in a `grid grid-cols-2 lg:grid-cols-4 gap-4`. Confirm layout, hover, and variant styles.

---

## Task A.5: Button component

**File:** `app/components/ui/Button.tsx` (new or replace existing)

**Goal:** One button component, four variants. No ad-hoc Tailwind button styling anywhere in the app after this.

**Plan:**
1. Props: `{ variant?: 'primary' | 'secondary' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg', icon?: LucideIcon, iconPosition?: 'left' | 'right', loading?: boolean, disabled?: boolean, children, ...rest }`.
2. Variant styles:
   - `primary`: `bg-[--accent] hover:bg-[--accent-hover] text-white font-medium`
   - `secondary`: `bg-[--bg-subtle] hover:bg-[--border] text-[--text-primary] border border-[--border]`
   - `ghost`: `bg-transparent hover:bg-[--bg-subtle] text-[--text-secondary] hover:text-[--text-primary]`
   - `danger`: `bg-[--danger]/10 hover:bg-[--danger]/20 text-[--danger] border border-[--danger]/30`
3. Size styles:
   - `sm`: `text-xs px-3 py-1.5 rounded-[--radius-sm]`
   - `md`: `text-sm px-4 py-2 rounded-[--radius-sm]`
   - `lg`: `text-sm px-5 py-2.5 rounded-[--radius-md]`
4. If `loading`: replace icon with a spinning `Loader2` icon. Disable pointer events.
5. Apply `transition-colors duration-150` to all variants.
6. Apply `disabled:opacity-50 disabled:pointer-events-none` to all.
7. Verify: Render each variant and size. Confirm loading state disables the button and shows spinner.

---

## Task A.6: Badge component

**File:** `app/components/ui/Badge.tsx` (new)

**Goal:** Status badges used on invoices, quotes, contracts, etc. Consistent styling.

**Plan:**
1. Props: `{ label: string, variant: 'unpaid' | 'paid' | 'cancelled' | 'overdue' | 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'active' | 'paused' | 'neutral' }`.
2. All badges: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`.
3. Colour map:
   ```ts
   {
     unpaid:   'bg-[--warning]/10 text-[--warning]',
     paid:     'bg-[--success]/10 text-[--success]',
     cancelled:'bg-[--bg-subtle] text-[--text-muted]',
     overdue:  'bg-[--danger]/10 text-[--danger]',
     draft:    'bg-[--bg-subtle] text-[--text-muted]',
     sent:     'bg-[--info]/10 text-[--info]',
     accepted: 'bg-[--success]/10 text-[--success]',
     declined: 'bg-[--danger]/10 text-[--danger]',
     expired:  'bg-[--warning]/10 text-[--warning]',
     active:   'bg-[--success]/10 text-[--success]',
     paused:   'bg-[--warning]/10 text-[--warning]',
     neutral:  'bg-[--bg-subtle] text-[--text-secondary]',
   }
   ```
4. Show a small dot (4px circle, same colour as text) before the label.
5. Verify: Render each variant. Confirm colours and dot render correctly.

---

## Task A.7: Table component

**File:** `app/components/ui/Table.tsx` (new)

**Goal:** One table component used across invoices, quotes, clients, expenses. Replaces any ad-hoc table markup.

**Plan:**
1. Export `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell`, `TableHeaderCell` — composable, not a monolith.
2. `Table`: `w-full text-sm border-collapse`.
3. `TableHead`: `border-b border-[--border]`.
4. `TableHeaderCell`: `px-4 py-3 text-left text-xs font-medium text-[--text-muted] uppercase tracking-wider`.
5. `TableRow`: `border-b border-[--border]/50 hover:bg-[--bg-subtle]/50 transition-colors`.
6. `TableCell`: `px-4 py-3 text-[--text-secondary]`. First child of a row: `text-[--text-primary]`.
7. Wrap the table in a `<div className="overflow-x-auto rounded-[--radius-md] border border-[--border] bg-[--bg-surface]">`.
8. Empty state: if no rows, render a centred block inside the table body: icon + heading + subtext. Pass as `emptyState` prop.
9. Verify: Render the invoices table using this component. Confirm hover, border, and empty state work.

---

## Task A.8: Input + Form components

**File:** `app/components/ui/Input.tsx` (new)
**File:** `app/components/ui/Select.tsx` (new)
**File:** `app/components/ui/FormField.tsx` (new)

**Goal:** Consistent, accessible form inputs. No raw `<input>` with ad-hoc styling anywhere in the app.

**Plan:**

**Input:**
1. Props: `{ label?: string, error?: string, hint?: string, icon?: LucideIcon, prefix?: string, ...inputProps }`.
2. Base input styles: `w-full bg-[--bg-elevated] border border-[--border] rounded-[--radius-sm] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-disabled] focus:outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent] transition-colors`.
3. Error state: replace border with `border-[--danger] focus:border-[--danger] focus:ring-[--danger]`.
4. If `icon`: render it inside the input left, add `pl-9`.
5. If `prefix` (e.g. `"$"`): render it as a non-interactive prefix block left of the input, `bg-[--bg-subtle] border-r border-[--border] px-3 text-[--text-muted]`. Use `rounded-l-[--radius-sm] rounded-r-none` on prefix, `rounded-l-none rounded-r-[--radius-sm]` on input.

**Select:**
1. Same base styles as Input but for `<select>`. Add `appearance-none` and a `ChevronDown` icon absolutely positioned right.

**FormField:**
1. Wrapper: renders `label`, `Input` (or `Select`), `hint`, and `error` stacked with `gap-1.5`.
2. Label: `text-sm font-medium text-[--text-secondary]`. Required indicator: `text-[--danger]` asterisk.
3. Hint: `text-xs text-[--text-muted]`.
4. Error: `text-xs text-[--danger]`.

**Verify:** Render a form with 3 fields including one with an error. Confirm label, input, error, and hint layout correctly.

---

## Task A.9: Modal component

**File:** `app/components/ui/Modal.tsx` (new)

**Goal:** One modal used for confirmations, quick-add forms, and actions. No browser `alert()` or custom one-off modals.

**Plan:**
1. Props: `{ open: boolean, onClose: () => void, title: string, description?: string, size?: 'sm' | 'md' | 'lg', children: ReactNode, footer?: ReactNode }`.
2. Backdrop: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4`.
3. Panel: `bg-[--bg-elevated] border border-[--border] rounded-[--radius-lg] shadow-xl w-full`.
4. Sizes: `sm = max-w-sm`, `md = max-w-md`, `lg = max-w-lg`.
5. Header: title (`text-base font-semibold text-[--text-primary]`) + close button (`X` icon, ghost).
6. Body: `p-6`.
7. Footer: `px-6 pb-6 flex justify-end gap-2`. Footer is optional.
8. Clicking the backdrop calls `onClose`. Pressing `Escape` calls `onClose`. Use `useEffect` to add/remove the key listener.
9. Animate: enter with `scale-95 opacity-0 → scale-100 opacity-100`, exit reverse. Use CSS transitions via a small `Transition` wrapper (or `data-state` attribute + CSS).
10. Verify: Open and close a modal. Confirm backdrop click and Escape key both close it. Confirm animation is smooth.

---

## Task A.10: Toast notifications

**File:** `app/components/ui/Toast.tsx` (replace or configure existing `react-hot-toast`)

**Goal:** Style `react-hot-toast` (already installed) to match the design system.

**Plan:**
1. In the root layout, configure `<Toaster>` with custom styles:
```tsx
<Toaster
  position="bottom-right"
  toastOptions={{
    duration: 4000,
    style: {
      background: 'var(--bg-elevated)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    },
    success: { iconTheme: { primary: 'var(--success)', secondary: 'transparent' } },
    error:   { iconTheme: { primary: 'var(--danger)', secondary: 'transparent' } },
  }}
/>
```
2. Create a `toast` helper re-export from `lib/toast.ts` so the rest of the app imports from there, not directly from `react-hot-toast`. This means only one place to change if the library swaps.
3. Verify: Call `toast.success("Invoice created.")` and `toast.error("Something failed.")`. Confirm they appear bottom-right with correct colours.

---

## Task A.11: Dashboard page redesign

**File:** `app/(app)/dashboard/page.tsx` (modify existing)

**Goal:** Replace the existing dashboard with one that shows only what matters, in a clear hierarchy. No clutter. Primary number front and centre.

**Plan:**

**Step 1 — Data fetching (server component):**
Fetch in parallel (use `Promise.all`):
- Total outstanding (unpaid invoices, sum of amounts).
- Total paid this month.
- Overdue count (unpaid invoices past due date).
- Next payment expected (earliest unpaid invoice `dueDate`).
- Recent invoices (last 5).

**Step 2 — Hero number:**
The single most important number at the top: `"$X outstanding"`. Large (`text-4xl font-semibold`). If `$0 outstanding`, show a green checkmark and `"You're all caught up."`.

**Step 3 — Stat cards row (2 on mobile, 4 on desktop):**
Using the `<StatCard>` component from Task A.4:
1. `"Paid This Month"` — green if > $0, neutral if $0.
2. `"Overdue"` — danger variant if > 0, neutral if 0. SubLabel: `"invoices past due"`.
3. `"Next Due"` — date of the next unpaid invoice's due date. SubLabel: client name.
4. `"Sent This Month"` — count of invoices sent.

**Step 4 — Recent invoices table:**
Heading: `"Recent Invoices"` with a `"View all →"` link to `/invoices`.
Use the `<Table>` component from Task A.7. Columns: Client | Amount | Due Date | Status | Action.
The `Action` column shows a single primary action per row:
- Unpaid → `"Send Reminder"` (ghost button, small)
- Overdue → `"Chase"` (danger ghost button, small)
- Paid → nothing (or a subtle `"View"` link)

**Step 5 — Quick actions:**
Below the table, show 4 quick-action buttons in a row. Use `<Button variant="secondary">` with an icon:
- `+ New Invoice` → `/invoices/new`
- `+ Log Expense` → opens modal
- `Start Timer` → `/time`
- `New Quote` → `/quotes/new`

**Step 6 — Empty state:**
If the user has 0 invoices: hide stat cards and table. Show a centred welcome block: `"Welcome to Invoice Nudger"`, a one-line description, and a single `"Create your first invoice"` primary button.

**Verify:** Visit `/dashboard` with seeded data. Confirm hero number, stat cards, recent invoices, and quick actions all render. Visit with 0 invoices; confirm empty state shows.

---

## Task A.12: Invoice list page redesign

**File:** `app/(app)/invoices/page.tsx` (modify existing)
**File:** `app/(app)/invoices/InvoicesClient.tsx` (modify existing)

**Goal:** A clean, scannable list of invoices. Filters at the top. Table below. One primary action (+ New Invoice) that's always visible.

**Plan:**

**Step 1 — Wrap in `<PageShell>`:**
```tsx
<PageShell
  title="Invoices"
  description="All invoices you've sent or drafted."
  action={<Button variant="primary" icon={Plus} href="/invoices/new">New Invoice</Button>}
>
```

**Step 2 — Filter bar:**
A horizontal row of filter controls directly below the PageShell header (not inside a panel):
- Search input (with `Search` icon): filters by client name or invoice number. Debounced 300ms.
- Status filter: segmented buttons (not a dropdown) — `All | Unpaid | Paid | Overdue | Cancelled`. Active segment: `bg-[--accent-subtle] text-[--accent]`.
- Month filter: a `<Select>` for month/year. Default: current month. "All time" option at top.

All filters are URL params (use `useRouter` + `useSearchParams`). This makes them shareable/bookmarkable.

**Step 3 — Table:**
Use `<Table>` from Task A.7. Columns:
- **Invoice #** — `text-[--text-muted] text-xs` (secondary, not primary)
- **Client** — `text-[--text-primary] font-medium`
- **Amount** — right-aligned, `font-semibold`
- **Issued** — formatted date
- **Due** — formatted date, red if overdue
- **Status** — `<Badge>` component
- **Actions** — three-dot menu (`MoreHorizontal` icon) opens a dropdown with: View, Edit, Mark Paid, Send Reminder, Delete

**Step 4 — Row click:**
Clicking anywhere on a row (except the actions menu) navigates to `/invoices/[id]`.

**Step 5 — Bulk actions:**
Add a checkbox on each row. When 1+ are selected, show a floating action bar at the bottom of the viewport: `"X selected — [Mark as Paid] [Send Reminder] [Delete]"`. Use `<Button variant="primary">` and `<Button variant="danger">`.

**Step 6 — Pagination:**
Simple prev/next pagination below the table. Show `"Showing 1–20 of X invoices"`. Page size: 20.

**Verify:** Load with 10+ invoices. Filter by status and month; confirm URL updates. Click a row; confirm navigation. Select rows; confirm floating bar appears.

---

## Task A.13: Invoice create/edit form redesign

**File:** `app/(app)/invoices/new/page.tsx` (modify existing)
**File:** `app/(app)/invoices/[id]/edit/page.tsx` (modify existing if it exists, else create)

**Goal:** The most important form in the app. It must be fast, clear, and never confusing. Two-column layout on desktop: form left, live preview right.

**Plan:**

**Step 1 — Layout:**
Two-column on screens `lg+`: `grid grid-cols-[1fr_400px] gap-8`. On mobile: single column, preview collapses to a summary below the form.

**Step 2 — Left column (form):**
Organised into collapsible sections with clear headings. Use the `<FormField>` component from Task A.8 for all inputs.

Section 1 — **Bill to** (client info):
- Client name (with autocomplete from existing clients — dropdown that appears as user types)
- Client email
- Client address (optional, collapsible — `"Add address"` link reveals it)

Section 2 — **Invoice details**:
- Invoice number (auto-generated, editable)
- Issue date (date picker, default today)
- Due date (date picker, default +30 days; or a quick-select: Net 15 / Net 30 / Net 60 / Custom)

Section 3 — **Line items**:
- A dynamic list of line item rows. Each row: Description | Qty | Unit Price | Tax % | Total.
- `"+ Add line item"` button below the list.
- Drag handles on each row for reordering (use `@dnd-kit/sortable`, already in most Next.js setups — or skip drag if not installed, use up/down arrows instead).
- Remove button (trash icon) on each row.
- Totals below the list: Subtotal | Tax | **Total** (bold, large).

Section 4 — **Notes & terms** (optional, collapsed by default):
- Notes field (textarea)
- Payment terms (textarea)

**Step 3 — Right column (live preview):**
A real-time rendering of the invoice as it will look when sent/printed. Updates on every keystroke (debounced 150ms).
- This is the same component used for the invoice PDF template (Task A.14).
- Show a toggle: `"Preview"` / `"Edit"` — on mobile this switches between the form and preview.

**Step 4 — Footer actions:**
Fixed to the bottom of the viewport (not inside the scroll area). Left: `"Save as Draft"` (secondary button). Right: `"Send Invoice"` (primary button).

`"Save as Draft"` — saves with `status = "draft"`.
`"Send Invoice"` — saves, then immediately sends the invoice email, `status = "sent"`.

**Verify:** Create a new invoice with 3 line items. Confirm live preview updates. Save as draft. Reload page; confirm form repopulates. Send invoice; confirm status changes and toast appears.

---

## Task A.14: Invoice PDF / preview template redesign

**File:** `app/components/InvoiceTemplate.tsx` (new or replace existing)

**Goal:** The invoice document that clients see (in email, via PDF, via the public invoice link). Must look professional enough that a client won't question your legitimacy. Clean, modern, white-background.

**Plan:**
1. This is a pure presentational component. Props: `{ invoice: InvoiceWithLineItems, businessProfile: BusinessProfile }`.
2. It renders as HTML (not PDF — the PDF is generated from this HTML via puppeteer/print-to-PDF in the API). Apply `print:` Tailwind classes to make it print-friendly.
3. Layout (white background, `font-sans`, `text-[#1a1a1a]`):

```
┌──────────────────────────────────────────────┐
│  [Business Logo if set]        INVOICE        │
│  Business Name                                │
│  Business Address                  #INV-001   │
│                                 Issued: [date]│
│  Bill To:                         Due: [date] │
│  Client Name                                  │
│  Client Email                                 │
│  Client Address                               │
├──────────────────────────────────────────────┤
│  Description        Qty    Price    Total     │
│  ─────────────────────────────────────────── │
│  Line item 1         1    $500     $500       │
│  Line item 2         2    $100     $200       │
├──────────────────────────────────────────────┤
│                      Subtotal      $700       │
│                      Tax (10%)     $70        │
│                      Total         $770       │
├──────────────────────────────────────────────┤
│  Notes:                                       │
│  Payment terms:                               │
│                           [Pay Now Button]    │
└──────────────────────────────────────────────┘
```

4. The `[Pay Now Button]` is shown only when `invoice.stripePaymentLink` is set. It links directly to the Stripe Payment Link.
5. Typography: `font-size: 14px` base. Invoice number: `font-size: 11px text-[#6b7280]`. Total row: `font-size: 16px font-weight: 600`.
6. No decorative colours — just black on white. A single thin accent line (`border-t-2 border-[--accent]`) at the very top of the document.

**Verify:** Render the template with mock data. Print the page; confirm it prints cleanly (no cut-off, no browser UI).

---

## Task A.15: Empty states

**File:** `app/components/ui/EmptyState.tsx` (new)

**Goal:** Every page that can have zero items must show a helpful empty state — not a blank table.

**Plan:**
1. Props: `{ icon: LucideIcon, title: string, description: string, action?: { label: string, href?: string, onClick?: () => void } }`.
2. Layout: centred block, `py-16`. Icon: 48px, `text-[--text-disabled]`. Title: `text-base font-medium text-[--text-secondary]`. Description: `text-sm text-[--text-muted] mt-1 max-w-xs`. Action button below if provided.
3. Apply to: Invoices (0 invoices), Quotes (0 quotes), Clients (0 clients), Expenses (0 expenses), and any future list page.

Empty state copy per page:
- **Invoices:** Icon: `FileText`. Title: `"No invoices yet"`. Description: `"Create your first invoice and start getting paid."`. Action: `"+ New Invoice"`.
- **Quotes:** Icon: `ClipboardList`. Title: `"No quotes sent"`. Description: `"Send a price estimate before you start work."`. Action: `"+ New Quote"`.
- **Clients:** Icon: `Users`. Title: `"No clients yet"`. Description: `"Clients appear here when you create your first invoice."`.
- **Expenses:** Icon: `Receipt`. Title: `"No expenses logged"`. Description: `"Track what you spend to know your real profit."`. Action: `"+ Add Expense"`.

**Verify:** Delete all invoices (in dev); navigate to `/invoices`; confirm empty state renders. Confirm action button works.

---

## Task A.16: Settings page redesign

**File:** `app/(app)/settings/page.tsx` (modify existing)

**Goal:** Settings must be scannable and grouped. No wall of inputs. Tab-based navigation.

**Plan:**

**Step 1 — Tab navigation:**
A horizontal tab bar at the top of the settings content area:
`Profile | Business | Notifications | Billing | Danger Zone`

Use URL hash or query param to track active tab (`?tab=business`). Default: `profile`.

**Step 2 — Profile tab:**
- Full name (text input)
- Email (read-only — managed by NextAuth)
- Avatar (show current initial avatar; option to upload image in future)
- Save button

**Step 3 — Business tab:**
All fields from `BusinessProfile`:
- Business name
- Business address (textarea)
- Tax ID / VAT number
- Default currency (select)
- Default payment terms (select: Net 15 / Net 30 / Net 60 / Custom)
- Tax rate % (number input, with hint: "Used for tax estimates. Ask your accountant.")
- Tax year starts in (month select)
- Default hourly rate (number input with currency symbol prefix)
- Logo upload (optional — store URL in `BusinessProfile.logoUrl`, upload to Supabase Storage)

Group related fields under sub-headings (`text-xs uppercase tracking-wider text-[--text-muted] mb-3 mt-6`): "Business Details", "Tax Settings", "Billing Defaults".

**Step 4 — Notifications tab:**
Toggle list. Each toggle: label left, `<Switch>` right.
- Email reminders sent → on/off
- Invoice paid notification → on/off
- Overdue invoice alert → on/off
- Monthly tax estimate email → on/off
- "Pay yourself" monthly reminder → on/off

Store in `UserNotificationPreferences` (check if this model exists; if not, add to `MEMORY.md` as a future schema task and use a JSON field on `User` for now).

**Step 5 — Billing tab:**
- Current plan badge (Free / Pro / Agency) with plan name and price.
- `"Upgrade"` button (primary, links to Stripe Checkout) — visible only on Free plan.
- `"Manage Subscription"` button (links to Stripe Customer Portal) — visible on Pro/Agency.
- Accountant access invite form (from Phase Q — placeholder if not yet built).
- Team seats (from Phase R — placeholder if not yet built).

**Step 6 — Danger Zone tab:**
Red-tinted section.
- `"Delete my account"` button (danger). Clicking opens a confirmation modal requiring the user to type `"DELETE"` to proceed.
- `"Export all my data"` button — triggers CSV download of all invoices, clients, expenses.

**Verify:** Click each tab; confirm correct content shows. Save Business settings; reload; confirm fields repopulate. Toggle a notification; confirm it saves.

---

## Task A.17: Notification bell + in-app notifications

**File:** `app/components/layout/NotificationBell.tsx` (new)
**File:** `app/components/layout/NotificationPanel.tsx` (new)

**Goal:** A bell icon in the top-right of the app that shows unread notification count. Clicking it opens a panel listing recent notifications.

**Plan:**

**Step 1 — Bell button:**
1. Place in the top-right of the content area header (not inside the sidebar). Render a persistent header bar: `fixed top-0 right-0 h-14 flex items-center gap-3 px-6 z-20 bg-[--bg-base]/80 backdrop-blur-sm border-b border-[--border]`.
2. The header bar contains: breadcrumb (current page name) left, notification bell + user avatar right.
3. Bell icon: `Bell` from Lucide. If unread count > 0, show a red dot badge (`absolute -top-1 -right-1 w-2 h-2 bg-[--danger] rounded-full`). If count > 9, show `"9+"`.

**Step 2 — Notification panel:**
1. Clicking the bell opens a slide-over panel from the right: `fixed top-14 right-0 h-[calc(100vh-56px)] w-80 bg-[--bg-elevated] border-l border-[--border] shadow-xl z-20 overflow-y-auto`.
2. Panel header: `"Notifications"` + `"Mark all as read"` button (ghost, small).
3. Notification list: each item shows:
   - Icon (matching notification type — `DollarSign` for payment, `Bell` for reminder, `AlertCircle` for overdue, etc.)
   - Message text (from `Notification.message`)
   - Relative time (`"2 hours ago"` using `date-fns formatDistanceToNow`)
   - Unread indicator: left border `border-l-2 border-[--accent]` on unread items.
4. Clicking a notification: marks it as read (`PUT /api/notifications/[id]/read`), navigates to `Notification.link` if set.
5. `"Mark all as read"` button: calls `POST /api/notifications/read-all`.
6. If 0 notifications: empty state: `"You're all caught up."` with a `Check` icon.

**Step 3 — Fetch unread count:**
In the header bar, fetch `GET /api/notifications/unread-count` on mount and every 60 seconds (polling — not WebSocket). Use `useEffect` + `setInterval`. Update the badge.

**Verify:** Trigger a test notification via the API. Confirm the bell badge shows. Open the panel; confirm the notification appears. Click it; confirm it's marked as read. Confirm `"Mark all as read"` works.

---

## Task A.18: Responsive layout — content area offset

**File:** `app/(app)/layout.tsx`

**Goal:** The main content area must offset correctly for the sidebar at all times — expanded, collapsed, and on mobile.

**Plan:**
1. Use a CSS variable `--sidebar-current-width` that is:
   - `220px` when sidebar is expanded.
   - `60px` when sidebar is collapsed.
   - `0px` on mobile (sidebar is a slide-over, not inline).
2. The main content `<div>` has `margin-left: var(--sidebar-current-width)` and `transition: margin-left 200ms ease-in-out`.
3. Update `--sidebar-current-width` on the `:root` element (via `document.documentElement.style.setProperty`) whenever the sidebar state changes.
4. The top header bar (from Task A.17) must also be `left: var(--sidebar-current-width)` and `right: 0` with the same transition.
5. On mobile (`< 768px`): `--sidebar-current-width` is always `0`.
6. Verify: Expand and collapse the sidebar; confirm content area and header both shift smoothly. Resize to 390px; confirm sidebar hides and content fills full width.

---

## Task A.19: Legal invoice compliance fields

**Goal:** Add the fields required to produce a legally valid invoice in most jurisdictions (EU VAT, UK, AU, NZ, US). Users who don't need them never have to see them.

**Plan:**

**Step 1 — Schema additions** (`prisma/schema.prisma`):
Add to `Invoice` model (only if not already present):
- `taxId String?` — seller's VAT/GST/tax registration number
- `buyerTaxId String?` — client's VAT/tax number (B2B invoicing)
- `invoiceType String @default("standard")` — `"standard" | "proforma" | "credit-note"`
- `originalInvoiceId String?` — for credit notes: reference to the invoice being credited
- `poNumber String?` — purchase order number (some enterprise clients require this)
- `lineItemTaxRate Float?` — already exists per line item, but ensure it's on `InvoiceLineItem`

Run `npx prisma db push`. Verify no existing data is broken.

**Step 2 — Invoice form additions** (in Task A.13's form, Section 4 "Notes & terms"):**
Expand the optional section to also include:
- `"Purchase order number (PO)"` — text input. Help text: `"Required by some clients before they'll process payment."`
- `"Your tax/VAT number"` — pre-filled from `BusinessProfile.taxId`. Editable per invoice.
- `"Client tax/VAT number"` — optional, for B2B.
- `"Invoice type"` — dropdown: Standard / Pro-forma / Credit Note. Show only if user has been active > 30 days (progressive disclosure).
- If `"Credit Note"` selected: show a field `"Credits invoice #"` — text input for the original invoice number.

Do not show these fields by default. Show a `"+ Add legal details"` link below the Notes section. Clicking it reveals the fields.

**Step 3 — Invoice template additions** (in Task A.14's template):**
- Below the seller's business name/address, show `"Tax No: [taxId]"` if `taxId` is set.
- Below the client's name/address, show `"VAT No: [buyerTaxId]"` if set.
- If `poNumber` is set, show `"PO Number: [poNumber]"` in the invoice header area.
- If `invoiceType = "credit-note"`: change the heading from `"INVOICE"` to `"CREDIT NOTE"` and show `"Credits Invoice: [originalInvoiceId]"`.
- On each line item, show the tax rate percentage in a small `text-[#6b7280]` label: `"(10% GST)"`.

**Verify:** Create an invoice with a tax ID, PO number, and a non-standard tax rate on a line item. View the PDF preview; confirm all fields appear correctly.

---

## Task A.20: Global search (Cmd+K)

**File:** `app/components/layout/GlobalSearch.tsx` (new)

**Goal:** A keyboard-triggered command palette that lets users jump to any invoice, client, or page instantly.

**Plan:**
1. Listen globally for `Cmd+K` (Mac) and `Ctrl+K` (Windows/Linux) using `useEffect` + `keydown` event on `window`.
2. Opening the palette shows a fullscreen overlay: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]`.
3. The palette panel: `bg-[--bg-elevated] border border-[--border] rounded-[--radius-lg] shadow-2xl w-full max-w-lg`.
4. A search input at the top: large, no border of its own (the panel has the border). Placeholder: `"Search invoices, clients, pages..."`. Auto-focused on open.
5. Results below the input: grouped sections.
   - **Quick links** (always shown when query is empty): Dashboard, New Invoice, New Quote, Settings.
   - **Invoices** (searched by client name + invoice number): show client, amount, status badge.
   - **Clients** (searched by name, email): show email below name.
6. Fetch from `GET /api/search?q=query` (debounced 200ms). Endpoint searches across invoices and clients for the session user.
7. Keyboard navigation: `ArrowUp`/`ArrowDown` to move through results. `Enter` to navigate. `Escape` to close.
8. Show the keyboard shortcut hint in the notification header bar: a small `⌘K` badge in `text-[--text-disabled] text-xs` beside the search area.
9. Verify: Press Cmd+K; palette opens. Type a client name; results appear. Arrow through results; Enter navigates. Escape closes.

---

## Phase A — Verification Checklist

Run through this after all tasks are complete:

1. **Sidebar:** Expand and collapse. Active route highlights. Collapse state persists after page reload.
2. **Dark theme:** Every page uses `--bg-base` background. No white or grey remnants from old layout.
3. **Typography:** All headings use `font-semibold tracking-tight`. Body text uses `text-[--text-secondary]`. Muted text uses `text-[--text-muted]`.
4. **Spacing:** Every page has `px-8 py-8` padding. Cards have `p-5`. No elements touching the edge of their container.
5. **Buttons:** Every action uses `<Button>` component. No raw `<button>` with inline Tailwind.
6. **Forms:** Every input uses `<FormField>` + `<Input>`. No raw `<input>` with inline styles.
7. **Tables:** Every list page uses `<Table>`. No raw `<table>` markup.
8. **Badges:** Every status uses `<Badge>`. No raw coloured `<span>`.
9. **Empty states:** Every list page shows `<EmptyState>` when no records exist.
10. **Mobile (390px):** Sidebar hides. Content fills full width. Tables scroll horizontally. Forms are single-column. No horizontal overflow on any page.
11. **Invoice form:** Live preview updates as you type. Save as Draft and Send Invoice both work.
12. **Invoice template:** Renders cleanly. Prints without clipping. Tax ID, PO number, and line item tax rates show correctly when set.
13. **Cmd+K:** Opens and closes correctly. Search returns results. Keyboard navigation works.
14. **Notifications:** Bell shows unread count. Panel lists notifications. Mark as read works.
15. **Toasts:** Appear bottom-right. Correct colour for success/error.

---

## Files changed in Phase A

**New files:**
- `app/components/layout/Sidebar.tsx`
- `app/components/layout/SidebarProvider.tsx`
- `app/components/layout/PageShell.tsx`
- `app/components/layout/NotificationBell.tsx`
- `app/components/layout/NotificationPanel.tsx`
- `app/components/layout/GlobalSearch.tsx`
- `app/components/ui/StatCard.tsx`
- `app/components/ui/Button.tsx`
- `app/components/ui/Badge.tsx`
- `app/components/ui/Table.tsx`
- `app/components/ui/Input.tsx`
- `app/components/ui/Select.tsx`
- `app/components/ui/FormField.tsx`
- `app/components/ui/Modal.tsx`
- `app/components/ui/EmptyState.tsx`
- `app/components/InvoiceTemplate.tsx`
- `lib/toast.ts`

**Modified files:**
- `app/globals.css` — design tokens
- `tailwind.config.ts` — extended colour/radius/font mappings
- `app/layout.tsx` — dark mode on html, Toaster, GlobalSearch listener
- `app/(app)/layout.tsx` — two-panel shell, SidebarProvider, header bar
- `app/(app)/dashboard/page.tsx` — full redesign
- `app/(app)/invoices/page.tsx` — redesign
- `app/(app)/invoices/InvoicesClient.tsx` — redesign
- `app/(app)/invoices/new/page.tsx` — redesign with live preview
- `app/(app)/settings/page.tsx` — tab-based redesign
- `prisma/schema.prisma` — legal invoice fields on Invoice + InvoiceLineItem

**Not touched in Phase A:**
- All `/api/` routes — no business logic changes
- `prisma/schema.prisma` models other than Invoice/InvoiceLineItem additions
- NextAuth configuration
- Stripe webhook handlers
- Cron job files
- Any Phase B–T files
