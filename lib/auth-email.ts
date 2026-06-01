import { Resend } from "resend";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY ?? "");
  }
  return resend;
}

const MAGIC_LINK_FILE = join(process.cwd(), "magic-link.txt");

function writeLinkToFile(label: string, url: string) {
  try {
    const dir = dirname(MAGIC_LINK_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(MAGIC_LINK_FILE, `${label}\n${url}\n`);
  } catch {}
}

export async function sendAuthEmail({
  to,
  subject,
  html,
  linkLabel,
  linkUrl,
}: {
  to: string;
  subject: string;
  html: string;
  linkLabel?: string;
  linkUrl?: string;
}) {
  if (linkLabel && linkUrl) writeLinkToFile(linkLabel, linkUrl);

  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? "",
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[Resend] API error:", JSON.stringify(error));
    } else {
      console.log("[Resend] Email sent, id:", data?.id);
    }
  } catch (err) {
    console.error("[Resend] Failed to send:", err);
  }

  if (linkUrl) {
    console.log("");
    console.log("========================================");
    console.log(`  ${linkLabel || "LINK"} for:`, to);
    console.log("  " + linkUrl);
    console.log("========================================");
    console.log("");
  }
}
