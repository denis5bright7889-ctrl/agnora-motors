import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  _resend ??= new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Agnora Motors <support@agnora-motors.com>";

export async function sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY is not set — cannot send verification email");
    throw new Error("Email service is not configured");
  }

  // The one-time code is a credential for the lifetime of its window. It is
  // never logged: on a hosted platform these lines are retained, searchable
  // and readable by anyone with log access, which turns "attacker needs the
  // user's inbox" into "attacker needs the dashboard". Operational tracing
  // keeps the recipient and the provider's message id, which is enough to
  // follow a delivery without carrying the secret.
  console.log("[email] sending verification code to=%s", to);

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Your Agnora verification code",
    html: buildOtpEmail(name, code),
  });

  if (error) {
    console.error("[email] Resend error to=%s error=%s", to, JSON.stringify(error));
    throw new Error(`Email delivery failed: ${(error as { message?: string }).message ?? JSON.stringify(error)}`);
  }

  console.log("[email] Email sent successfully id=%s to=%s", data?.id, to);
}

function buildOtpEmail(name: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f2f2f3;padding:48px 16px 64px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;background-color:#ffffff;border-radius:12px;
                      border:1px solid #e4e4e7;overflow:hidden;">

          <!-- ── Header ───────────────────────────────────────────── -->
          <tr>
            <td style="padding:28px 40px 24px;border-bottom:1px solid #f0f0f0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:10px;height:10px;background-color:#FF4D2E;
                             border-radius:50%;vertical-align:middle;"></td>
                  <td style="padding-left:8px;font-size:17px;font-weight:700;
                             color:#111111;letter-spacing:-0.3px;vertical-align:middle;">
                    Agnora<span style="color:#FF4D2E;">.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ────────────────────────────────────────────── -->
          <tr>
            <td style="padding:36px 40px 32px;">

              <!-- Title -->
              <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;
                         color:#111111;letter-spacing:-0.4px;line-height:1.2;">
                Verification code
              </h1>

              <!-- Intro -->
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#555555;">
                Hi ${name.trim() || "there"}, confirm it&rsquo;s you.<br/>
                Enter the code below to verify your email and continue
                signing in to Agnora Motors.
              </p>

              <!-- OTP block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:12px;">
                <tr>
                  <td align="center"
                      style="background-color:#f7f7f8;border:1px solid #e4e4e7;
                             border-radius:10px;padding:28px 16px;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:14px;
                                 color:#111111;font-variant-numeric:tabular-nums;
                                 display:inline-block;padding-left:14px;">
                      ${code}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Expiry -->
              <p style="margin:0 0 28px;font-size:13px;color:#999999;text-align:center;">
                Expires in <strong style="color:#555555;">15 minutes</strong>
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid #f0f0f0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <!-- Security note -->
              <p style="margin:0 0 14px;font-size:13px;line-height:1.65;color:#888888;">
                <strong style="color:#444444;">For your security</strong>, never share this code
                with anyone &mdash; not even Agnora Motors staff. We will never ask you for it.
              </p>

              <!-- Ignore note -->
              <p style="margin:0 0 14px;font-size:13px;line-height:1.65;color:#888888;">
                If you didn&rsquo;t request this code, you can safely ignore this email.
              </p>

              <!-- Support -->
              <p style="margin:0;font-size:13px;line-height:1.65;color:#888888;">
                Need help? Contact us at
                <a href="mailto:support@agnora-motors.com"
                   style="color:#FF4D2E;text-decoration:none;font-weight:500;">
                  support@agnora-motors.com
                </a>
              </p>

            </td>
          </tr>

          <!-- ── Footer ───────────────────────────────────────────── -->
          <tr>
            <td style="padding:20px 40px;background-color:#fafafa;
                       border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.5;">
                Agnora Motors &nbsp;&middot;&nbsp; Nairobi, Kenya &nbsp;&nbsp;&copy; 2026
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
}

/**
 * Admin → seller message about one specific listing. Sent server-side only:
 * RESEND_API_KEY never reaches the browser. `replyTo` is the admin's own
 * address so the seller's reply reaches a person, not the support alias.
 */
export async function sendSellerContactEmail(opts: {
  to: string;
  sellerName: string | null;
  subject: string;
  message: string;
  replyTo?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY is not set — cannot contact seller");
    throw new Error("Email service is not configured");
  }

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    replyTo: opts.replyTo,
    html: buildSellerContactEmail(opts.sellerName, opts.message),
  });

  if (error) {
    console.error("[email] Resend error to=%s error=%s", opts.to, JSON.stringify(error));
    throw new Error(`Email delivery failed: ${(error as { message?: string }).message ?? "unknown"}`);
  }
  console.log("[email] Seller contact sent id=%s to=%s", data?.id, opts.to);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildSellerContactEmail(name: string | null, message: string): string {
  // The admin writes plain text; escape it and preserve their line breaks so a
  // message can never inject markup into the email body.
  const body = escapeHtml(message).replace(/\n/g, "<br />");
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hello,";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f2f2f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f3;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;padding:32px;">
        <tr><td style="font-size:20px;font-weight:600;color:#111;padding-bottom:20px;">Agnora Motors</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#333;">
          <p style="margin:0 0 16px;">${greeting}</p>
          <p style="margin:0 0 16px;">${body}</p>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #eee;font-size:12px;color:#888;">
          This message was sent by the Agnora Motors team about one of your listings.
          Reply to this email to reach us directly.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
