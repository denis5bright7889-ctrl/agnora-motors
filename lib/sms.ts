/** Normalise any Kenyan phone format → 254XXXXXXXXX (digits only, no + prefix) */
function normalizeKenyanPhone(phone: string): string {
  let p = phone.replaceAll(/[\s\-().]/g, ""); // strip formatting chars
  if (p.startsWith("+")) p = p.slice(1);      // drop leading +
  if (p.startsWith("0")) p = "254" + p.slice(1); // 07xx → 2547xx
  return p;
}

export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    console.warn(`[sms] AT_API_KEY / AT_USERNAME not set — OTP for ${phone}: ${code} (NOT sent)`);
    return;
  }

  // Evaluate sandbox at call time (not module load) so Vercel runtime env is used
  const isSandbox  = username.toLowerCase() === "sandbox";
  const atEndpoint = isSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const to = normalizeKenyanPhone(phone);
  console.log("[sms] sending OTP to=%s (raw=%s) sandbox=%s", to, phone, isSandbox);

  const body = new URLSearchParams({
    username,
    to,
    message: `Your Agnora verification code is: ${code}\nValid for 5 minutes. Do not share this code.`,
  });

  // Sender ID rules:
  //  • Sandbox: omit entirely — AT sandbox rejects custom sender IDs
  //  • Production: only send if ≤11 alphanumeric chars and no spaces
  //    (AT rejects "Agnora Motors" — 13 chars with space)
  if (!isSandbox) {
    const sid = (process.env.AT_SENDER_ID ?? "").trim().replaceAll(/\s+/g, "");
    if (sid && sid.length <= 11 && /^[a-zA-Z0-9]+$/.test(sid)) {
      body.set("from", sid);
      console.log("[sms] using sender ID: %s", sid);
    } else if (process.env.AT_SENDER_ID) {
      console.warn("[sms] AT_SENDER_ID=%s is invalid (≤11 alphanumeric, no spaces) — AT will use default shortcode",
        process.env.AT_SENDER_ID);
    } else {
      console.log("[sms] no AT_SENDER_ID set — AT will use default shortcode");
    }
  }

  console.log("[sms] POST %s body=%s", atEndpoint, body.toString().replace(apiKey, "***"));

  const res = await fetch(atEndpoint, {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const rawText = await res.text();
  console.log("[sms] AT HTTP status=%d raw response=%s", res.status, rawText);

  if (!res.ok && rawText.trim() === "") {
    throw new Error(`AT API HTTP ${res.status} — check AT_API_KEY validity`);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`AT API returned non-JSON (HTTP ${res.status}): ${rawText.slice(0, 200)}`);
  }

  const data = json as {
    SMSMessageData?: {
      Recipients?: { status: string; statusCode: number; number: string }[];
    };
  };

  const recipient = data.SMSMessageData?.Recipients?.[0];
  if (!recipient) {
    throw new Error(`AT returned no recipients. Full response: ${JSON.stringify(json)}`);
  }

  console.log("[sms] recipient=%s statusCode=%d status=%s",
    recipient.number, recipient.statusCode, recipient.status);

  // AT success status codes:
  //   100 = Processed  101 = Sent  102 = Queued  — all mean the message was accepted
  if (![100, 101, 102].includes(recipient.statusCode)) {
    // Map known AT error codes to actionable messages
    const errorMap: Record<number, string> = {
      401: "Risk hold — contact Africa's Talking support",
      402: "Invalid Sender ID — register it in your AT dashboard",
      403: "Invalid phone number",
      404: "Unsupported number type",
      405: "Insufficient AT wallet balance — top up at account.africastalking.com",
      406: "Number is not in your AT sandbox whitelist",
      407: "Could not route message — try a different network",
      500: "Africa's Talking internal error — retry later",
      501: "Gateway error — retry later",
      502: "Rejected by carrier gateway",
    };
    const hint = errorMap[recipient.statusCode] ?? recipient.status;
    throw new Error(`SMS failed [${recipient.statusCode}]: ${hint}`);
  }

  console.log("[sms] ✓ OTP delivered to=%s status=%s (code %d)",
    recipient.number, recipient.status, recipient.statusCode);
}
