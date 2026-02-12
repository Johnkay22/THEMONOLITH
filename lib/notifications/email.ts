import "server-only";

import { Resend } from "resend";
import { env } from "@/lib/env";

type SendMonolithEmailInput = {
  to: string;
  subject: string;
  text: string;
};

let resendClient: Resend | null | undefined;

function getResendClient() {
  if (resendClient !== undefined) {
    return resendClient;
  }

  if (!env.RESEND_API_KEY) {
    resendClient = null;
    return resendClient;
  }

  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export async function sendMonolithEmail(input: SendMonolithEmailInput) {
  const client = getResendClient();
  if (!client || !env.RESEND_FROM_EMAIL) {
    console.error("[notifications/email] missing resend configuration", {
      hasApiKey: Boolean(env.RESEND_API_KEY),
      hasFromEmail: Boolean(env.RESEND_FROM_EMAIL),
    });
    return;
  }

  await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
