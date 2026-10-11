import nodemailer from 'nodemailer';

// Optional: forwards contact-form messages by email over Gmail SMTP. Everything comes from the environment
// (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, CONTACT_TO). Without it, messages are only kept
// in the admin inbox.
export function mailConfigured(env = process.env) {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.CONTACT_TO);
}

export function createContactMailer(env = process.env) {
  if (!mailConfigured(env)) return null;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT) || 587,
    secure: Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return async (m) => {
    await transport.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: env.CONTACT_TO,
      replyTo: m.email,
      subject: `FoodShop contact: ${m.name}`,
      text: `From: ${m.name} <${m.email}>\n\n${m.message}`,
    });
  };
}
