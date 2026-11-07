import "dotenv/config";
import { sendEmail } from "../src/lib/email.js";

const to = process.argv[2];
if (!to) {
  console.log("Usage: node scripts/send-test-email.mjs you@example.com");
  process.exit(1);
}
if (!process.env.SMTP_HOST) {
  console.log("SMTP_HOST is not set, so the email will only be printed.");
}

await sendEmail({
  to,
  subject: "Change Detector test",
  text: "If you can read this, email sending works.",
});
console.log("Done.");