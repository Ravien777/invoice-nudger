interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
  promisedDate?: Date;
  accruedFees?: number;
  feeNote?: string;
}

interface EmailContent {
  subject: string;
  html: string;
}

const templateLoaders: Record<string, () => Promise<(params: TemplateParams) => EmailContent>> = {
  gentle_reminder: () => import("./gentle_reminder").then((m) => m.gentleReminder),
  due_today: () => import("./due_today").then((m) => m.dueToday),
  overdue_notice: () => import("./overdue_notice").then((m) => m.overdueNotice),
  firm_reminder: () => import("./firm_reminder").then((m) => m.firmReminder),
  final_notice: () => import("./final_notice").then((m) => m.finalNotice),
  broken_promise_notice: () => import("./broken_promise_notice").then((m) => m.brokenPromiseNotice as (params: TemplateParams) => EmailContent),
};

export async function getTemplate(name: string): Promise<((params: TemplateParams) => EmailContent) | null> {
  const loader = templateLoaders[name];
  return loader ? loader() : null;
}

export type { TemplateParams, EmailContent };
