import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const t = getTransporter();
    if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured.");
    }
    console.log(`[dev email] to: ${to}\nsubject: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
}