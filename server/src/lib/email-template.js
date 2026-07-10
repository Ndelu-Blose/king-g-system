/**
 * King G transactional email layout — table-based, inline styles, client-safe.
 * Shared by the API (Resend) and Supabase Auth email hook.
 */

const BRAND = {
  name: "King G",
  tagline: "Lifestyle Lounge",
  gold: "#B8956E",
  goldDark: "#9A7B4F",
  ink: "#141414",
  body: "#3D3D3D",
  muted: "#6B7280",
  canvas: "#F5F3EF",
  card: "#FFFFFF",
  border: "#E8E4DC",
  footer: "#8A8175",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bulletproofButton(label, url) {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
      <tr>
        <td align="center" style="border-radius:10px;background:${BRAND.gold};">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:15px 36px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.3px;border-radius:10px;background:${BRAND.gold};border:1px solid ${BRAND.goldDark};">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.body};">${text}</p>`;
}

function callout(html) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px 18px;background:${BRAND.canvas};border-left:3px solid ${BRAND.gold};border-radius:0 8px 8px 0;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${BRAND.body};">${html}</p>
        </td>
      </tr>
    </table>`;
}

/**
 * @param {object} options
 * @param {string} options.previewText
 * @param {string} options.headline
 * @param {string} [options.greetingName]
 * @param {string[]} [options.paragraphs] HTML strings (already escaped where needed)
 * @param {string} [options.calloutHtml]
 * @param {string} options.ctaLabel
 * @param {string} options.ctaUrl
 * @param {string} [options.securityNote]
 * @param {string} [options.appUrl]
 */
export function renderKingGEmail({
  previewText,
  headline,
  greetingName,
  paragraphs = [],
  calloutHtml,
  ctaLabel,
  ctaUrl,
  securityNote = "If you did not request this email, you can safely ignore it. Your account will remain unchanged.",
  appUrl = "https://king-g-system.vercel.app",
}) {
  const safeHeadline = escapeHtml(headline);
  const safePreview = escapeHtml(previewText);
  const safeAppUrl = escapeHtml(appUrl);
  const greeting = greetingName
    ? paragraph(`Dear <strong style="color:${BRAND.ink};">${escapeHtml(greetingName)}</strong>,`)
    : "";
  const bodyCopy = paragraphs.map((p) => paragraph(p)).join("");
  const calloutBlock = calloutHtml ? callout(calloutHtml) : "";
  const button = ctaLabel && ctaUrl ? bulletproofButton(ctaLabel, ctaUrl) : "";
  const fallbackLink = ctaUrl
    ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted};">
         If the button does not work, copy and paste this link into your browser:<br>
         <a href="${escapeHtml(ctaUrl)}" style="color:${BRAND.goldDark};word-break:break-all;">${escapeHtml(ctaUrl)}</a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeHeadline}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${safePreview}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.canvas};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND.ink};border-radius:12px 12px 0 0;padding:28px 32px 24px;border-bottom:3px solid ${BRAND.gold};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:3px;color:#FFFFFF;">
                      ${BRAND.name.toUpperCase()}
                    </p>
                    <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">
                      ${BRAND.tagline}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:${BRAND.card};padding:36px 32px 28px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
              <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;line-height:1.3;color:${BRAND.ink};">
                ${safeHeadline}
              </h1>
              ${greeting}
              ${bodyCopy}
              ${calloutBlock}
              ${button}
              ${fallbackLink}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="padding-top:20px;border-top:1px solid ${BRAND.border};">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted};">
                      ${escapeHtml(securityNote)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:${BRAND.card};border-radius:0 0 12px 12px;padding:20px 32px 28px;border:1px solid ${BRAND.border};border-top:none;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.footer};text-align:center;">
                <strong style="color:${BRAND.ink};">${BRAND.name}</strong> &middot; ${BRAND.tagline}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:${BRAND.footer};text-align:center;">
                <a href="${safeAppUrl}" style="color:${BRAND.goldDark};text-decoration:none;">${safeAppUrl.replace(/^https?:\/\//, "")}</a>
              </p>
              <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.5;color:#A8A29E;text-align:center;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWelcomeEmail({ name, role, link, appUrl }) {
  const roleLabel = escapeHtml(String(role || "staff").replace(/_/g, " "));
  return renderKingGEmail({
    previewText: "Your King G account is ready — set your password to get started.",
    headline: "Welcome to the team",
    greetingName: name,
    paragraphs: [
      `Your staff account for <strong style="color:${BRAND.ink};">King G Operations</strong> has been created. You now have access to the business management platform used across the lounge.`,
      "For your security, please set a personal password before your first sign-in. This link is valid for a limited time and can only be used once.",
    ],
    calloutHtml: `<strong style="color:${BRAND.ink};">Assigned role:</strong> ${roleLabel}`,
    ctaLabel: "Set your password",
    ctaUrl: link,
    securityNote:
      "If you were not expecting this invitation, please contact your manager or a system owner. Do not share this link with anyone.",
    appUrl,
  });
}

export function buildPasswordResetEmail({ name, link, appUrl }) {
  return renderKingGEmail({
    previewText: "Reset your King G password securely.",
    headline: "Password reset request",
    greetingName: name,
    paragraphs: [
      "We received a request to reset the password for your King G account.",
      "Select the button below to choose a new password. If you did not make this request, no action is required.",
    ],
    ctaLabel: "Reset password",
    ctaUrl: link,
    appUrl,
  });
}

export function buildPasswordChangedEmail({ name, link, appUrl }) {
  return renderKingGEmail({
    previewText: "Your King G password was changed by an administrator.",
    headline: "Your password was updated",
    greetingName: name,
    paragraphs: [
      "An administrator has changed the password on your King G account.",
      "If you authorised this change, you can sign in with your new credentials. If this was unexpected, reset your password immediately using the button below and notify an owner.",
    ],
    ctaLabel: "Secure my account",
    ctaUrl: link,
    securityNote:
      "Treat unexpected password changes as urgent. Contact a system owner if you believe your account may be compromised.",
    appUrl,
  });
}

/** Standard subjects for all King G transactional emails. */
export const KING_G_EMAIL_SUBJECTS = {
  welcome: "Welcome to King G — set your password",
  recovery: "Reset your King G password",
  passwordChanged: "Your King G password was changed",
  password_changed_notification: "Your King G password was changed",
  signup: "Confirm your King G account",
  invite: "You have been invited to King G",
  magiclink: "Your King G sign-in link",
  email_change: "Confirm your new email address",
  email_change_new: "Verify your new King G email",
  reauthentication: "Your King G verification code",
  default: "King G account notification",
};

/** Supabase Auth hook — maps action types to branded templates. */
export function buildAuthActionEmail({ action, confirmationUrl, token, appUrl }) {
  const common = { ctaUrl: confirmationUrl, appUrl };

  switch (action) {
    case "recovery":
      return renderKingGEmail({
        ...common,
        previewText: "Reset your King G password securely.",
        headline: "Password reset request",
        paragraphs: [
          "We received a request to reset the password for your King G account.",
          "Select the button below to choose a new password. If you did not make this request, you can ignore this email.",
        ],
        ctaLabel: "Reset password",
      });
    case "signup":
      return renderKingGEmail({
        ...common,
        previewText: "Confirm your email to complete your King G account setup.",
        headline: "Confirm your email",
        paragraphs: [
          "Thank you for registering with King G. Please confirm your email address to activate your account and access the operations platform.",
        ],
        ctaLabel: "Confirm email",
      });
    case "invite":
      return renderKingGEmail({
        ...common,
        previewText: "You have been invited to join King G.",
        headline: "You are invited",
        paragraphs: [
          "You have been invited to join the King G team on our business operations platform.",
          "Accept the invitation below to complete your account setup and set your password.",
        ],
        ctaLabel: "Accept invitation",
      });
    case "magiclink":
      return renderKingGEmail({
        ...common,
        previewText: "Your secure one-time sign-in link for King G.",
        headline: "Sign in to King G",
        paragraphs: [
          "Use the button below to sign in to your King G account. This link is single-use and expires shortly for your security.",
        ],
        ctaLabel: "Sign in securely",
      });
    case "email_change":
      return renderKingGEmail({
        ...common,
        previewText: "Confirm the email change on your King G account.",
        headline: "Confirm email change",
        paragraphs: [
          "A request was made to update the email address associated with your King G account.",
          "Please confirm this change using the button below. If you did not request this, contact a system owner immediately.",
        ],
        ctaLabel: "Confirm new email",
        securityNote:
          "Unauthorised email changes may indicate account compromise. Act promptly if this was not you.",
      });
    case "email_change_new":
      return renderKingGEmail({
        ...common,
        previewText: "Verify your new email address for King G.",
        headline: "Verify your new email",
        paragraphs: [
          "This email address was added to a King G account.",
          "Please confirm that you own this inbox to complete the email update.",
        ],
        ctaLabel: "Verify email address",
      });
    case "reauthentication":
      return renderKingGEmail({
        previewText: "Your King G verification code.",
        headline: "Verification required",
        paragraphs: [
          "Enter the verification code below to continue with your requested action on King G.",
        ],
        calloutHtml: `<span style="font-family:monospace;font-size:22px;letter-spacing:4px;color:${BRAND.ink};">${escapeHtml(token)}</span>`,
        ctaLabel: "",
        ctaUrl: "",
        securityNote: "Never share this code with anyone. King G staff will never ask for it.",
        appUrl,
      });
    case "password_changed_notification":
      return renderKingGEmail({
        ...common,
        previewText: "Your King G password was changed.",
        headline: "Your password was updated",
        paragraphs: [
          "The password on your King G account was changed.",
          "If you authorised this change, you can sign in with your new credentials. If this was unexpected, reset your password immediately and notify an owner.",
        ],
        ctaLabel: "Sign in to King G",
        securityNote:
          "Treat unexpected password changes as urgent. Contact a system owner if you believe your account may be compromised.",
      });
    default:
      return renderKingGEmail({
        ...common,
        previewText: "Action required on your King G account.",
        headline: "Account notification",
        paragraphs: [
          "An update is required on your King G account.",
          "Please complete the requested action using the button below.",
        ],
        ctaLabel: "Continue to King G",
      });
  }
}

export function buildAuthActionPlainText({ action, confirmationUrl, token, appUrl }) {
  const headline =
    action === "recovery"
      ? "Password reset request"
      : action === "signup"
        ? "Confirm your email"
        : action === "invite"
          ? "You are invited"
          : action === "magiclink"
            ? "Sign in to King G"
            : action === "email_change"
              ? "Confirm email change"
              : action === "email_change_new"
                ? "Verify your new email"
                : action === "reauthentication"
                  ? "Verification required"
                  : action === "password_changed_notification"
                    ? "Your password was updated"
                  : "Account notification";

  const paragraphsByAction = {
    recovery: [
      "We received a request to reset the password for your King G account.",
      "Use the link below to choose a new password.",
    ],
    signup: ["Please confirm your email address to activate your King G account."],
    invite: ["You have been invited to join King G. Use the link below to complete setup."],
    magiclink: ["Use this one-time link to sign in to your King G account."],
    email_change: ["Confirm the email change on your King G account using the link below."],
    email_change_new: ["Verify this email address to complete your King G account update."],
    reauthentication: [`Your verification code is: ${token || ""}`],
    password_changed_notification: [
      "The password on your King G account was changed.",
      "If this was unexpected, reset your password and notify an owner.",
    ],
  };

  const ctaByAction = {
    recovery: "Reset password",
    signup: "Confirm email",
    invite: "Accept invitation",
    magiclink: "Sign in securely",
    email_change: "Confirm new email",
    email_change_new: "Verify email address",
    password_changed_notification: "Sign in to King G",
  };

  return renderPlainText({
    headline,
    paragraphs: paragraphsByAction[action] || ["Please complete the requested action using the link below."],
    ctaLabel: ctaByAction[action] || "Continue to King G",
    ctaUrl: action === "reauthentication" ? "" : confirmationUrl,
    appUrl,
  });
}

export function getAuthEmailSubject(action) {
  return KING_G_EMAIL_SUBJECTS[action] || KING_G_EMAIL_SUBJECTS.default;
}

export function renderPlainText({ headline, greetingName, paragraphs = [], ctaLabel, ctaUrl, securityNote, appUrl }) {
  const lines = [
    "KING G — Lifestyle Lounge",
    "",
    headline,
    "",
  ];
  if (greetingName) lines.push(`Dear ${greetingName},`, "");
  lines.push(...paragraphs.map((p) => p.replace(/<[^>]+>/g, "")), "");
  if (ctaLabel && ctaUrl) {
    lines.push(`${ctaLabel}: ${ctaUrl}`, "");
  }
  if (securityNote) lines.push(securityNote, "");
  lines.push(`— ${BRAND.name}`, appUrl || "");
  return lines.join("\n");
}
