import nodemailer from "nodemailer";

import type { EmailMessage, EmailSendResult } from "../types";

let cachedTransporter: nodemailer.Transporter | null = null;

function getDevTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    jsonTransport: true,
  });

  return cachedTransporter;
}

export async function sendWithDevTransport(
  message: EmailMessage,
  from: string
): Promise<EmailSendResult> {
  const transporter = getDevTransporter();
  const info = await transporter.sendMail({
    from: from || "mfn-hr-notifications@localhost",
    to: message.to,
    replyTo: message.replyTo || undefined,
    subject: message.subject,
    text: message.text,
    attachments: message.attachments?.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: Buffer.from(attachment.contentBase64, "base64"),
    })),
  });

  return {
    sent: true,
    provider: "dev",
    messageId: typeof info.messageId === "string" ? info.messageId : undefined,
    preview:
      typeof info.message === "string" ? info.message : undefined,
  };
}
