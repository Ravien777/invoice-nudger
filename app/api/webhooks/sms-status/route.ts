import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const messageStatus = formData.get("MessageStatus") as string | null;
  const from = formData.get("From") as string | null;
  const body = (formData.get("Body") as string | null)?.trim().toUpperCase();
  const to = formData.get("To") as string | null;

  if (messageStatus === "undelivered" || messageStatus === "failed") {
    console.warn(`SMS delivery failed to ${from}: status=${messageStatus}`);
    return NextResponse.json({ ok: true });
  }

  const isWhatsApp = to?.startsWith("whatsapp:") || from?.startsWith("whatsapp:");
  const channel = isWhatsApp ? "whatsapp" : "sms";

  const fromPhone = (from ?? "").replace(/^whatsapp:/, "");

  if (body === "STOP" || body === "STOPALL" || body === "UNSUBSCRIBE" || body === "CANCEL" || body === "END" || body === "QUIT") {
    if (fromPhone) {
      await prisma.sMSOptOut.upsert({
        where: { phone_channel: { phone: fromPhone, channel } },
        update: {},
        create: { phone: fromPhone, channel },
      });
      console.log(`Opt-out recorded for ${fromPhone} on ${channel}`);
    }
  }

  return NextResponse.json({ ok: true });
}
