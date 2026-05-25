### Fix: Nested `<button>` error on Tax page

**Problem:**  
In `app/(app)/tax/page.tsx` (or a child component like `TaxClient`), a parent `<button>` wraps an inner `<button>` (from the `Button` component). This is invalid HTML and causes a hydration error.

**Locate the violation:**  
Look for a pattern like:

```tsx
<button onClick={handleRowClick} className="...">
  <h3>...</h3>
  <Button variant="ghost" onClick={handleInnerClick}>...</Button>
</button>
```

**Fix – Change the outer element from `<button>` to a `<div>`**

1. Replace the outer `<button>` with a `<div>`.
2. Add `role="button"` and `tabIndex={0}` to maintain accessibility.
3. Add `onKeyDown` to handle `Enter` and `Space` keys for keyboard users.
4. Keep all other styling and the `onClick` handler on the `<div>`.
5. The inner `<Button>` remains unchanged.

**Before:**
```tsx
<button onClick={handleRowClick} className="flex items-center ...">
  <h3>Tax Summary</h3>
  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDetails(); }}>
    Details
  </Button>
</button>
```

**After:**
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handleRowClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick();
    }
  }}
  className="flex items-center ... cursor-pointer"
>
  <h3>Tax Summary</h3>
  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDetails(); }}>
    Details
  </Button>
</div>
```

**Important:**  
- Stop the inner button’s event propagation (`e.stopPropagation()`) so clicking the inner button does not also trigger the outer row click.
- If the outer clickable area does not need a separate action at all, consider removing its `onClick` entirely.

---

**Verification:**  
After the fix, run the app and navigate to `/tax`. The hydration error must disappear.
