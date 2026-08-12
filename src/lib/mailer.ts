import nodemailer from "nodemailer";

/**
 * Free password-reset emails via Gmail SMTP -- no new third-party signup,
 * just an App Password on an existing Gmail account (GMAIL_USER +
 * GMAIL_APP_PASSWORD). Gmail's free sending limit (500/day) is far more
 * than a personal app needs. Gracefully no-ops if not configured.
 */
export function isMailerConfigured(): boolean {
  return !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!isMailerConfigured()) {
    console.error("[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not configured -- cannot send reset email");
    return;
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"Portfolio Watcher" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Reset your Portfolio Watcher password",
    text: `Someone requested a password reset for your Portfolio Watcher account.\n\nReset your password here (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #17212e;">
        <h2 style="margin-bottom: 4px;">Portfolio Watcher</h2>
        <p style="font-family: -apple-system, sans-serif; font-size: 14px; color: #33414f;">
          Someone requested a password reset for your account. This link expires in 1 hour.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #1f6f78; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600;">
            Reset your password
          </a>
        </p>
        <p style="font-family: -apple-system, sans-serif; font-size: 12px; color: #5c6b7a;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
