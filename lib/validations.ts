import { z } from "zod";

export const invoiceSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number (use E.164 format, e.g. +12025551234)").optional().or(z.literal("")),
  projectName: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  currency: z.string().default("USD"),
  dueDate: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Invalid date format"),
  invoiceNumber: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  reminderScheduleId: z.string().optional().or(z.literal("")),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
