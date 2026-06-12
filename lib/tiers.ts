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
  autoChargeLimit: number | null;
  installmentLimit: number;
  apiKeysLimit: number;
  webhookEndpointsLimit: number;
  apiRateLimit: number;
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
    autoChargeLimit: 0,
    installmentLimit: 0,
    apiKeysLimit: 0,
    webhookEndpointsLimit: 0,
    apiRateLimit: 0,
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
    autoChargeLimit: 50,
    installmentLimit: 3,
    apiKeysLimit: 3,
    webhookEndpointsLimit: 5,
    apiRateLimit: 100,
    features: ["50 invoices per month", "Automated reminders", "CSV upload", "Xero integration", "AI-generated reminders (100/mo)", "SMS & WhatsApp reminders (50/mo)", "White-labeled client portal", "Late fees & interest", "Auto-charge (50/mo)", "Payment plans (up to 3 installments)", "API access (3 keys, 100 req/min)", "Outbound webhooks (5 endpoints)", "Payment probability scores", "Cash flow forecasting", "Priority support", "payment_probability", "cash_flow_forecast"],
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
    autoChargeLimit: null,
    installmentLimit: 100,
    apiKeysLimit: 50,
    webhookEndpointsLimit: 50,
    apiRateLimit: 1000,
    features: ["Unlimited invoices", "Automated reminders", "CSV upload", "All integrations", "AI-generated reminders (1000/mo)", "SMS & WhatsApp reminders (500/mo)", "White-labeled client portal", "Late fees & interest", "Unlimited auto-charge", "Unlimited payment plans", "API access (50 keys, 1000 req/min)", "Outbound webhooks (50 endpoints)", "Payment probability scores", "Cash flow forecasting", "Dedicated support", "Team members (up to 5)", "payment_probability", "cash_flow_forecast"],
  },
};

export function getTier(plan: string): TierConfig {
  return TIERS[plan] ?? TIERS.free;
}
