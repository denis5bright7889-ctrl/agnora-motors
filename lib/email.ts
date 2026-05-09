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

  console.log("[email] sending verification to=%s", to);

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Your Agnora verification code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff">
        <div style="margin-bottom:24px">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:18px;font-weight:600">
            <span style="width:10px;height:10px;border-radius:50%;background:#FF4D2E;display:inline-block"></span>
            Agnora<span style="color:#FF4D2E">.</span>
          </span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:600">Verify your email</h2>
        <p style="color:#666;margin-bottom:4px">Hi ${name},</p>
        <p style="color:#666;margin-bottom:20px">Use the code below to verify your Agnora account:</p>
        <div style="font-size:38px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px;background:#f7f7f7;border-radius:12px;margin-bottom:20px;color:#111">
          ${code}
        </div>
        <p style="color:#888;font-size:13px;margin-bottom:8px">This code expires in <strong>30 minutes</strong>.</p>
        <p style="color:#aaa;font-size:12px">If you didn't create an Agnora account, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Resend error to=%s error=%s", to, JSON.stringify(error));
    throw new Error(`Email delivery failed: ${(error as { message?: string }).message ?? JSON.stringify(error)}`);
  }

  console.log("[email] sent successfully id=%s to=%s", data?.id, to);
}
