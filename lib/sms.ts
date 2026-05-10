const IS_SANDBOX = (process.env.AT_USERNAME ?? "").toLowerCase() === "sandbox";

const AT_ENDPOINT = IS_SANDBOX
  ? "https://api.sandbox.africastalking.com/version1/messaging"
  : "https://api.africastalking.com/version1/messaging";

/** Normalise any Kenyan format → 254XXXXXXXXX (digits only, no + prefix) */
function normalizeKenyanPhone(phone: string): string {
  let p = phone.replaceAll(/[\s\-().]/g, ""); // strip formatting chars
  if (p.startsWith("+")) p = p.slice(1);   // drop leading +
  if (p.startsWith("0")) p = "254" + p.slice(1); // 07xx → 2547xx
  return p;
}

export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    // Dev fallback — log OTP so you can still test without AT credentials
    console.warn(`[sms] AT_API_KEY / AT_USERNAME not set — OTP for ${phone}: ${code} (NOT sent)`);
    return;
  }

  const to = normalizeKenyanPhone(phone);
  console.log("[sms] sending OTP to=%s (raw=%s) sandbox=%s endpoint=%s", to, phone, IS_SANDBOX, AT_ENDPOINT);

  const body = new URLSearchParams({
    username,
    to,
    message: `Your Agnora verification code is: ${code}\nValid for 5 minutes. Do not share this code.`,
  });

  // Sender ID rules:
  //  • Sandbox does NOT support custom sender IDs — omit entirely.
  //  • Production: only set if value is ≤11 alphanumeric chars (no spaces).
  //    "Agnora Motors" is invalid (13 chars + space) so it is silently skipped.
  if (!IS_SANDBOX) {
    const sid = (process.env.AT_SENDER_ID ?? "").trim().replaceAll(/\s+/g, "");
    if (sid && sid.length <= 11 && /^[a-zA-Z0-9]+$/.test(sid)) {
      body.set("from", sid);
    } else if (process.env.AT_SENDER_ID) {
      console.warn("[sms] AT_SENDER_ID=%s is invalid (must be ≤11 alphanumeric chars, no spaces) — omitting",
        process.env.AT_SENDER_ID);
    }
  }

  const res = await fetch(AT_ENDPOINT, {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Africa's Talking returned non-JSON (HTTP ${res.status}) — check AT_API_KEY`);
  }

  console.log("[sms] AT response:", JSON.stringify(json));

  const data = json as {
    SMSMessageData?: {
      Recipients?: { status: string; statusCode: number; number: string }[];
    };
  };

  const recipient = data.SMSMessageData?.Recipients?.[0];
  if (!recipient) {
    throw new Error(`AT returned no recipients: ${JSON.stringify(json)}`);
  }

  // 101 = Sent, 102 = Queued — both are valid delivery states
  if (recipient.statusCode !== 101 && recipient.statusCode !== 102) {
    throw new Error(`SMS delivery failed [${recipient.statusCode}]: ${recipient.status}`);
  }

  console.log("[sms] OTP delivered to=%s status=%s", recipient.number, recipient.status);
}
