export interface TierConfig {
  name: string;
  invoiceLimit: number | null;
  priceCents: number;
  aiRemindersLimit: number;
  clientPortal: boolean;
  lateFees: boolean;
  teamMembers: boolean;
  teamSeats: number;
  smsLimit: number;
  whatsappLimit: number;
  features: string[];
}

export const TIERS: Record<string, TierConfig> = {
  free: {
    name: "Free",
    invoiceLimit: 5,
    priceCents: 0,
    aiRemindersLimit: 0,
    clientPortal: false,
    lateFees: false,
    teamMembers: false,
    teamSeats: 0,
    smsLimit: 0,
    whatsappLimit: 0,
    features: ["5 invoices per month", "Automated reminders", "CSV upload", "Email support"],
  },
  pro: {
    name: "Pro",
    invoiceLimit: 50,
    priceCents: 999,
    aiRemindersLimit: 100,
    clientPortal: true,
    lateFees: true,
    teamMembers: false,
    teamSeats: 0,
    smsLimit: 50,
    whatsappLimit: 50,
    features: ["50 invoices per month", "Automated reminders", "CSV upload", "Xero integration", "AI-generated reminders (100/mo)", "SMS & WhatsApp reminders (50/mo)", "White-labeled client portal", "Late fees & interest", "Payment probability scores", "Cash flow forecasting", "Priority support", "payment_probability", "cash_flow_forecast"],
  },
  agency: {
    name: "Agency",
    invoiceLimit: null,
    priceCents: 2999,
    aiRemindersLimit: 1000,
    clientPortal: true,
    lateFees: true,
    teamMembers: true,
    teamSeats: 5,
    smsLimit: 500,
    whatsappLimit: 500,
    features: ["Unlimited invoices", "Automated reminders", "CSV upload", "All integrations", "AI-generated reminders (1000/mo)", "SMS & WhatsApp reminders (500/mo)", "White-labeled client portal", "Late fees & interest", "Payment probability scores", "Cash flow forecasting", "Dedicated support", "Team members (up to 5)", "payment_probability", "cash_flow_forecast"],
  },
};

export function getTier(plan: string): TierConfig {
  return TIERS[plan] ?? TIERS.free;
}
