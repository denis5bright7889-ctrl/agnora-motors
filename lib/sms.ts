export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    console.log(`[sms] AT credentials not set — OTP for ${phone}: ${code}`);
    return;
  }

  // Normalise Kenyan numbers: 07xx → +2547xx, already +254 passes through
  const normalised = phone.startsWith("+")
    ? phone
    : `+254${phone.replace(/^0/, "")}`;

  const body = new URLSearchParams({
    username,
    to: normalised,
    message: `Your Agnora verification code is: ${code}\nValid for 10 minutes. Do not share this code.`,
  });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const json = await res.json() as {
    SMSMessageData?: { Recipients?: { status: string; statusCode: number }[] };
  };

  const recipient = json.SMSMessageData?.Recipients?.[0];
  if (!recipient || recipient.statusCode !== 101) {
    throw new Error(`SMS delivery failed: ${JSON.stringify(json)}`);
  }
}
