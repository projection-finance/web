import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.AUTH_RESEND_KEY);
  return _resend;
}

const FROM = "Projection Finance <noreply@projection.finance>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://projection.finance";
const ALERT_EMAIL = process.env.ALERT_EMAIL || "";

// ─── Minimal HTML wrapper ───

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#303549;max-width:480px;margin:0 auto;padding:40px 20px;">
${body}
<p style="margin-top:32px;font-size:12px;color:#999;">— Projection Finance<br>${APP_URL}</p>
</body></html>`;
}

function cta(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin:16px 0;padding:10px 20px;background:#303549;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${label}</a>`;
}

// ─── Templates ───

export async function sendWelcomeEmail(email: string, name?: string | null) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to Projection Finance",
    html: wrap(`
      <p>${greeting}</p>
      <p>Your account is ready. You can start simulating Aave positions right away — no setup needed.</p>
      <p>Projection Finance is fully open-source and free: unlimited actions, 365-day projections, scenario modes, cloud saves and every feature, with no limits.</p>
      ${cta("Open the app", APP_URL)}
      <p>If you have any questions, reply to this email.</p>
    `),
  });
}

export async function sendAISummaryErrorEmail(errorMessage: string, code?: string) {
  if (!ALERT_EMAIL) return;
  await getResend().emails.send({
    from: FROM,
    to: ALERT_EMAIL,
    subject: `AI Summary Error${code ? ` [${code}]` : ""}`,
    html: wrap(`
      <p>An error occurred while generating an AI summary on Projection Finance.</p>
      <p><strong>Error:</strong> ${errorMessage}</p>
      ${code ? `<p><strong>Code:</strong> ${code}</p>` : ""}
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p>Check the OpenRouter API key or account status.</p>
    `),
  });
}
