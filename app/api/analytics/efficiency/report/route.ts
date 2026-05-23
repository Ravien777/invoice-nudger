import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeCollectionEfficiencyForUser } from "@/lib/analytics";

const TEMPLATE_LABELS: Record<string, string> = {
  gentle_reminder: "Gentle Reminder",
  due_today: "Due Today",
  overdue_notice: "Overdue Notice",
  firm_reminder: "Firm Reminder",
  final_notice: "Final Notice",
  broken_promise_notice: "Broken Promise",
  manual_payment: "Manual Payment",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  return (val * 100).toFixed(0) + "%";
}

function fmtDays(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(1) + " days";
}

function fmtNum(val: number): string {
  return val.toLocaleString();
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return new NextResponse("User not found", { status: 404 });
  }

  if (user.plan !== "pro" && user.plan !== "agency") {
    return new NextResponse(
      "Upgrade to Pro or Agency to download the Efficiency Report.",
      { status: 403 }
    );
  }

  try {
    const metrics = await computeCollectionEfficiencyForUser(user.id);
    const hasData = metrics.overall.totalPaidWithReminders > 0;
    const reportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collection Efficiency Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      padding: 40px;
      line-height: 1.5;
    }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .report-date { color: #999; font-size: 12px; margin-bottom: 32px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .stat-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .blurb {
      font-size: 14px;
      color: #666;
      margin-bottom: 32px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .blurb strong { color: #1a1a2e; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
      color: #666;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #999;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>Collection Efficiency Report</h1>
  <p class="subtitle">Invoice Nudger — ${user.email}</p>
  <p class="report-date">Generated ${reportDate}</p>

  ${hasData ? `
    <h2>Overview</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Paid After Reminder</div>
        <div class="stat-value">${fmtNum(metrics.overall.totalPaidWithReminders)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Days from Reminder to Payment</div>
        <div class="stat-value">${fmtDays(metrics.overall.avgDaysReminderToPayment)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Paid Within 3 Days</div>
        <div class="stat-value">${fmtNum(metrics.overall.paidWithin3Days)} (${fmtPct(metrics.overall.within3DaysRate)})</div>
      </div>
    </div>

    <div class="blurb">
      Your reminders help you get paid faster. On average, invoices are paid
      <strong>${fmtDays(metrics.overall.avgDaysReminderToPayment)}</strong>
      after the last reminder. Of those, ${fmtNum(metrics.overall.paidWithin3Days)} (${fmtPct(metrics.overall.within3DaysRate)})
      were paid within 3 days, ${fmtNum(metrics.overall.paidWithin24h)} within 24 hours,
      and ${fmtNum(metrics.overall.paidWithin7Days)} within 7 days.
    </div>

    ${metrics.byTemplate.length > 0 ? `
      <h2>Per Template Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Times Sent</th>
            <th>Paid Within 3 Days</th>
            <th>Conversion Rate</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.byTemplate.map(t => `
            <tr>
              <td><strong>${TEMPLATE_LABELS[t.template] || t.template}</strong></td>
              <td>${fmtNum(t.timesSent)}</td>
              <td>${fmtNum(t.paymentsWithin3Days)}</td>
              <td>${fmtPct(t.conversionRate)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}

    ${metrics.byChannel.length > 0 ? `
      <h2>Per Channel Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Times Sent</th>
            <th>Paid Within 3 Days</th>
            <th>Conversion Rate</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.byChannel.map(c => `
            <tr>
              <td><strong>${CHANNEL_LABELS[c.channel] || c.channel}</strong></td>
              <td>${fmtNum(c.timesSent)}</td>
              <td>${fmtNum(c.paymentsWithin3Days)}</td>
              <td>${fmtPct(c.conversionRate)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}
  ` : `
    <p>No reminder data available yet. Send your first reminders to generate insights.</p>
  `}

  <div class="footer">
    <p>Invoice Nudger — Collection Efficiency Report</p>
    <p>Based on historical reminder and payment data. Only includes invoices where reminders were sent.</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Efficiency report generation failed:", error);
    return new NextResponse("Failed to generate report", { status: 500 });
  }
}
