import { z } from "zod";

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Unit price must be 0 or more"),
  taxRate: z.coerce.number().min(0).optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().default(0),
});

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
  lineItems: z.array(invoiceLineItemSchema).optional().default([]),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  currency: z.string().length(3).default("USD"),
  date: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Invalid date format"),
  vendor: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  taxDeductible: z.boolean().default(true),
  notes: z.string().optional().or(z.literal("")),
  receiptUrl: z.string().url().optional().or(z.literal("")),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

export const quoteLineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Unit price must be 0 or more"),
  taxRate: z.coerce.number().min(0).optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().default(0),
});

export const quoteSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientAddress: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  currency: z.string().default("USD"),
  issueDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), "Invalid date format"),
  expiryDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), "Invalid date format").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  sellerName: z.string().optional().or(z.literal("")),
  sellerAddress: z.string().optional().or(z.literal("")),
  sellerTaxId: z.string().optional().or(z.literal("")),
  paymentTerms: z.string().optional().or(z.literal("")),
  subtotal: z.coerce.number().optional(),
  totalTax: z.coerce.number().optional(),
  lineItems: z.array(quoteLineItemSchema).optional().default([]),
});

export type QuoteFormData = z.infer<typeof quoteSchema>;

export const recurringSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  currency: z.string().default("USD"),
  frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annually"]),
  dayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
  nextRunDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), "Invalid date"),
  endDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), "Invalid date").optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  autoSend: z.boolean().default(true),
  reminderScheduleId: z.string().optional().or(z.literal("")),
  lineItems: z.array(invoiceLineItemSchema).optional().default([]),
});

export type RecurringFormData = z.infer<typeof recurringSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Valid email is required").transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type SignupFormData = z.infer<typeof signupSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Invalid token"),
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required").transform((e) => e.toLowerCase()),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const devSigninSchema = z.object({
  email: z.string().email("Valid email is required"),
});
