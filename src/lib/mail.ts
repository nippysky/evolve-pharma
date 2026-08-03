/**
 * Envolve Pharmaceuticals — Nodemailer email system
 *
 * ─── PHPMailer vs Nodemailer ──────────────────────────────────────────────────
 * PHPMailer is a PHP library — it cannot run in Node.js. Nodemailer is the
 * Node.js equivalent. The HTML templates from the backend are just HTML files
 * with {{PLACEHOLDER}} variables — they're language-agnostic. We reuse the
 * same design here by embedding the HTML in TypeScript and substituting
 * variables with `.replace()` / template literals. The SMTP server (Gmail)
 * is unchanged.
 *
 * ─── Anti-spam checklist ─────────────────────────────────────────────────────
 * ✓ multipart/alternative  — HTML + plain text in every send (required by Gmail/Yahoo)
 * ✓ Proper From header     — "Display Name <real@domain>" (not a bare address)
 * ✓ Specific subject lines — no ALL-CAPS, no "FREE!!!", meaningful content
 * ✓ Valid HTML             — no JavaScript, no external CSS, only inline styles
 * ✓ Physical address       — in footer (CAN-SPAM compliance)
 * ✓ Table-based layout     — max email client compatibility
 * ✓ Preheader text         — hidden preview line shown in inbox
 * ✓ Reply-To header        — points to a monitored support inbox
 * ✓ Single recipient       — one To per send, no BCC blasting
 *
 * ─── DNS records (configure on Hostinger DNS — not in code) ──────────────────
 * SPF:   TXT @ "v=spf1 include:_spf.google.com ~all"
 * DKIM:  auto-configured by Google Workspace / Gmail SMTP
 * DMARC: TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:postmaster@envolvepharm.com.ng"
 *
 * ─── Bearer tokens vs cookies ─────────────────────────────────────────────────
 * Our API routes use httpOnly cookies (ep_access, ep_refresh). The browser
 * automatically attaches these on every same-origin fetch — no Authorization
 * header needed. The `Authorization: Bearer` code in our route handlers is
 * only a fallback for mobile clients. Web clients never touch bearer tokens.
 * This is exactly what the backend engineer described: session handled on the
 * server per user, no token in the request headers for browser traffic.
 *
 * Required env vars:
 *   MAIL_HOST           smtp.gmail.com
 *   MAIL_PORT           465
 *   MAIL_USERNAME       miuchs@oauife.edu.ng       (Gmail account)
 *   MAIL_PASSWORD       "app password"              (Google App Password)
 *   MAIL_FROM_ADDRESS   no-reply@envolvepharm.com.ng
 *   MAIL_FROM_NAME      EnvolveCare Express
 *   FRONTEND_URL        https://www.envolvepharm.com.ng
 */

import nodemailer from 'nodemailer';

// ─── Constants ────────────────────────────────────────────────────────────────

// Logo is served from the Next.js public folder — accessible at /images/Evolve_Pharm.png
// in production (Vercel). We derive the URL from FRONTEND_URL so it always points
// to the live domain rather than localhost (email clients can't reach localhost).
function logoUrl(): string {
  return `${siteUrl()}/images/Evolve_Pharm.png`;
}

const APP_NAME = 'EnvolveCare Express';

function siteUrl(): string {
  return process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';
}

function year(): number {
  return new Date().getFullYear();
}

// ─── Transport singleton ──────────────────────────────────────────────────────

const transport = nodemailer.createTransport({
  host:   process.env.MAIL_HOST   ?? 'smtp.gmail.com',
  port:   Number(process.env.MAIL_PORT ?? 465),
  secure: true, // port 465 = implicit TLS (not STARTTLS)
  auth: {
    user: process.env.MAIL_USERNAME!,
    pass: process.env.MAIL_PASSWORD!,
  },
  // Connection pool — reuse connections for bulk sends
  pool:           true,
  maxConnections: 3,
  maxMessages:    100,
});

// ─── Core send helper ─────────────────────────────────────────────────────────

interface MailOptions {
  to:       string;
  subject:  string;
  html:     string;
  text:     string; // plain-text fallback — required for anti-spam
  replyTo?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const fromName    = process.env.MAIL_FROM_NAME    ?? 'EnvolveCare Express';
  const fromAddress = process.env.MAIL_FROM_ADDRESS ?? 'no-reply@envolvepharm.com.ng';

  await transport.sendMail({
    from:     `"${fromName}" <${fromAddress}>`,
    replyTo:  opts.replyTo ?? `"Envolve Support" <support@envolvepharm.com.ng>`,
    to:       opts.to,
    subject:  opts.subject,
    // multipart/alternative: email clients pick the richest version they support
    html:     opts.html,
    text:     opts.text,
    headers: {
      // Marks as automated — reduces spam score vs. unexpected email
      'Auto-Submitted':   'auto-generated',
      'X-Mailer':         'EnvolveCare/1.0 (Nodemailer)',
      // Prevents threading this email with replies in some clients
      'X-Entity-Ref-ID':  `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
}

// ─── HTML email shell ─────────────────────────────────────────────────────────
// Table-based layout for max email client compatibility (Outlook, Apple Mail,
// Gmail web, Gmail Android, Yahoo Mail). Inline styles only — external CSS
// is stripped by most clients.

function shell(preheader: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${APP_NAME}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
  </xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader: shown in inbox preview — keep under 100 chars -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f1f5f9;mso-hide:all;">
  ${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
</div>

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
  style="background:#f1f5f9;min-width:100%;">
  <tr>
    <td align="center" style="padding:32px 12px 48px;">

      <!-- Email card -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"
        style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;
               overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">

        <!-- ── Header: dark brand background + centred logo ── -->
        <tr>
          <td align="center"
            style="background:#0f172a;padding:32px 40px 28px;">
            <!--
              Logo image: 829×301 PNG from /public/images/Evolve_Pharm.png.
              Displayed at 220px wide with proportional height (≈80px).
              On clients that block images the alt text renders on the dark bg.
            -->
            <img src="${logoUrl()}"
              alt="${APP_NAME}"
              width="220" height="80"
              style="display:block;margin:0 auto;width:220px;height:auto;
                     max-width:220px;border:0;outline:0;text-decoration:none;"
            />
          </td>
        </tr>

        <!-- Accent stripe -->
        <tr>
          <td style="padding:0;height:4px;
                     background:linear-gradient(90deg,#4f46e5 0%,#06b6d4 100%);">
          </td>
        </tr>

        <!-- ── Dynamic content rows ── -->
        ${bodyRows}

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#1e293b;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
              <tr>
                <td align="center">
                  <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">
                    Envolve Pharmaceutical Ltd.
                  </p>
                  <p style="margin:0 0 10px;font-size:12px;color:#64748b;">
                    Lagos, Nigeria &bull;
                    <a href="${siteUrl()}" style="color:#38bdf8;text-decoration:none;">
                      www.envolvepharm.com.ng
                    </a>
                  </p>
                  <p style="margin:0;font-size:11px;color:#475569;">
                    &copy; ${year()} Envolve Pharmaceutical Ltd. All rights reserved.
                  </p>
                  <p style="margin:10px 0 0;font-size:11px;color:#475569;">
                    This is a transactional email sent to you because you have
                    an account with ${APP_NAME}.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Email card -->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// ─── Reusable row blocks ──────────────────────────────────────────────────────

/** Main content row — white background, generous padding */
function contentRow(inner: string): string {
  return `
  <tr>
    <td style="padding:36px 36px 32px;">
      ${inner}
    </td>
  </tr>`;
}

/** Divider row */
function divider(): string {
  return `
  <tr>
    <td style="padding:0 32px;">
      <div style="border-top:1px solid #e2e8f0;"></div>
    </td>
  </tr>`;
}

/** CTA button block */
function ctaButton(label: string, url: string, color = '#4f46e5'): string {
  return `
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:28px 0 8px;">
    <tr>
      <td style="border-radius:10px;background:${color};">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
          href="${url}" style="height:48px;v-text-anchor:middle;width:200px;"
          arcsize="14%" strokecolor="${color}" fillcolor="${color}"><center>
        <![endif]-->
        <a href="${url}"
          style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;
                 color:#ffffff;text-decoration:none;border-radius:10px;
                 letter-spacing:0.01em;font-family:Arial,Helvetica,sans-serif;">
          ${label}
        </a>
        <!--[if mso]></center></v:roundrect><![endif]-->
      </td>
    </tr>
  </table>`;
}

/** OTP display block */
function otpBlock(otp: string): string {
  return `
  <table cellpadding="0" cellspacing="0" border="0" role="presentation"
    style="margin:24px 0;width:100%;">
    <tr>
      <td style="background:#f1f5f9;border:2px solid #e2e8f0;border-radius:12px;
                 padding:24px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;
                   text-transform:uppercase;color:#64748b;">
          Your verification code
        </p>
        <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:16px;
                   color:#4f46e5;font-family:'Courier New',monospace;">
          ${otp}
        </p>
      </td>
    </tr>
  </table>`;
}

/** Status / info box */
function infoBox(content: string, variant: 'info' | 'success' | 'warn' | 'danger' = 'info'): string {
  const map = {
    info:    { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    warn:    { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    danger:  { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
  }[variant];

  return `
  <table cellpadding="0" cellspacing="0" border="0" role="presentation"
    style="margin:20px 0;width:100%;">
    <tr>
      <td style="background:${map.bg};border:1px solid ${map.border};
                 border-radius:10px;padding:14px 16px;">
        <p style="margin:0;font-size:14px;color:${map.text};line-height:1.6;">
          ${content}
        </p>
      </td>
    </tr>
  </table>`;
}

/** Fallback URL display box */
function urlBox(url: string): string {
  return `
  <table cellpadding="0" cellspacing="0" border="0" role="presentation"
    style="margin:12px 0 24px;width:100%;">
    <tr>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                 padding:12px 14px;">
        <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;
                   font-family:'Courier New',monospace;">
          ${url}
        </p>
      </td>
    </tr>
  </table>`;
}

/** Standard greeting + body text */
function body(greeting: string, paragraphs: string[]): string {
  const ps = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">${p}</p>`,
    )
    .join('\n');

  return `
  <h3 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#0f172a;
              line-height:1.3;">
    ${greeting}
  </h3>
  ${ps}`;
}

/** Sign-off block */
function signOff(): string {
  return `
  <p style="margin:28px 0 0;font-size:15px;color:#334155;line-height:1.7;">
    Warm regards,<br />
    <strong style="color:#0f172a;">The ${APP_NAME} Team</strong>
  </p>`;
}

// ─── 1. Customer OTP verification ─────────────────────────────────────────────

/**
 * Sent during customer registration (Step 2 → 3).
 * Subject clearly states it's a time-sensitive code — helps with deliverability.
 */
export async function sendOtpEmail(params: {
  to:    string;
  name:  string;
  otp:   string;
  type:  'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
}): Promise<void> {
  const isReset = params.type === 'PASSWORD_RESET';

  const subject = isReset
    ? `Reset your ${APP_NAME} password — code: ${params.otp}`
    : `Your ${APP_NAME} verification code: ${params.otp}`;

  const preheader = isReset
    ? `Use code ${params.otp} to reset your password. Expires in 10 minutes.`
    : `Use code ${params.otp} to verify your email. Expires in 10 minutes.`;

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Hi ${params.name},`, [
        isReset
          ? 'You requested a password reset for your EnvolveCare account. Use the code below to continue:'
          : 'Welcome to EnvolveCare Express! To complete your registration, please verify your email address with the code below:',
      ])}
      ${otpBlock(params.otp)}
      ${infoBox(
        `⏱&nbsp; This code expires in <strong>10 minutes</strong>. Do not share it with anyone — our team will never ask for it.`,
        'warn',
      )}
      <p style="margin:0;font-size:13px;color:#94a3b8;">
        If you didn't request this, you can safely ignore this email.
      </p>
      ${signOff()}
    `),
  );

  const text = `Hi ${params.name},

${isReset
  ? 'Use the code below to reset your password:'
  : 'Use the code below to verify your email:'}

Code: ${params.otp}

This code expires in 10 minutes. Do not share it with anyone.

If you didn't request this, you can safely ignore this email.

— The ${APP_NAME} Team`;

  await sendMail({ to: params.to, subject, html, text });
}

// ─── 2. PCN certificate under review ─────────────────────────────────────────

/**
 * Sent after customer creates their password (status → PENDING_REVIEW).
 * Reassures the customer their submission was received and sets expectations.
 */
export async function sendPcnUnderReviewEmail(params: {
  to:   string;
  name: string;
}): Promise<void> {
  const subject   = 'Your account is under compliance review';
  const preheader = 'Thank you for submitting your PCN certificate — our team will review it within 24–48 hours.';

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Hi ${params.name},`, [
        `Thank you for completing your registration with <strong>${APP_NAME}</strong>.`,
        'Your password has been set and your PCN certificate has been submitted to our compliance team for review.',
      ])}
      ${infoBox(
        `<strong>Current status: Pending Approval</strong><br />
         As part of our regulatory requirements, our team verifies every PCN certificate
         before granting platform access. This typically takes <strong>24–48 hours</strong>.`,
        'info',
      )}
      ${body('', [
        'Once the review is complete, you will receive another email confirming whether your account has been approved or if additional information is required.',
        'We appreciate your patience and look forward to having you on the platform.',
      ])}
      ${signOff()}
    `),
  );

  const text = `Hi ${params.name},

Thank you for completing your registration with ${APP_NAME}.

Your PCN certificate has been submitted to our compliance team for review.
Current status: Pending Approval.

This typically takes 24–48 hours. You will receive an email once the review is complete.

— The ${APP_NAME} Team`;

  await sendMail({ to: params.to, subject, html, text });
}

// ─── 3. Customer account approved ────────────────────────────────────────────

/**
 * Sent when an admin approves a customer's PCN review.
 */
export async function sendCustomerApprovalEmail(params: {
  to:   string;
  name: string;
}): Promise<void> {
  const loginUrl  = `${siteUrl()}/sign-in`;
  const subject   = `Your ${APP_NAME} account has been approved`;
  const preheader = 'Great news — your PCN certificate has been verified. Your account is now active.';

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Hello ${params.name},`, [
        '🎉&nbsp; <strong>Great news!</strong>',
        `Your PCN certificate has been reviewed and approved by our compliance team.
         Your account is now fully active — you can log in and begin placing orders.`,
        'Thank you for completing the verification process.',
      ])}
      ${infoBox(`<strong>Status: Approved ✓</strong><br />You now have full access to the ${APP_NAME} platform.`, 'success')}
      ${ctaButton('Sign in to your account', loginUrl)}
      <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
        Button not working? Copy and paste this link:<br />
        <a href="${loginUrl}" style="color:#4f46e5;">${loginUrl}</a>
      </p>
      ${signOff()}
    `),
  );

  const text = `Hello ${params.name},

Great news! Your PCN certificate has been approved by our compliance team.

Your account is now fully active. Sign in here:
${loginUrl}

— The ${APP_NAME} Team`;

  await sendMail({ to: params.to, subject, html, text });
}

// ─── 4. Customer account rejected ────────────────────────────────────────────

/**
 * Sent when an admin rejects a customer's PCN review.
 * @param reviewNote — the reason for rejection (from admin)
 */
export async function sendCustomerRejectionEmail(params: {
  to:         string;
  name:       string;
  reviewNote: string;
}): Promise<void> {
  const subject   = `Action required — your ${APP_NAME} account review`;
  const preheader = 'We could not approve your account at this time. See the reason and next steps below.';

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Hello ${params.name},`, [
        `We have completed the review of your submitted PCN certificate for your <strong>${APP_NAME}</strong> account.`,
        'Unfortunately, we were unable to approve your account at this time.',
      ])}
      ${infoBox(
        `<strong>Reason for rejection:</strong><br />${params.reviewNote}`,
        'danger',
      )}
      ${body('', [
        'You may resubmit a valid PCN certificate or contact our support team if you believe this decision was made in error.',
      ])}
      ${ctaButton('Contact support', `mailto:support@envolvepharm.com.ng`, '#64748b')}
      ${signOff()}
    `),
  );

  const text = `Hello ${params.name},

We have reviewed your PCN certificate for your ${APP_NAME} account.

Unfortunately, we could not approve your account at this time.

Reason: ${params.reviewNote}

Please resubmit a valid PCN certificate or contact support if you believe this is an error.
Email: support@envolvepharm.com.ng

— The ${APP_NAME} Team`;

  await sendMail({ to: params.to, subject, html, text });
}

// ─── 5. Customer invitation (admin-initiated onboarding) ─────────────────────

/**
 * Sent when an admin creates a customer record and invites them to complete
 * registration. The email contains the 6-digit OTP + a deep link to the
 * /sign-up/invited page. The OTP is valid for 48 hours (set at creation time).
 */
export async function sendCustomerInvitationEmail(params: {
  to:           string;
  name:         string;
  otp:          string;
  companyName:  string;
  inviteUrl:    string;
}): Promise<void> {
  const subject   = `You've been invited to ${APP_NAME} — complete your registration`;
  const preheader = `Hi ${params.name}, your pharmacy account is ready. Upload your PCN certificate and set a password to get started.`;

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Welcome, ${params.name}!`, [
        `An administrator has created an account for <strong>${params.companyName}</strong> on <strong>${APP_NAME}</strong> — Nigeria's pharmaceutical ordering platform.`,
        'To complete your registration, you need to upload your PCN certificate and set a password. Click the button below to get started.',
      ])}
      ${ctaButton('Complete your registration', params.inviteUrl, '#0d9488')}
      <p style="margin:24px 0 8px;font-size:14px;color:#475569;font-weight:600;">
        If the button doesn't work, copy and paste this link:
      </p>
      ${urlBox(params.inviteUrl)}
      ${divider()}
      ${body('Your verification code', [
        'You\'ll need this code when prompted during setup:',
      ])}
      ${otpBlock(params.otp)}
      ${infoBox(
        '⏱&nbsp; This code is valid for <strong>48 hours</strong>. You can request a new code from the registration page if it expires.',
        'warn',
      )}
      <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">
        Not expecting this email? It may have been sent in error — you can safely ignore it.
      </p>
      ${signOff()}
    `),
  );

  const text = `Welcome, ${params.name}!

An administrator has created an account for ${params.companyName} on ${APP_NAME}.

To complete your registration, visit:
${params.inviteUrl}

Your verification code: ${params.otp}
(valid for 48 hours)

If you did not expect this email, you can safely ignore it.

— The ${APP_NAME} Team`;

  await sendMail({ to: params.to, subject, html, text });
}

// ─── 6. Staff email verification (invitation link) ──────────────────────────

/**
 * Sent when an admin creates a new staff/driver account.
 * The link expires in 24 hours (per backend engineer spec).
 * Staff click the link → set their password → account activated.
 */
export async function sendStaffVerificationEmail(params: {
  to:              string;
  name:            string;
  verificationUrl: string;
}): Promise<void> {
  const subject   = `You've been invited to ${APP_NAME} — verify your email`;
  const preheader = `${params.name}, you've been added to the team. Click to verify your email and set your password.`;

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Dear ${params.name},`, [
        `You have been added to the <strong>${APP_NAME}</strong> team by an administrator.`,
        'To activate your account and set your password, please verify your email address by clicking the button below.',
      ])}
      ${ctaButton('Verify email and set password', params.verificationUrl)}
      <p style="margin:24px 0 8px;font-size:14px;color:#475569;font-weight:600;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      ${urlBox(params.verificationUrl)}
      ${infoBox(
        '⏱&nbsp; This link expires in <strong>24 hours</strong>. If you did not expect this email, please contact your administrator.',
        'warn',
      )}
      ${signOff()}
    `),
  );

  const text = `Dear ${params.name},

You have been added to the ${APP_NAME} team. To activate your account and set your password, verify your email here:

${params.verificationUrl}

This link expires in 24 hours.

If you did not expect this email, please contact your administrator.

— The ${APP_NAME} Team`;

  await sendMail({ to: params.to, subject, html, text });
}

// ─── 7. Staff account activation (after password set) ────────────────────────

/**
 * Sent after staff verifies their email and sets their password.
 * Confirms the account is active and provides the sign-in link.
 */
export async function sendStaffActivationEmail(params: {
  to:   string;
  name: string;
}): Promise<void> {
  const loginUrl  = `${siteUrl()}/staff/sign-in`;
  const subject   = `Your ${APP_NAME} staff account is now active`;
  const preheader = `Congratulations ${params.name} — your account has been activated. You can now sign in.`;

  const html = shell(
    preheader,
    contentRow(`
      ${body(`Dear ${params.name},`, [
        'Congratulations! 🎉',
        `Your <strong>${APP_NAME}</strong> staff account has been successfully activated.
         You can now log in and begin using the platform.`,
        'We are excited to have you on board.',
      ])}
      ${infoBox(`<strong>Status: Active ✓</strong><br />Your account is ready to use.`, 'success')}
      ${ctaButton('Sign in to your account', loginUrl)}
      ${signOff()}
    `),
  );

  const text = `Dear ${params.name},

Congratulations! Your ${APP_NAME} staff account has been activated.

Sign in here: ${loginUrl}

We're excited to have you on board.

Best regards,
Envolve Support`;

  await sendMail({ to: params.to, subject, html, text });
}
