import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { Resend } from "resend";

const ADMIN_EMAIL = process.env.ALERT_EMAIL || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, stack, page, userAgent, userId, componentStack } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // 1. Log to DB (reuse BugReport table)
    const report = await prisma.bugReport.create({
      data: {
        userId: userId ?? null,
        email: null,
        message: `[AUTO] ${message}${stack ? `\n\nStack:\n${stack}` : ""}${componentStack ? `\n\nComponent:\n${componentStack}` : ""}`,
        page: page ?? null,
        userAgent: userAgent ?? null,
      },
    });

    // 2. Send email notification via Resend
    const resendKey = process.env.AUTH_RESEND_KEY;
    if (resendKey && ADMIN_EMAIL) {
      const resend = new Resend(resendKey);
      const truncatedStack = stack ? stack.slice(0, 1500) : "N/A";
      const truncatedComponent = componentStack ? componentStack.slice(0, 500) : "";

      await resend.emails.send({
        from: "Projection Finance <noreply@projection.finance>",
        to: ADMIN_EMAIL,
        subject: `[Runtime Error] ${message.slice(0, 80)}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:monospace;font-size:13px;line-height:1.5;color:#303549;max-width:640px;margin:0 auto;padding:20px;">
<h2 style="color:#e53e3e;font-size:16px;">Runtime Error</h2>
<p><strong>Page:</strong> ${page ?? "unknown"}</p>
<p><strong>User:</strong> ${userId ?? "anonymous"}</p>
<p><strong>Time:</strong> ${new Date().toISOString()}</p>
<p><strong>Report ID:</strong> ${report.id}</p>
<hr style="border:none;border-top:1px solid #e2e8f0;">
<p><strong>Message:</strong></p>
<pre style="background:#f7fafc;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;">${message}</pre>
<p><strong>Stack:</strong></p>
<pre style="background:#f7fafc;padding:12px;border-radius:6px;overflow-x:auto;font-size:11px;max-height:400px;overflow-y:auto;">${truncatedStack}</pre>
${truncatedComponent ? `<p><strong>Component Stack:</strong></p><pre style="background:#f7fafc;padding:12px;border-radius:6px;overflow-x:auto;font-size:11px;">${truncatedComponent}</pre>` : ""}
<p><strong>User Agent:</strong></p>
<pre style="background:#f7fafc;padding:8px;border-radius:6px;font-size:10px;word-break:break-all;">${userAgent ?? "N/A"}</pre>
</body></html>`,
      }).catch((err) => {
        console.error("Failed to send error email:", err);
      });
    }

    return NextResponse.json({ ok: true, id: report.id });
  } catch (err) {
    console.error("Error report API failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
