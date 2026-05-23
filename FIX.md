# Fix for Dashboard Server-to-Client Component Errors

**Issue:**

- Server Components cannot pass functions (component constructors like `FileText`, `AlertCircle`) as props to Client Components. This causes `Only plain objects can be passed` and `Functions cannot be passed directly` errors.
- One or more imported UI components are `undefined`, leading to `Element type is invalid`.

**Root cause in your code:**

- `StatCard` and `EmptyState` accept an `icon` prop that receives a Lucide icon _function_. They are Client Components, but receive this prop from the Server Component `DashboardPage`.
- `PageShell`, `Button`, or Table sub-components may not be exported correctly after Phase A‑2 refactoring.

---

## Agent Instructions

1. **Read MEMORY.md** before modifying any files.
2. **Do NOT modify** any API routes, Prisma schema, or business logic.
3. Only change files under `app/components/ui/`, `app/components/layout/`, and `app/(app)/dashboard/`.
4. After each sub-task, verify the dashboard compiles and renders without the serialization errors.

---

### Task 1: Refactor `StatCard` to Accept Icon as Children

**File:** `app/components/ui/StatCard.tsx`

- Remove the `icon` prop from the TypeScript interface/props.
- Add `children` of type `React.ReactNode` (optional).
- In the component's JSX, replace the old `icon` rendering location with `{children}`.
- Keep all other props (`label`, `value`, `variant`, `trend`, `loading`, etc.) unchanged.

**Example before/after:**

```tsx
// Before
interface StatCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  // ...
}
// JSX: <Icon className="..." />

// After
interface StatCardProps {
  children?: React.ReactNode;
  // ...
}
// JSX: {children && <div className="...">{children}</div>}
```

---

### Task 2: Refactor `EmptyState` to Accept Icon as Children

**File:** `app/components/ui/EmptyState.tsx`

- Similar to StatCard: remove any `icon` prop that expects a component function.
- Add `children` prop (optional).
- Render `{children}` where the icon used to appear (typically a large icon above the title).

Keep `variant`, `title`, `description`, `action` props unchanged.

---

### Task 3: Update `DashboardPage` to Pass Icons as JSX Children

**File:** `app/(app)/dashboard/page.tsx`

- Locate all uses of `<StatCard ... icon={FileText} />`, `<StatCard ... icon={AlertCircle} />`, `<StatCard ... icon={CheckCircle} />`.
- Replace them with the children pattern:

```tsx
// Example
<StatCard label="Unpaid" value={unpaidCount.toString()} variant="default">
  <FileText className="h-5 w-5 text-text-secondary" />
</StatCard>
```

- Do the same for `EmptyState` in the `totalInvoices === 0` block:

```tsx
<EmptyState
  title="No invoices yet"
  description="Get started by creating your first invoice."
  action={{ label: "New Invoice", href: "/invoices/new" }}
>
  <FileText className="h-12 w-12 text-text-tertiary" />
</EmptyState>
```

- Remove the `icon` prop entirely from these components; only pass JSX as children.

---

### Task 4: Verify Component Exports (Fix `undefined` component)

**Check these files for correct exports:**

- `app/components/layout/PageShell.tsx` – must have a default export (or if it's a named export, adjust the import in `dashboard/page.tsx`). The import in dashboard is `import PageShell from "@/app/components/layout/PageShell";` so ensure `export default function PageShell(...)`.
- `app/components/ui/Button.tsx` – must have a default export (imported as `import Button from ...`).
- `app/components/ui/Table.tsx` – must export `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` as named exports. Verify each is a function component and not accidentally a default export.
- `app/components/ui/Badge.tsx` – must export `Badge` and `BadgeVariant` as named exports (imported as `import { Badge, type BadgeVariant } from ...`).

If any export is missing, add it. If you find a component that is still a server component and it’s used inside a client boundary, add `"use client";` at the top if necessary (but for UI primitives they should already be client components). However, don’t add `"use client"` to server pages.

---

### Task 5: Build Verification

Run `npm run build` (or `next build`) to catch TypeScript errors and module export issues. Fix any remaining import/export errors.

---

### Task 6: Remove Unrelated Script Tag Warning (Optional)

If the browser console still shows `Encountered a script tag while rendering React component`, wrap any raw `<script>` tags in your layout with Next.js’s `<Script>` component from `next/script`. This is not critical but can be cleaned.

---

**Expected result:**

- Dashboard loads without serialization errors.
- All icons render correctly inside StatCard and EmptyState.
- No “Element type is invalid” errors.
