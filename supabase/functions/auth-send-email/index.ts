import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const hookSecret = hookSecretRaw.replace(/^v1,whsec_/, "");
const fromAddress =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
const fromName = Deno.env.get("RESEND_FROM_NAME") ?? "King G";
const projectRef = "tpydiklyduxjkvenfvzd";

const subjects: Record<string, string> = {
  signup: "Confirm your King G account",
  recovery: "Reset your King G password",
  invite: "You have been invited to King G",
  magiclink: "Your King G sign-in link",
  email_change: "Confirm your new email address",
  email_change_new: "Confirm your new email address",
  reauthentication: "Your King G verification code",
};

function confirmationUrl(emailData: {
  token_hash: string;
  email_action_type: string;
  redirect_to: string;
}) {
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to,
  });
  return `https://${projectRef}.supabase.co/auth/v1/verify?${params.toString()}`;
}

function buildHtml(
  action: string,
  confirmationUrlValue: string,
  token: string,
) {
  const linkBlock = `<p><a href="${confirmationUrlValue}" style="color:#b8860b;font-weight:600">Open King G</a></p>`;
  switch (action) {
    case "recovery":
      return `<h2>Reset your password</h2><p>We received a request to reset your King G password.</p>${linkBlock}<p>If you did not request this, you can ignore this email.</p>`;
    case "signup":
      return `<h2>Confirm your email</h2><p>Finish setting up your King G account using the link below.</p>${linkBlock}`;
    case "invite":
      return `<h2>You are invited</h2><p>You have been invited to join King G.</p>${linkBlock}`;
    case "magiclink":
      return `<h2>Sign in to King G</h2><p>Use this one-time link to sign in.</p>${linkBlock}`;
    case "reauthentication":
      return `<h2>Verification code</h2><p>Your code is <strong>${token}</strong></p>`;
    default:
      return `<h2>King G</h2><p>Please confirm using the link below.</p>${linkBlock}`;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!resend || !hookSecret) {
    return Response.json(
      { error: { message: "Email hook is not configured." } },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const action = email_data.email_action_type;
    const subject = subjects[action] ?? "King G notification";
    const url = confirmationUrl(email_data);
    const html = buildHtml(action, url, email_data.token);

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [user.email],
      subject,
      html,
    });

    if (error) throw error;
    return Response.json({});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("auth-send-email:", message);
    return Response.json(
      { error: { message } },
      { status: 401 },
    );
  }
});
