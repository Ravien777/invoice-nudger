# J.3 — Header Consolidation Plan

## Problem
- Desktop: NotificationBell shows **twice** (layout header + PageShell header)
- Mobile: NotificationBell is **missing** (layout header hidden, PageShell hides it via `hidden md:block`)
- Mobile on payroll/invoices/settings (no PageShell): **no utility actions at all**

## Files to Modify

### 1. `app/(app)/layout.tsx`
Remove outer `<header>` block entirely. Layout becomes just `<Sidebar />` + `<main>{children}</main>`.

```tsx
// Remove:
// import HeaderActions from "./components/HeaderActions";
// and the entire <header className="h-14 hidden md:flex ..."> block
```

### 2. `app/components/layout/PageShell.tsx`
Replace current content with version that includes:
- `NotificationBell` on **all** screen sizes (remove `hidden md:block`)
- Sign-out button (small icon, always visible)
- Pending promises badge (moved from HeaderActions.tsx)
- Keep: hamburger (mobile only), title/subtitle, `actions` prop

The new header layout:
```
[Hamburger md:hidden] [Title + Subtitle] [Promises badge] [NotificationBell] [actions] [SignOut]
```

Key imports to add:
```tsx
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { LogOut } from "lucide-react";
```

### 3. `app/(app)/components/HeaderActions.tsx`
Delete the file — its functionality (NotificationBell, promises badge, sign-out) is now in PageShell.tsx.

### 4. `app/(app)/payroll/page.tsx`
Add import:
```tsx
import { PageShell } from "@/app/components/layout/PageShell";
```
Wrap the `<PayrollClient>` in `<PageShell title="Payroll">`.

### 5. `app/(app)/invoices/page.tsx`
Same pattern — add PageShell import, wrap `<InvoicesClient>` in `<PageShell title="Invoices">`.

### 6. `app/(app)/settings/page.tsx`
Same pattern — add PageShell import, wrap `<SettingsClient>` in `<PageShell title="Settings">`.

### 7. `app/(app)/team/accept/page.tsx`
**Skip** — standalone page with full-page layout, not suitable for PageShell wrapper.

## Verification
1. `npx tsc --noEmit` — no errors in changed files
2. `npm test` — 525 tests pass
3. Manual: Open dashboard/invoices at 390px viewport — single header row, NotificationBell visible
4. Manual: Desktop — NotificationBell appears once, not twice
5. Manual: payroll/invoices/settings pages — show PageShell header with title + actions
