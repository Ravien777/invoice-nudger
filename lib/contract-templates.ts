export const SYSTEM_TEMPLATES = [
  {
    name: "Freelance Service Agreement",
    body: `<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
  <h1 style="font-size: 22px; margin-bottom: 4px; color: #111;">Freelance Service Agreement</h1>
  <p style="color: #555; font-size: 13px; border-bottom: 1px solid #ddd; padding-bottom: 16px;">Between <strong>{{yourBusinessName}}</strong> and <strong>{{clientName}}</strong></p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">1. Services</h2>
  <p>{{yourBusinessName}} (&#8220;Freelancer&#8221;) agrees to provide the following services to {{clientName}} (&#8220;Client&#8221;):</p>
  <p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px; font-style: italic;">{{serviceDescription}}</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">2. Payment</h2>
  <p>Client agrees to pay <strong>{{amount}}</strong> for the services described above. Payment terms: <strong>{{paymentTerms}}</strong>.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">3. Start Date</h2>
  <p>Work will begin on <strong>{{startDate}}</strong>.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">4. Ownership</h2>
  <p>Upon full payment, all rights to the work product transfer to Client. Until then, Freelancer retains all rights.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">5. Cancellation</h2>
  <p>Either party may cancel this agreement with 14 days&#8217; written notice. Client agrees to pay for all work completed up to the cancellation date.</p>

  <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 13px; color: #555;">
    This agreement is governed by the laws of the jurisdiction in which Freelancer operates.
  </p>
</div>`,
  },
  {
    name: "Retainer Agreement",
    body: `<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
  <h1 style="font-size: 22px; margin-bottom: 4px; color: #111;">Retainer Agreement</h1>
  <p style="color: #555; font-size: 13px; border-bottom: 1px solid #ddd; padding-bottom: 16px;">Between <strong>{{yourBusinessName}}</strong> and <strong>{{clientName}}</strong></p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">1. Retainer Services</h2>
  <p>{{clientName}} (&#8220;Client&#8221;) engages {{yourBusinessName}} (&#8220;Service Provider&#8221;) on an ongoing basis for the following services:</p>
  <p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px; font-style: italic;">{{serviceDescription}}</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">2. Retainer Fee</h2>
  <p>Client agrees to pay a recurring fee of <strong>{{amount}}</strong>. Payment terms: <strong>{{paymentTerms}}</strong>. Fees are due on the first day of each billing period.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">3. Start Date &amp; Term</h2>
  <p>This agreement begins on <strong>{{startDate}}</strong> and continues on a month-to-month basis until cancelled.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">4. Cancellation</h2>
  <p>Either party may cancel with 30 days&#8217; written notice. The retainer is non-refundable for work already completed.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">5. Scope Changes</h2>
  <p>Any work outside the scope described above will be quoted separately and requires written approval before proceeding.</p>

  <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 13px; color: #555;">
    This agreement is governed by the laws of the jurisdiction in which Service Provider operates.
  </p>
</div>`,
  },
  {
    name: "Project-Based Agreement",
    body: `<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
  <h1 style="font-size: 22px; margin-bottom: 4px; color: #111;">Project-Based Agreement</h1>
  <p style="color: #555; font-size: 13px; border-bottom: 1px solid #ddd; padding-bottom: 16px;">Between <strong>{{yourBusinessName}}</strong> and <strong>{{clientName}}</strong></p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">1. Project Scope</h2>
  <p>{{clientName}} (&#8220;Client&#8221;) hires {{yourBusinessName}} (&#8220;Contractor&#8221;) to complete the following project:</p>
  <p style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px; font-style: italic;">{{serviceDescription}}</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">2. Project Fee</h2>
  <p>Client agrees to pay a fixed project fee of <strong>{{amount}}</strong>. Payment terms: <strong>{{paymentTerms}}</strong>.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">3. Timeline</h2>
  <p>Work begins on <strong>{{startDate}}</strong>. Estimated completion within the timeframe agreed upon by both parties.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">4. Revisions</h2>
  <p>The project fee includes up to two rounds of revisions. Additional revisions will be billed at the Contractor&#8217;s standard hourly rate.</p>

  <h2 style="font-size: 16px; margin-top: 24px; color: #222;">5. Deliverables &amp; Acceptance</h2>
  <p>Client has 14 days after delivery to request changes or reject the work. After 14 days, the work is considered accepted and final payment is due.</p>

  <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 13px; color: #555;">
    This agreement is governed by the laws of the jurisdiction in which Contractor operates.
  </p>
</div>`,
  },
];

export function renderContractTemplate(body: string, variables: Record<string, string>): string {
  let rendered = body;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return rendered;
}

export function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
}
