import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";
import {
  buildAuthActionEmail,
  buildAuthActionPlainText,
  getAuthEmailSubject,
} from "../_shared/email-template.js";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const hookSecret = hookSecretRaw.replace(/^v1,whsec_/, "");
const fromAddress =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
const fromName = Deno.env.get("RESEND_FROM_NAME") ?? "King G";
const appUrl = (Deno.env.get("APP_URL") ?? "https://king-g-system.vercel.app").replace(
  /\/$/,
  "",
);
const projectRef = "tpydiklyduxjkvenfvzd";

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
    const subject = getAuthEmailSubject(action);
    const url = confirmationUrl(email_data);
    const html = buildAuthActionEmail({
      action,
      confirmationUrl: url,
      token: email_data.token,
      appUrl,
    });
    const text = buildAuthActionPlainText({
      action,
      confirmationUrl: url,
      token: email_data.token,
      appUrl,
    });

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [user.email],
      subject,
      html,
      text,
    });

    if (error) throw error;
    return Response.json({});
  } catch (error) {
    console.error("auth-send-email:", error);
    return Response.json(
      { error: { message: "Failed to send email. Please try again or contact support." } },
      { status: 500 },
    );
  }
});
