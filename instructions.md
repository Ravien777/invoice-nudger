You are a senior full-stack developer. Build the complete MVP of a SaaS application called “Invoice Nudger” by following the steps below. The app automatically sends polite, escalating email reminders for unpaid invoices.

Project overview
Invoice Nudger solves the painful problem of chasing late payments. Freelancers and small businesses manually add invoices (or upload a CSV), and the app sends a sequence of reminder emails until the invoice is marked as paid.

Core MVP features
1. User authentication (email magic link).
2. Add, edit, delete invoices manually.
3. Bulk upload invoices via CSV.
4. Define default reminder schedules (e.g., 3 days before due, on due date, 3/7/14 days after due).
5. Each invoice can have its own reminder schedule or inherit the default.
6. A daily scheduled job checks all unpaid invoices and sends the appropriate reminder email.
7. Emails use escalating tone templates and are sent via Resend.
8. Dashboard showing unpaid, overdue, paid invoices.
9. Mark an invoice as paid (manual or via a shared payment link).
10. Simple landing page and onboarding.

Tech stack (use exactly this)
- Next.js (App Router) with TypeScript
- Tailwind CSS for styling
- Prisma as ORM
- PostgreSQL (hosted on Supabase or Neon)
- NextAuth.js for authentication (Email provider using Resend)
- Resend for sending transactional emails
- Vercel Cron Jobs for the daily reminder scheduler
- Vercel for deployment
- PapaParse for CSV parsing

Database schema (use Prisma)
model User {
  id             String    @id @default(cuid())
  name           String?
  email          String    @unique
  emailVerified  DateTime?
  image          String?
  invoices       Invoice[]
  reminderSchedules ReminderSchedule[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model Invoice {
  id            String   @id @default(cuid())
  invoiceNumber String?
  clientName    String
  clientEmail   String
  amount        Float
  currency      String   @default("USD")
  dueDate       DateTime
  status        String   @default("unpaid") // unpaid, paid, cancelled
  notes         String?
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  reminders     ReminderLog[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model ReminderSchedule {
  id            String   @id @default(cuid())
  name          String   // e.g. "Default schedule"
  isDefault     Boolean  @default(false)
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  steps         ReminderStep[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model ReminderStep {
  id                 String   @id @default(cuid())
  daysOffset         Int      // negative = before due, positive = after due
  emailTemplate      String   // reference to template name (e.g. "gentle_reminder", "firm", "final_notice")
  reminderScheduleId String
  schedule           ReminderSchedule @relation(fields: [reminderScheduleId], references: [id])
}

model ReminderLog {
  id        String   @id @default(cuid())
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  sentAt    DateTime @default(now())
  stepName  String   // which step triggered this
}

Environment variables you will need (store in .env.example and .env)
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
RESEND_API_KEY
EMAIL_FROM

Build the app step by step. After each step, give the user instructions on how to test that step locally. Only proceed when the step is complete.

─────────────────────────────
STEP 1: Project initialization & basic configuration
─────────────────────────────
1. Create a new Next.js app with TypeScript and Tailwind.
2. Install all required dependencies:
   - prisma, @prisma/client
   - next-auth, @next-auth/prisma-adapter
   - resend
   - papaparse
   - date-fns
   - react-hot-toast (for notifications)
3. Initialize Prisma with a PostgreSQL provider.
4. Add the database schema (copy the models above) to prisma/schema.prisma.
5. Run `npx prisma db push` to create the tables.
6. Set up NextAuth with the Email provider (using Resend). Use the Prisma adapter.
7. Create a simple home page (“/”) that shows “Invoice Nudger” and a sign-in button if not logged in.
8. Test: Can you sign in with an email magic link? (Use Resend’s test mode.)

─────────────────────────────
STEP 2: Invoice CRUD & dashboard
─────────────────────────────
1. Create an authenticated layout that protects all `/app/*` routes.
2. Build an invoices page (`/invoices`) with a table showing all invoices for the logged-in user (client name, amount, due date, status).
3. Add a “New Invoice” form (modal or separate page) with fields: clientName, clientEmail, amount, dueDate, notes.
4. Implement API routes for creating, updating, deleting invoices (RESTful: /api/invoices).
5. Add the ability to edit and delete invoices inline from the table.
6. Build a simple dashboard (`/dashboard`) showing counts: total unpaid, overdue, paid this month.
7. Test: Log in, create 3 invoices with different statuses, and check the dashboard.

─────────────────────────────
STEP 3: CSV upload for bulk invoices
─────────────────────────────
1. Add a button “Upload CSV” on the invoices page.
2. Build a file upload component that accepts .csv files.
3. In the API route, parse the CSV with PapaParse. Expected columns: Client Name, Client Email, Amount, Due Date (YYYY-MM-DD), Notes (optional).
4. Create all valid invoices and return a summary (success count, errors).
5. Show toast notifications for success/failure.
6. Test: Prepare a CSV with 5 rows, upload, and verify they appear in the table.

─────────────────────────────
STEP 4: Reminder schedules (default & per-invoice)
─────────────────────────────
1. Seed the database with a default ReminderSchedule named “Standard” that contains these steps:
   - 3 days before due → “gentle_reminder”
   - 0 days (on due) → “due_today”
   - 3 days after → “overdue_notice”
   - 7 days after → “firm_reminder”
   - 14 days after → “final_notice”
   Assign this schedule as `isDefault: true` for every new user when they sign up.
2. Create a settings page (`/settings`) where the user can edit the default schedule (add/remove steps, change daysOffset, change email template name).
3. On the invoice edit form, add an optional field “Reminder schedule” (dropdown). If not selected, the default schedule applies.
4. Store the selected schedule on the invoice (add `reminderScheduleId` to Invoice model or keep it inferred via user default; simpler: just store `scheduleId` on Invoice).
   - Update Prisma schema: add `reminderScheduleId String?` and relation to Invoice. Re-push DB.
5. Test: Create an invoice without a specific schedule; it should use the default. Then assign a custom schedule to another invoice and verify.

─────────────────────────────
STEP 5: Email templates & sending logic
─────────────────────────────
1. Inside `/lib/email-templates`, create five email template functions (or simple HTML strings) for the five tones:
   - gentle_reminder
   - due_today
   - overdue_notice
   - firm_reminder
   - final_notice
   Each template receives `clientName`, `invoiceNumber`, `amount`, `dueDate`, and a payment link.
2. Build a utility function `sendReminderEmail(invoice, step)` that:
   - Uses Resend to send an email from `EMAIL_FROM` to `invoice.clientEmail`.
   - Subject and body come from the template corresponding to `step.emailTemplate`.
   - Records the sent email in `ReminderLog` (create a new record).
3. Build an API endpoint `/api/send-reminder` that accepts an invoice ID and a step name, and calls the utility. (This is useful for manual testing, but the real job will use the scheduler.)
4. Test: Using an HTTP client or a button on the invoice row, trigger a reminder manually for an unpaid invoice. Check that the email arrives (Resend test mode) and a log is created.

─────────────────────────────
STEP 6: Daily scheduler (Vercel Cron Job)
─────────────────────────────
1. Create a cron job in `vercel.json` that hits `/api/cron/send-reminders` every day at a reasonable hour (e.g., 8am UTC). Use Vercel Cron format:
   `{ "crons": [ { "path": "/api/cron/send-reminders", "schedule": "0 8 * * *" } ] }`
2. Build the API route `/api/cron/send-reminders` with a secret header check (to ensure only Vercel can call it).
3. Inside the route handler:
   - Query all unpaid invoices (status = “unpaid”) along with their user and schedule.
   - For each invoice, determine which reminder step is due today (based on the due date and the step’s `daysOffset`).
   - Also check that this step hasn’t already been sent (look up ReminderLog for the same invoice and step name).
   - If due and not sent, call `sendReminderEmail`.
4. Add logic to mark the invoice as “overdue” if `daysOffset > 0` and it’s the first overdue step (purely cosmetic in the UI).
5. Test: Temporarily change your system clock (or adjust the due dates of test invoices) so that a reminder step becomes due today. Then manually hit `/api/cron/send-reminders` (with the secret header). Verify emails are sent and logs are created.

─────────────────────────────
STEP 7: Manual payment status & paid tracking
─────────────────────────────
1. Add a “Mark as Paid” button on each invoice row in the dashboard and invoice table.
2. Clicking it calls an API that sets `status = “paid”` and records a `ReminderLog` with stepName “manual_payment”.
3. Add a filter on the invoices page to show: All, Unpaid, Paid, Overdue.
4. Create a simple public payment confirmation page (`/pay/:invoiceId`) that shows the invoice details and a “Confirm Payment” button (just a mock – later you can add real payment integration). When confirmed, it marks the invoice as paid and shows a thank you message.
5. Test: Mark an invoice as paid, verify it no longer appears in overdue/unpaid lists.

─────────────────────────────
STEP 8: Polish, onboarding & landing page
─────────────────────────────
1. Build a public landing page (`/`) that explains the product and includes a “Start Free Trial” button leading to sign-up.
2. Improve the post-signup flow: after first login, show an onboarding modal that creates the default reminder schedule (if not already seeded) and suggests uploading a test CSV.
3. Add a simple billing wall later (optional for MVP). For now, let the app be free during beta.
4. Deploy to Vercel, set all environment variables, and activate the cron job.
5. Test the entire flow end-to-end: sign up → add invoices → wait for scheduled reminders → mark paid.

─────────────────────────────
WHAT TO DO NEXT (after MVP is live)
─────────────────────────────
- Add Stripe payment links to invoices so clients can pay directly.
- Add Stripe webhook to auto-mark invoices as paid.
- Build subscription tiers (with Stripe Checkout) and limit invoices per month.
- Create a public “Invoice reminder email templates” page for SEO and lead generation.

Build each step completely. Write clean, well-typed code. Use server actions where appropriate. After each step, give the user a short checklist of what to test and how to verify it works.