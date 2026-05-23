# PHASE-A: UX Simplification & Design Overhaul – Implementation Plan

> **For the AI coding agent.**  
> Follow these steps in exact order. Each phase must be fully completed before moving to the next.  
> After every task, list files touched and files intentionally left untouched.  
> **CRITICAL RULES:**  
> - Read `MEMORY.md` before you start.  
> - Do **NOT** modify any files under `app/api/`, `prisma/`, or business logic files.  
> - Only change layout, style, component, and page files.  
> - When creating placeholder components, add a comment `// TODO: Replace with real implementation in future phase`.

---

## Project Context (as of current codebase)

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, React 19, Prisma, NextAuth, react-hot-toast, lucide-react.
- **Key directories:**
  - `app/(app)/` – authenticated pages (dashboard, invoices, clients, settings…)
  - `app/components/layout/` – Sidebar, SidebarProvider, PageShell, NotificationBell, GlobalSearch
  - `app/components/ui/` – existing Button, Badge, Table, Modal, Input, Select, FormField, StatCard, EmptyState
  - `lib/` – utilities (crypto, email, stripe, …)
  - `prisma/` – database schema (untouchable)
- **Design direction:** Dark theme, “refined utilitarian” (Linear / Notion / Vercel vibes).  
- **Global tokens:** Geist/Inter font, surface colors, semantic status colors, spacing scale.

---

## PHASE A‑1: Design Token Foundation & Layout Shell

**Goal:** Establish the visual language and the two‑panel shell before touching any page content.

### A‑1.1 – CSS Design Tokens
- **Create** `app/design-tokens.css`
- Define CSS custom properties on `:root` (dark theme as default):
  - Surfaces: `--surface-primary: #0a0a0a;`, `--surface-secondary: #141414;`, `--surface-tertiary: #1f1f1f;`
  - Borders: `--border-default: #2e2e2e;`, `--border-muted: #1a1a1a;`
  - Text: `--text-primary: #f5f5f5;`, `--text-secondary: #a1a1a1;`, `--text-tertiary: #6b6b6b;`
  - Accent: `--accent: #3b82f6;`, `--accent-hover: #2563eb;`
  - Semantic: `--success: #22c55e;`, `--warning: #f59e0b;`, `--danger: #ef4444;`
  - Spacing scale (4‑based): `--space-1: 0.25rem;`, … `--space-16: 4rem;`
  - Typography: font-family `'Inter', 'Geist', sans-serif;`, font-size scale.
- **Import** this CSS file in `app/layout.tsx` (before any other styles).

### A‑1.2 – Tailwind Configuration
- **Modify** `tailwind.config.ts` (or `postcss.config.mjs` if using Tailwind v4 config style) to extend `theme`:
  - `colors.surface`, `colors.border`, `colors.text`, `colors.accent`, etc., mapped to CSS variables.
  - `fontFamily.sans` set to `['Inter', 'Geist', ...]`.
- Ensure that classes like `bg-surface-primary`, `text-text-secondary`, `border-border-default` work.

### A‑1.3 – Root Layout Two‑Panel Shell
- **Modify** `app/layout.tsx`
  - Wrap the `{children}` in `SidebarProvider` (already exists but ensure it provides expand/collapse context).
  - Apply `bg-surface-primary text-text-primary min-h-screen` to `<body>`.
  - Import Geist or Inter font correctly.

### A‑1.4 – Collapsible Sidebar
- **Modify** `app/components/layout/Sidebar.tsx`
  - Implement expanded (220px) / collapsed (60px) states using context from `SidebarProvider`.
  - Transition: `transition-all duration-300 ease-in-out`.
  - Show icons only when collapsed; show icon + label when expanded.
  - Organize navigation into zones (use `<nav>` groups):
    - **Main:** Dashboard, Invoices, Clients
    - **Finance:** Benchmarks, Promises, Reconciliation
    - **Settings:** Settings (link to /settings)
  - Use `lucide-react` icons already in project.
  - Add current route highlighting (active state) with accent border/background.

### A‑1.5 – Mobile Sidebar Slide‑over
- **Modify** `app/components/layout/SidebarProvider.tsx` (or create a wrapper if needed)
  - On screens `< 768px`, sidebar becomes a slide‑over panel (position fixed, left‑0, z‑50, shadow).
  - Include a backdrop (`bg-black/50`) that closes sidebar on click.
  - Toggle via a hamburger button placed in the main content header (we’ll add the button later; for now, ensure the logic exists).

**Checkpoint:** The app now has a dark themed, collapsible sidebar that pushes main content. Placeholder pages still render but layout is correct.

---

## PHASE A‑2: Component Library Modernization

**Goal:** Refactor all existing UI components in `app/components/ui/` to use the new design tokens and add missing ones.

### A‑2.1 – Button Upgrade
- **Modify** `app/components/ui/Button.tsx`
- Add `variant` prop: `'primary' | 'secondary' | 'ghost' | 'danger'`
- Add `size` prop: `'sm' | 'md' | 'lg'`
- Map variants to CSS classes:
  - primary: `bg-accent text-white hover:bg-accent-hover`
  - secondary: `bg-surface-tertiary text-text-primary border border-border-default hover:bg-surface-secondary`
  - ghost: `bg-transparent text-text-secondary hover:bg-surface-tertiary`
  - danger: `bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20`
- Sizes: sm `px-3 py-1.5 text-sm`, md `px-4 py-2 text-sm`, lg `px-6 py-3 text-base`.
- Ensure focus ring: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary`.

### A‑2.2 – Badge Upgrade
- **Modify** `app/components/ui/Badge.tsx`
- Add `variant`: `'unpaid' | 'paid' | 'cancelled' | 'overdue' | 'draft'`
- Colors: unpaid (warning/amber), paid (success/green), cancelled (text-tertiary/gray), overdue (danger/red), draft (text-secondary/blue-gray).
- Keep existing `children` and `className` passing.

### A‑2.3 – Table Refactor (Composable)
- **Modify** `app/components/ui/Table.tsx`
- Export sub‑components: `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell`.
- `Table`: `bg-surface-secondary rounded-lg border border-border-default overflow-hidden`
- `TableHead`: `bg-surface-tertiary text-text-secondary text-xs uppercase tracking-wider`
- `TableRow`: `border-b border-border-default last:border-0 hover:bg-surface-tertiary/50 transition-colors`
- `TableCell`: `px-4 py-3 text-sm`

### A‑2.4 – Input & Select Overhaul
- **Modify** `app/components/ui/Input.tsx` and `Select.tsx`
- Style: `bg-surface-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary rounded-md px-3 py-2`
- Focus: `focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent`
- Error state: `border-danger focus:ring-danger` (pass `error` prop)

### A‑2.5 – Modal Overhaul
- **Modify** `app/components/ui/Modal.tsx`
- Overlay: `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm`
- Panel: `bg-surface-secondary border border-border-default rounded-xl p-6 shadow-xl`
- Add enter animation: `animate-in fade-in zoom-in-95 duration-200`
- Dismiss on Escape key and click‑outside (ensure events properly stop propagation).

### A‑2.6 – Toast Integration
- Already using `react-hot-toast`. Create a wrapper `app/components/ui/Toast.tsx` that exports a `toast` function pre‑styled.
- Use `toast.custom` to render toasts with `bg-surface-secondary text-text-primary border border-border-default rounded-lg shadow-lg`.

### A‑2.7 – StatCard Upgrade
- **Modify** `app/components/ui/StatCard.tsx`
- Variants: `default` (accent left border), `highlight` (accent background), `warning` (warning left border).
- Include optional `icon` and `trend` (up/down arrow with percentage).
- Add a `loading` prop that shows a skeleton pulse.

**Checkpoint:** All UI primitives follow the dark theme. Pages still look mostly the same but components are ready.

---

## PHASE A‑3: Page Shell & Shared Chrome

**Goal:** Apply the uniform page wrapper, header, sidebar user menu, and notification polish.

### A‑3.1 – Page Shell Component
- **Modify** `app/components/layout/PageShell.tsx`
- Props: `title`, `subtitle`, `actions` (ReactNode for buttons).
- Renders: `<div className="flex flex-col h-full"><header className="px-6 py-4 border-b border-border-default flex items-center justify-between">...</header><main className="flex-1 overflow-y-auto px-6 py-8">{children}</main></div>`
- Insert a mobile menu button (hamburger) in the header that toggles sidebar (only visible on mobile).

### A‑3.2 – User Menu in Sidebar Footer
- **Modify** `app/components/layout/Sidebar.tsx`
- At the bottom of the sidebar, always show user info (get session via `useSession`).
- Expanded: avatar, name, email, sign‑out button.
- Collapsed: just the avatar (clicking expands a mini popover with sign‑out).
- Style with `border-t border-border-default mt-auto pt-4`.

### A‑3.3 – Notification Bell Polish
- **Modify** `app/components/layout/NotificationBell.tsx`
- Style button with `relative p-2 rounded-md hover:bg-surface-tertiary text-text-secondary`.
- Badge: `absolute -top-0.5 -right-0.5 bg-danger text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`.

### A‑3.4 – Notification Panel Polish
- **Modify** `app/components/layout/NotificationPanel.tsx`
- Panel: `fixed right-0 top-0 h-full w-80 bg-surface-secondary border-l border-border-default shadow-xl z-50`
- Add header with “Notifications” title and “Mark all read” button.
- Empty state when no notifications.

**Checkpoint:** Every page now gets a consistent shell with working sidebar, user menu, and notification system. No page content has been redesigned yet.

---

## PHASE A‑4: Page Redesigns (Incremental)

**Goal:** Transform each page one by one using the new components and layout. Proceed in the order listed.

### A‑4.1 – Dashboard
- **Modify** `app/(app)/dashboard/page.tsx`
- Wrap everything in `<PageShell title="Dashboard" subtitle="Overview of your invoices" actions={<Button size="sm">+ New Invoice</Button>}>`
- Hero number: large font size (`text-5xl`) showing total outstanding amount.
- Three `StatCard` components: Unpaid, Overdue, Paid This Month (with trend arrows).
- Recent invoices table (last 5) using new `Table` components with status `Badge`.
- If no invoices, show `EmptyState` variant `no-invoices`.

### A‑4.2 – Invoice List
- **Modify** `app/(app)/invoices/page.tsx`
- Use `PageShell` with title “Invoices” and action buttons (New Invoice, Import CSV).
- Filter bar: select for status (All, Unpaid, Overdue, Paid), date range picker (simple text inputs for now), client search input.
- Bulk actions: show a toolbar when rows are selected (selected count, mark as paid, delete).
- Table: columns – Invoice #, Client, Amount, Status, Due Date, Actions.
- Pagination controls (or infinite scroll if already implemented).

### A‑4.3 – Invoice Create/Edit Form
- **Modify** `app/components/InvoiceForm.tsx` (if it exists; otherwise create it)
- Two‑column layout: left column (form fields) takes 2/3, right column (live preview) 1/3 on large screens.
- Fields: Client (combobox using existing Select), Invoice date, Due date, Line items (dynamic add/remove with subtotal), Notes, Tax, Discount.
- Live preview: embedded `InvoiceTemplate` preview that updates as user types (use a preview container with `bg-white text-black` simulating print).

### A‑4.4 – Invoice PDF Template
- **Modify** `app/components/InvoiceTemplate.tsx`
- This template must look professional on a white background (since users will print/send PDFs).
- Include: company logo/name, invoice #, dates, client info, line items table, totals, notes, payment link.
- Use a `@media print` style if needed to hide UI elements.

### A‑4.5 – Empty State Component
- **Modify** `app/components/ui/EmptyState.tsx`
- Add `variant` prop to choose illustration/icon: `no-invoices`, `no-clients`, `no-results`.
- Show an icon (from lucide-react), title, description, and a CTA button.

### A‑4.6 – Settings Page
- **Modify** `app/(app)/settings/page.tsx`
- Tab navigation: Profile, Business, Notifications, Billing, Danger Zone.
- Each tab pane uses appropriate forms with Input, Select, FormField components styled using tokens.
- Danger Zone: destructive actions like “Delete Account” with red styling.

### A‑4.7 – Client Pages (Polish)
- **Modify** files in `app/(app)/clients/` (list, detail, risk)
- Apply new Table, Badge, StatCard to client list.
- Ensure consistent dark theme styling.

**Checkpoint:** The entire application UI now reflects the Phase‑A design overhaul.

---

## Final Agent Instructions

- After each task (e.g., A‑1.1), commit with a message like `feat: add design tokens`.
- When a component is touched, ensure it still compiles and does not break existing functionality (since we only change style and layout).
- If you encounter a component that doesn’t exist yet, create a minimal placeholder with a `// TODO` comment and skip deep implementation.
- Do **not** remove existing functionality (e.g., don’t delete API calls, form submission logic).
- At the end of the whole process, run `npm run build` (or `next build`) to verify no TypeScript or import errors were introduced.

**Success means:** The app looks visually identical to the described Linear/Notion‑inspired dark theme, with a collapsible sidebar, polished components, and redesigned pages—all while keeping every existing feature working.
