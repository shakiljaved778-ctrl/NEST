// Email abstraction: "console" driver logs to stdout (dev default), "smtp"
// sends via nodemailer using SMTP_* env vars.

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.EMAIL_DRIVER === "smtp" && process.env.SMTP_HOST) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "CRM <crm@example.com>",
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return;
  }
  console.log(
    `\n─── EMAIL (console driver) ───\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n──────────────────────────────\n`
  );
}
