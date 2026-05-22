interface SMSTemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
  promisedDate?: Date;
}
interface SMSContent {
  body: string;
}
const OPT_OUT = "\n\nReply STOP to unsubscribe from these messages.";
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function gentleReminder(p: SMSTemplateParams): SMSContent {
  const ref = p.invoiceNumber ? ` #${p.invoiceNumber}` : "";
  return {
    body: `Hi ${p.clientName}, just a friendly reminder that invoice${ref} for ${formatAmount(p.amount, p.currency)} is due on ${formatDate(p.dueDate)}. Pay here: ${p.paymentLink}${OPT_OUT}`,
  };
}
function dueToday(p: SMSTemplateParams): SMSContent {
  const ref = p.invoiceNumber ? ` #${p.invoiceNumber}` : "";
  return {
    body: `Hi ${p.clientName}, invoice${ref} for ${formatAmount(p.amount, p.currency)} is due TODAY (${formatDate(p.dueDate)}). Please arrange payment: ${p.paymentLink}${OPT_OUT}`,
  };
}
function overdueNotice(p: SMSTemplateParams): SMSContent {
  const ref = p.invoiceNumber ? ` #${p.invoiceNumber}` : "";
  return {
    body: `Hi ${p.clientName}, invoice${ref} for ${formatAmount(p.amount, p.currency)} due ${formatDate(p.dueDate)} is now OVERDUE. Please pay as soon as possible: ${p.paymentLink}${OPT_OUT}`,
  };
}
function firmReminder(p: SMSTemplateParams): SMSContent {
  const ref = p.invoiceNumber ? ` #${p.invoiceNumber}` : "";
  return {
    body: `Hi ${p.clientName}, this is a final reminder for invoice${ref} (${formatAmount(p.amount, p.currency)}), due ${formatDate(p.dueDate)}. Please pay immediately to avoid further action: ${p.paymentLink}${OPT_OUT}`,
  };
}
function finalNotice(p: SMSTemplateParams): SMSContent {
  const ref = p.invoiceNumber ? ` #${p.invoiceNumber}` : "";
  return {
    body: `FINAL NOTICE: ${p.clientName}, invoice${ref} for ${formatAmount(p.amount, p.currency)} remains unpaid. Pay now to avoid escalation: ${p.paymentLink}${OPT_OUT}`,
  };
}
function brokenPromiseNotice(p: SMSTemplateParams): SMSContent {
  const ref = p.invoiceNumber ? ` #${p.invoiceNumber}` : "";
  const promised = p.promisedDate ? ` (promised ${formatDate(p.promisedDate)})` : "";
  return {
    body: `Hi ${p.clientName}, you previously indicated payment would be sent${promised} for invoice${ref} (${formatAmount(p.amount, p.currency)}), but we haven't received it yet. Please pay now: ${p.paymentLink}${OPT_OUT}`,
  };
}
const templates: Record<string, (params: SMSTemplateParams) => SMSContent> = {
  gentle_reminder: gentleReminder,
  due_today: dueToday,
  overdue_notice: overdueNotice,
  firm_reminder: firmReminder,
  final_notice: finalNotice,
  broken_promise_notice: brokenPromiseNotice as (params: SMSTemplateParams) => SMSContent,
};
export function getSMSTemplate(name: string): ((params: SMSTemplateParams) => SMSContent) | null {
  return templates[name] ?? null;
}
export type { SMSTemplateParams, SMSContent };
