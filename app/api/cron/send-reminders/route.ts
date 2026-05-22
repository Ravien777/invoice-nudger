import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";
import { sendSMS, sendWhatsApp } from "@/lib/notification";
import { generateReminderCopy } from "@/lib/openai";
import { getTier } from "@/lib/tiers";
import { canGenerateAI, incrementAIUsage, canSendNotification, incrementNotificationUsage } from "@/lib/subscriptions";
import { getTemplate } from "@/lib/email-templates";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const unpaidInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["unpaid", "overdue"] } },
    include: {
      user: true,
      reminderSchedule: {
        include: { steps: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let aiGenerated = 0;
  let aiSkippedPending = 0;
  let aiExpired = 0;
  let errors = 0;
  let promiseSkipped = 0;
  let brokenPromiseSent = 0;
  let smsSent = 0;
  let whatsappSent = 0;
  const results: Array<{
    invoiceId: string;
    invoiceNumber: string | null;
    clientName: string;
    step: string;
    status: "sent" | "skipped" | "ai_generated" | "ai_pending" | "ai_expired" | "error" | "promise_hold" | "broken_promise" | "sms" | "whatsapp";
    reason?: string;
  }> = [];

  for (const invoice of unpaidInvoices) {
    const schedule =
      invoice.reminderSchedule ??
      (await prisma.reminderSchedule.findFirst({
        where: { userId: invoice.userId, isDefault: true },
        include: { steps: true },
      }));

    if (!schedule) {
      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        step: "none",
        status: "skipped",
        reason: "No schedule found",
      });
      skipped++;
      continue;
    }

    const existingLogs = await prisma.reminderLog.findMany({
      where: { invoiceId: invoice.id },
      select: { stepName: true, aiGenerated: true, approved: true, emailBody: true, subjectLine: true, id: true, channel: true },
    });
    const sentSteps = new Set(existingLogs.filter((l) => !l.aiGenerated).map((l) => l.stepName));

    const userTier = getTier(invoice.user.plan);
    const aiEnabled = invoice.user.aiRemindersEnabled && userTier.aiRemindersLimit > 0;
    const smsEnabled = userTier.smsLimit > 0 && !!invoice.clientPhone;
    const whatsappEnabled = userTier.whatsappLimit > 0 && !!invoice.clientPhone;

    if (invoice.promiseStatus === "active" && invoice.promisedDate) {
      const promisedDate = new Date(invoice.promisedDate);
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      if (promisedDate > todayUtc) {
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          step: "none",
          status: "promise_hold",
          reason: `Reminder paused until promised date: ${promisedDate.toLocaleDateString()}`,
        });
        promiseSkipped++;
        continue;
      }

      if (promisedDate <= todayUtc && invoice.status !== "paid") {
        const brokenPromiseLog = await prisma.reminderLog.findFirst({
          where: {
            invoiceId: invoice.id,
            stepName: "broken_promise_notice",
          },
        });

        if (!brokenPromiseLog) {
          const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
          const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

          const templateFn = getTemplate("broken_promise_notice");
          if (templateFn) {
            const content = templateFn({
              clientName: invoice.clientName,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              currency: invoice.currency,
              dueDate: invoice.dueDate,
              paymentLink,
              promisedDate,
              accruedFees: invoice.accruedFees,
            });

            const result = await sendReminderEmail(
              {
                id: invoice.id,
                clientName: invoice.clientName,
                clientEmail: invoice.clientEmail,
                amount: invoice.amount,
                currency: invoice.currency,
                dueDate: invoice.dueDate,
                invoiceNumber: invoice.invoiceNumber,
                paymentLink,
                accruedFees: invoice.accruedFees,
              },
              { emailTemplate: "broken_promise_notice" }
            );

            if (result.success) {
              await prisma.invoice.update({
                where: { id: invoice.id },
                data: { promiseStatus: "expired" },
              });

              await prisma.promiseEvent.updateMany({
                where: { invoiceId: invoice.id, status: "active" },
                data: { status: "expired" },
              });

              brokenPromiseSent++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: "broken_promise_notice",
                status: "broken_promise",
                reason: "Broken promise notice sent, normal schedule resumes",
              });
              continue;
            }
          }

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { promiseStatus: "expired" },
          });

          await prisma.promiseEvent.updateMany({
            where: { invoiceId: invoice.id, status: "active" },
            data: { status: "expired" },
          });
        }
      }
    }

    if (invoice.promiseStatus === "pending_review") {
    }

    for (const step of schedule.steps) {
      if (sentSteps.has(step.emailTemplate)) {
        continue;
      }

      const stepDueDate = new Date(
        Date.UTC(
          invoice.dueDate.getUTCFullYear(),
          invoice.dueDate.getUTCMonth(),
          invoice.dueDate.getUTCDate() + step.daysOffset
        )
      );

      if (stepDueDate.getTime() !== today.getTime()) {
        continue;
      }

      if (aiEnabled) {
        const aiLog = existingLogs.find(
          (l) => l.stepName === step.emailTemplate && l.aiGenerated
        );

        if (aiLog) {
          if (aiLog.approved && aiLog.emailBody && aiLog.subjectLine) {
            const daysSinceDue = Math.floor(
              (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            const expired = daysSinceDue > 0 && step.daysOffset >= 0;

            if (expired) {
              await prisma.reminderLog.delete({ where: { id: aiLog.id } });
              aiExpired++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "ai_expired",
                reason: "Approved AI reminder expired, needs regeneration",
              });
              continue;
            }

            const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
            const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

            const result = await sendReminderEmail(
              {
                id: invoice.id,
                clientName: invoice.clientName,
                clientEmail: invoice.clientEmail,
                amount: invoice.amount,
                currency: invoice.currency,
                dueDate: invoice.dueDate,
                invoiceNumber: invoice.invoiceNumber,
                paymentLink,
              },
              { emailTemplate: step.emailTemplate },
              { aiCopy: { subject: aiLog.subjectLine, html: aiLog.emailBody } }
            );

            if (result.success) {
              sent++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "sent",
              });

              if (step.daysOffset > 0) {
                await prisma.invoice.update({
                  where: { id: invoice.id },
                  data: { status: "overdue" },
                });
              }
            } else {
              errors++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "error",
                reason: result.error,
              });
            }
            continue;
          }

          if (!aiLog.approved) {
            aiSkippedPending++;
            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              clientName: invoice.clientName,
              step: step.emailTemplate,
              status: "ai_pending",
              reason: "AI reminder awaiting approval",
            });
            continue;
          }
        }

        const limitCheck = await canGenerateAI(invoice.userId);
        if (limitCheck.allowed) {
          try {
            const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
            const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

            const generated = await generateReminderCopy({
              clientName: invoice.clientName,
              projectName: invoice.projectName,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              currency: invoice.currency,
              dueDate: invoice.dueDate,
              daysOffset: step.daysOffset,
              tone: (invoice.user.aiTone as "professional" | "friendly" | "firm" | "casual") ?? "professional",
              paymentLink,
            });

            await incrementAIUsage(invoice.userId);

            await prisma.reminderLog.create({
              data: {
                invoiceId: invoice.id,
                stepName: step.emailTemplate,
                emailBody: generated.html,
                subjectLine: generated.subject,
                aiGenerated: true,
                approved: false,
              },
            });

            aiGenerated++;
            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              clientName: invoice.clientName,
              step: step.emailTemplate,
              status: "ai_generated",
              reason: "AI reminder generated, awaiting approval",
            });
          } catch (err) {
            console.error("AI generation failed in cron:", err);
            const result = await sendReminderEmailStatic(invoice, step);
            if (result.success) {
              sent++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "sent",
              });
            } else {
              errors++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "error",
                reason: result.error,
              });
            }
          }
          continue;
        }
      }

      const emailResult = await sendReminderEmailStatic(invoice, step);
      if (emailResult.success) {
        sent++;
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          step: step.emailTemplate,
          status: "sent",
        });

        if (step.daysOffset > 0) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "overdue" },
          });
        }
      } else {
        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;
        const invoiceData = {
          id: invoice.id,
          clientName: invoice.clientName,
          clientPhone: invoice.clientPhone,
          clientEmail: invoice.clientEmail,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          invoiceNumber: invoice.invoiceNumber,
          paymentLink,
        };

        if (whatsappEnabled) {
          const waCheck = await canSendNotification(invoice.userId, "whatsapp");
          if (waCheck.allowed) {
            const waResult = await sendWhatsApp(invoiceData, step);
            if (waResult.success) {
              await incrementNotificationUsage(invoice.userId, "whatsapp");
              whatsappSent++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "whatsapp",
                reason: "Email failed, sent via WhatsApp",
              });
              continue;
            }
          }
        }

        if (smsEnabled) {
          const smsCheck = await canSendNotification(invoice.userId, "sms");
          if (smsCheck.allowed) {
            const smsResult = await sendSMS(invoiceData, step);
            if (smsResult.success) {
              await incrementNotificationUsage(invoice.userId, "sms");
              smsSent++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName,
                step: step.emailTemplate,
                status: "sms",
                reason: "Email failed, sent via SMS",
              });
              continue;
            }
          }
        }

        errors++;
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          step: step.emailTemplate,
          status: "error",
          reason: emailResult.error || "Email failed and no fallback channels available",
        });
      }
    }
  }

  return NextResponse.json({
    date: today.toISOString(),
    summary: { sent, skipped, aiGenerated, aiSkippedPending, aiExpired, promiseSkipped, brokenPromiseSent, smsSent, whatsappSent, errors },
    results,
  });
}

async function sendReminderEmailStatic(
  invoice: {
    id: string;
    clientName: string;
    clientEmail: string;
    amount: number;
    currency: string;
    dueDate: Date;
    invoiceNumber: string | null;
    paymentLink: string | null;
    accruedFees?: number;
  },
  step: { emailTemplate: string }
): Promise<{ success: boolean; error?: string }> {
  const result = await sendReminderEmail(
    {
      id: invoice.id,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
      paymentLink: invoice.paymentLink,
      accruedFees: invoice.accruedFees,
    },
    { emailTemplate: step.emailTemplate }
  );
  return { success: result.success, error: result.error };
}
