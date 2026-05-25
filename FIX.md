## Instructions for the AI Agent: Fix Auth & Dashboard 404 Errors

### Step 1 – Check File Structure

List the contents of these directories and report back:

```bash
ls -la app/api/auth/
ls -la app/(app)/dashboard/
```

**Expected:**  
- `app/api/auth/[...nextauth]/route.ts` (or `[...nextauth].ts`) exists.  
- `app/(app)/dashboard/page.tsx` exists and is a valid Next.js page component.

If either file is missing, restore it from version control (or verify it wasn’t accidentally deleted/renamed).

---

### Step 2 – Verify NextAuth API Route Exports Correctly

Open `app/api/auth/[...nextauth]/route.ts` (or `.tsx`) and check:

- It must export `GET` and `POST` handlers from NextAuth. Typical pattern:

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- If the file uses a different export (like `export default handler`), it won’t work in App Router. Ensure it’s exactly `export { handler as GET, handler as POST }`.

---

### Step 3 – Verify `authOptions` Import Path

In `lib/auth.ts`, check that the file exists and exports `authOptions`. Also verify that the import `@/lib/auth` resolves correctly. If the path was renamed to something like `@/lib/authOptions`, adjust the import.

---

### Step 4 – Check Environment Variables

Ensure `.env` contains:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

Without `NEXTAUTH_URL`, NextAuth client might fallback to relative URLs and could be misrouting. For development, set it explicitly to the local URL.

---

### Step 5 – Check Dashboard Page Export

Open `app/(app)/dashboard/page.tsx`. Confirm:

- The file still exports a valid async React component as `default`.  
- There is no syntax error left over from the earlier editing (e.g., unclosed braces, missing imports).  
- The imports that caused the “Element type is invalid” error have been fixed (Step 4 of previous fix).  

If you accidentally deleted the component, restore it from the working state (the file you posted earlier is correct except for the icon prop fixes). Apply only the children pattern changes from the previous fix; do not delete the function body.

---

### Step 6 – Rebuild and Clear Cache

Run:

```bash
rm -rf .next
npm run build
```

Or for development:

```bash
rm -rf .next
npm run dev
```

A fresh build often resolves stale route issues.

---

### Step 7 – Test in Browser

After the dev server starts, navigate to `http://localhost:3000/dashboard`.  
Check the Network tab – the request for `/api/auth/session` should return a JSON object (status 200), not HTML.

If `/api/auth/session` still returns 404, manually test by opening `http://localhost:3000/api/auth/session` in the browser. If it shows a JSON error like `{}` or `null`, that’s fine; if it shows an HTML 404 page, the NextAuth route isn’t being hit.

Possible cause: The App Router and Pages Router conflict. If you also have `pages/api/auth/[...nextauth].ts`, remove it – only use the App Router version.

---

### Step 8 – Final Checklist

- `app/api/auth/[...nextauth]/route.ts` exists and exports GET/POST.  
- `app/(app)/dashboard/page.tsx` exists and exports a default component.  
- `lib/auth.ts` exports `authOptions`.  
- `.env` has `NEXTAUTH_URL` set.  
- `.next` folder cleared and rebuilt.  
- No other pages have been accidentally deleted.

After these steps, both auth and dashboard should load correctly.
