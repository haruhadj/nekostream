/**
 * Thin SMTP sender for the new-episode notification.
 *
 * Most self-hosted instances will never set SMTP_HOST, so a missing config is
 * a logged no-op rather than a thrown error — the poller that calls this must
 * never be able to fail because a mail feature nobody configured is broken.
 */

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";

export function isEmailConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE === "true",
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });

  return transporter;
}

export async function sendMail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] SMTP not configured — skipped "${subject}" to ${to}`);
    return;
  }

  await getTransporter().sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER ?? "nekostream@localhost",
    to,
    subject,
    text,
  });
}
