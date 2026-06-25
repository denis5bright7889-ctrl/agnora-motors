import { query } from "@/lib/db";
import { LEAD_STAGES, type LeadStage } from "@/lib/leads";

// Dealer-scoped analytics aggregated from three sources:
//   - car_views          → listing views (authoritative, same as the rest of app)
//   - analytics_events    → buyer-intent events (contact_form_open, phone_reveal) + device
//   - contact_requests    → leads (authoritative) + pipeline status + source + response time
//
// Intent events carry props.carId; we scope them by joining to the dealer's
// cars. Leads are scoped directly by contact_requests.dealer_id.

export interface DealerAnalytics {
  totals: {
    views: number;
    contactOpens: number;
    phoneReveals: number;
    leads: number;
    conversionRate: number;     // leads / views (0–1)
    avgResponseHours: number | null;
    leads30d: number;
    leadsPrev30d: number;
    leadGrowthPct: number | null;
  };
  funnel: { label: string; value: number }[];
  sources: { source: string; count: number }[];
  devices: { device: string; count: number }[];
  vehicles: {
    carId: string; label: string; slug: string;
    views: number; phoneReveals: number; leads: number; conversion: number;
  }[];
  statusCounts: Record<LeadStage, number>;
}

export async function getDealerAnalytics(dealerId: string): Promise<DealerAnalytics> {
  const carScope = `(SELECT id::text FROM cars WHERE dealer_id = $1)`;

  const [totalsRows, intentRows, statusRows, sourceRows, deviceRows, vehicleRows, phoneByCar] =
    await Promise.all([
      query<{
        views: string; leads: string; avgResponseSecs: string | null;
        leads30d: string; leadsPrev30d: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM car_views cv JOIN cars c ON c.id = cv.car_id WHERE c.dealer_id = $1)::TEXT AS views,
           (SELECT COUNT(*) FROM contact_requests WHERE dealer_id = $1)::TEXT AS leads,
           (SELECT AVG(EXTRACT(EPOCH FROM (last_contact_at - created_at)))
              FROM contact_requests WHERE dealer_id = $1 AND last_contact_at IS NOT NULL)::TEXT AS "avgResponseSecs",
           (SELECT COUNT(*) FROM contact_requests
              WHERE dealer_id = $1 AND created_at >= NOW() - INTERVAL '30 days')::TEXT AS "leads30d",
           (SELECT COUNT(*) FROM contact_requests
              WHERE dealer_id = $1 AND created_at >= NOW() - INTERVAL '60 days'
                AND created_at < NOW() - INTERVAL '30 days')::TEXT AS "leadsPrev30d"`,
        [dealerId],
      ),
      query<{ name: string; count: string }>(
        `SELECT name, COUNT(*)::TEXT AS count
         FROM analytics_events
         WHERE name IN ('contact_form_open', 'phone_reveal')
           AND props->>'carId' IN ${carScope}
         GROUP BY name`,
        [dealerId],
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::TEXT AS count FROM contact_requests WHERE dealer_id = $1 GROUP BY status`,
        [dealerId],
      ),
      query<{ source: string; count: string }>(
        `SELECT source, COUNT(*)::TEXT AS count FROM contact_requests
         WHERE dealer_id = $1 GROUP BY source ORDER BY COUNT(*) DESC`,
        [dealerId],
      ),
      query<{ device: string; count: string }>(
        `SELECT COALESCE(props->>'device', 'unknown') AS device, COUNT(*)::TEXT AS count
         FROM analytics_events
         WHERE name = 'listing_viewed' AND props->>'carId' IN ${carScope}
         GROUP BY 1 ORDER BY COUNT(*) DESC`,
        [dealerId],
      ),
      query<{
        carId: string; year: number; make: string; model: string; slug: string;
        views: string; leads: string;
      }>(
        `SELECT c.id AS "carId", c.year, c.make, c.model, c.slug,
                COUNT(DISTINCT cv.id)::TEXT AS views,
                COUNT(DISTINCT cr.id)::TEXT AS leads
         FROM cars c
         LEFT JOIN car_views cv        ON cv.car_id = c.id
         LEFT JOIN contact_requests cr ON cr.car_id = c.id
         WHERE c.dealer_id = $1
         GROUP BY c.id`,
        [dealerId],
      ),
      query<{ carId: string; count: string }>(
        `SELECT props->>'carId' AS "carId", COUNT(*)::TEXT AS count
         FROM analytics_events
         WHERE name = 'phone_reveal' AND props->>'carId' IN ${carScope}
         GROUP BY 1`,
        [dealerId],
      ),
    ]);

  const t = totalsRows[0];
  const views = Number(t?.views ?? 0);
  const leads = Number(t?.leads ?? 0);
  const intent = Object.fromEntries(intentRows.map((r) => [r.name, Number(r.count)]));
  const contactOpens = intent["contact_form_open"] ?? 0;
  const phoneReveals = intent["phone_reveal"] ?? 0;

  const leads30d = Number(t?.leads30d ?? 0);
  const leadsPrev30d = Number(t?.leadsPrev30d ?? 0);
  const leadGrowthPct = leadsPrev30d > 0
    ? ((leads30d - leadsPrev30d) / leadsPrev30d) * 100
    : leads30d > 0 ? 100 : null;

  const avgResponseSecs = t?.avgResponseSecs ? Number(t.avgResponseSecs) : null;

  const statusCounts = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
  for (const r of statusRows) {
    if (r.status in statusCounts) statusCounts[r.status as LeadStage] = Number(r.count);
  }

  // Funnel: views → contact opens → leads → negotiating+ → offer+ → won.
  const negotiatingPlus = statusCounts.negotiating + statusCounts.test_drive + statusCounts.offer + statusCounts.won;
  const offerPlus = statusCounts.offer + statusCounts.won;
  const funnel = [
    { label: "Listing views", value: views },
    { label: "Contact opens", value: contactOpens },
    { label: "Leads created", value: leads },
    { label: "Negotiating",   value: negotiatingPlus },
    { label: "Offer made",    value: offerPlus },
    { label: "Won",           value: statusCounts.won },
  ];

  const phoneMap = new Map(phoneByCar.map((r) => [r.carId, Number(r.count)]));
  const vehicles = vehicleRows.map((r) => {
    const v = Number(r.views);
    const l = Number(r.leads);
    return {
      carId: r.carId,
      label: `${r.year} ${r.make} ${r.model}`,
      slug: r.slug,
      views: v,
      phoneReveals: phoneMap.get(r.carId) ?? 0,
      leads: l,
      conversion: v > 0 ? l / v : 0,
    };
  });

  return {
    totals: {
      views, contactOpens, phoneReveals, leads,
      conversionRate: views > 0 ? leads / views : 0,
      avgResponseHours: avgResponseSecs !== null ? avgResponseSecs / 3600 : null,
      leads30d, leadsPrev30d, leadGrowthPct,
    },
    funnel,
    sources: sourceRows.map((r) => ({ source: r.source, count: Number(r.count) })),
    devices: deviceRows.map((r) => ({ device: r.device, count: Number(r.count) })),
    vehicles,
    statusCounts,
  };
}

// Dealer benchmarking is only meaningful at scale. Gate it until the
// marketplace has enough dealers + leads for comparisons to mean anything.
export const BENCHMARK_MIN_DEALERS = 10;
export const BENCHMARK_MIN_LEADS = 100;

export interface BenchmarkResult {
  unlocked: boolean;
  dealers: number;
  leads: number;
  marketplaceConversion: number | null;
  yourConversion: number;
}

export async function getDealerBenchmark(
  dealerId: string,
  yourConversion: number,
): Promise<BenchmarkResult> {
  const rows = await query<{ dealers: string; leads: string; views: string }>(
    `SELECT
       (SELECT COUNT(*) FROM dealers WHERE status = 'approved')::TEXT AS dealers,
       (SELECT COUNT(*) FROM contact_requests)::TEXT AS leads,
       (SELECT COUNT(*) FROM car_views)::TEXT AS views`,
  );
  const dealers = Number(rows[0]?.dealers ?? 0);
  const leads = Number(rows[0]?.leads ?? 0);
  const views = Number(rows[0]?.views ?? 0);
  const unlocked = dealers >= BENCHMARK_MIN_DEALERS && leads >= BENCHMARK_MIN_LEADS;

  return {
    unlocked,
    dealers,
    leads,
    marketplaceConversion: unlocked && views > 0 ? leads / views : null,
    yourConversion,
  };
}
