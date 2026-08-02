/**
 * Nodemailer — Gmail SMTP transport
 *
 * Gmail SMTP on port 465 uses SSL (not STARTTLS).
 * The "from" address is the configured MAIL_FROM_ADDRESS, not the SMTP user —
 * Gmail allows this as long as the sending account has verified the alias.
 *
 * Required env vars:
 *   MAIL_HOST          smtp.gmail.com
 *   MAIL_PORT          465
 *   MAIL_USERNAME      miuchs@oauife.edu.ng
 *   MAIL_PASSWORD      (App password from Google Account → Security → App passwords)
 *   MAIL_FROM_ADDRESS  no-reply@envolvepharm.com.ng
 *   MAIL_FROM_NAME     Envolve Support
 *   FRONTEND_URL       https://envolvepharm.com.ng
 */

import nodemailer from 'nodemailer';

// ─── Transporter singleton ────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST   ?? 'smtp.gmail.com',
  port:   Number(process.env.MAIL_PORT ?? 465),
  secure: true, // port 465 → SSL
  auth: {
    user: process.env.MAIL_USERNAME!,
    pass: process.env.MAIL_PASSWORD!,
  },
});

// ─── Core send helper ─────────────────────────────────────────────────────────

interface MailOptions {
  to:      string;
  subject: string;
  html:    string;
  text?:   string; // plain-text fallback
}

export async function sendMail(opts: MailOptions): Promise<void> {
  await transporter.sendMail({
    from:    `"${process.env.MAIL_FROM_NAME ?? 'Envolve Support'}" <${process.env.MAIL_FROM_ADDRESS}>`,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });
}

// ─── Templated emails ─────────────────────────────────────────────────────────

const frontendUrl = process.env.FRONTEND_URL ?? 'https://envolvepharm.com.ng';

/**
 * Send a 6-digit OTP for email verification or password reset.
 */
export async function sendOtpEmail(params: {
  to:    string;
  name:  string;
  otp:   string;
  type:  'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
}): Promise<void> {
  const isReset = params.type === 'PASSWORD_RESET';

  await sendMail({
    to:      params.to,
    subject: isReset
      ? 'Envolve Pharmacy — Password Reset OTP'
      : 'Envolve Pharmacy — Verify Your Email',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${isReset ? 'Password Reset' : 'Verify Email'}</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                <!-- Header -->
                <tr>
                  <td style="background:#1A7C4F;padding:28px 32px;">
                    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">Envolve Pharmacy</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:36px 32px;">
                    <p style="margin:0 0 16px;font-size:16px;color:#111;">Hi ${params.name},</p>
                    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
                      ${isReset
                        ? 'You requested a password reset. Use the OTP below to continue:'
                        : 'Thanks for signing up! Please verify your email address with the OTP below:'}
                    </p>
                    <!-- OTP block -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                      <tr>
                        <td style="background:#f0faf5;border:2px solid #1A7C4F;border-radius:8px;padding:20px 40px;text-align:center;">
                          <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#1A7C4F;">
                            ${params.otp}
                          </span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 8px;font-size:13px;color:#888;">
                      This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
                    </p>
                    <p style="margin:0;font-size:13px;color:#888;">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#fafafa;padding:20px 32px;border-top:1px solid #eee;">
                    <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
                      &copy; ${new Date().getFullYear()} Envolve Pharmacy &bull;
                      <a href="${frontendUrl}" style="color:#1A7C4F;text-decoration:none;">envolvepharm.com.ng</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Your ${isReset ? 'password reset' : 'email verification'} OTP is: ${params.otp}\n\nThis code expires in 10 minutes.`,
  });
}

/**
 * Send a welcome email after account is fully approved.
 */
export async function sendWelcomeEmail(params: {
  to:   string;
  name: string;
}): Promise<void> {
  await sendMail({
    to:      params.to,
    subject: 'Welcome to Envolve Pharmacy!',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><title>Welcome</title></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
              <tr>
                <td style="background:#1A7C4F;padding:28px 32px;">
                  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">Envolve Pharmacy</p>
                </td>
              </tr>
              <tr>
                <td style="padding:36px 32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#111;">Hi ${params.name},</p>
                  <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
                    Your account has been <strong>approved</strong>. You can now log in and start placing orders.
                  </p>
                  <a href="${frontendUrl}/portal" style="display:inline-block;background:#1A7C4F;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;">
                    Go to Portal →
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background:#fafafa;padding:20px 32px;border-top:1px solid #eee;">
                  <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
                    &copy; ${new Date().getFullYear()} Envolve Pharmacy
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${params.name}, your Envolve Pharmacy account is approved. Visit ${frontendUrl}/portal to get started.`,
  });
}

/**
 * Notify admin that a new customer is pending PCN review.
 */
export async function sendPcnReviewNotificationEmail(params: {
  adminEmail:   string;
  customerName: string;
  customerEmail: string;
}): Promise<void> {
  await sendMail({
    to:      params.adminEmail,
    subject: `[Action Required] PCN Review — ${params.customerName}`,
    html: `
      <p>A new customer is awaiting PCN certificate review.</p>
      <p><strong>Name:</strong> ${params.customerName}<br />
         <strong>Email:</strong> ${params.customerEmail}</p>
      <p><a href="${frontendUrl}/admin/customers">Review in Admin Console →</a></p>
    `,
    text: `New PCN review needed for ${params.customerName} (${params.customerEmail}). Visit ${frontendUrl}/admin/customers`,
  });
}
