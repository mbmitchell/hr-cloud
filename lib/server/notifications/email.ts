import nodemailer from "nodemailer";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

type SendEmailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string };

let cachedTransporter: nodemailer.Transporter | null = null;

function getEmailConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER?.trim() || "",
    pass: process.env.SMTP_PASS?.trim() || "",
    from: process.env.SMTP_FROM?.trim() || "",
  };
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getEmailConfig();

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    requireTLS: true,
    auth:
      config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
  });

  return cachedTransporter;
}

export async function sendEmail(
  message: EmailMessage
): Promise<SendEmailResult> {
  const config = getEmailConfig();

  if (!config.from || !config.user || !config.pass) {
    console.warn(
      "Email notifications skipped because SMTP_FROM, SMTP_USER, or SMTP_PASS is not configured."
    );

    return {
      sent: false,
      skipped: true,
      reason: "SMTP is not fully configured.",
    };
  }

  const transporter = getTransporter();

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });

  return { sent: true };
}
