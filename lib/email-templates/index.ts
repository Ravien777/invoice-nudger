import { gentleReminder } from "./gentle_reminder";
import { dueToday } from "./due_today";
import { overdueNotice } from "./overdue_notice";
import { firmReminder } from "./firm_reminder";
import { finalNotice } from "./final_notice";
import { brokenPromiseNotice } from "./broken_promise_notice";

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

const templates: Record<string, (params: TemplateParams) => EmailContent> = {
  gentle_reminder: gentleReminder,
  due_today: dueToday,
  overdue_notice: overdueNotice,
  firm_reminder: firmReminder,
  final_notice: finalNotice,
  broken_promise_notice: brokenPromiseNotice as (params: TemplateParams) => EmailContent,
};

export function getTemplate(name: string): ((params: TemplateParams) => EmailContent) | null {
  return templates[name] ?? null;
}

export type { TemplateParams, EmailContent };
