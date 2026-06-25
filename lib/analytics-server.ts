import { insertAnalyticsEvent } from "@/lib/db";

// Server-side analytics. For events that originate on the server (lead
// created, lead stage changed) where a client beacon would be unreliable or
// spoofable. Writes straight into analytics_events. Fire-and-forget — a
// logging failure must never break the request that triggered it.
export async function logServerEvent(
  name: string,
  props: Record<string, unknown> = {},
  opts: { userId?: string | null } = {},
): Promise<void> {
  try {
    await insertAnalyticsEvent({
      name,
      props: { ...props, device: "server" },
      userId: opts.userId ?? null,
    });
  } catch {
    /* swallow — analytics must never break the caller */
  }
}
