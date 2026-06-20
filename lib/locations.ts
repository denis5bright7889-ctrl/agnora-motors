// PR5: Kenya town centroids + haversine helper. Used for radius search.
// Per-town granularity is the v1 trade-off — every car in "Nairobi" gets the
// city-centre coords, so "within 10 km of Nairobi" is really "in Nairobi".
// When dealers move to per-listing geocoding (paid API), only the lat/lng
// column source changes; the search SQL stays the same.

export interface TownCentroid {
  name:     string;
  lat:      number;
  lng:      number;
}

// Names match the values stored in cars.location (and the dropdowns).
// Order is alphabetical so the UI dropdown stays predictable.
export const TOWN_CENTROIDS: TownCentroid[] = [
  { name: "Eldoret",   lat:  0.520360, lng: 35.269780 },
  { name: "Garissa",   lat: -0.456330, lng: 39.658400 },
  { name: "Kakamega",  lat:  0.282390, lng: 34.751940 },
  { name: "Kiambu",    lat: -1.171830, lng: 36.835440 },
  { name: "Kisumu",    lat: -0.091702, lng: 34.767956 },
  { name: "Kitale",    lat:  1.015270, lng: 35.001230 },
  { name: "Machakos",  lat: -1.516820, lng: 37.266360 },
  { name: "Malindi",   lat: -3.218430, lng: 40.116970 },
  { name: "Meru",      lat:  0.046580, lng: 37.649720 },
  { name: "Mombasa",   lat: -4.043477, lng: 39.668205 },
  { name: "Naivasha",  lat: -0.713720, lng: 36.430930 },
  { name: "Nairobi",   lat: -1.286389, lng: 36.817223 },
  { name: "Nakuru",    lat: -0.303099, lng: 36.080025 },
  { name: "Nyeri",     lat: -0.420880, lng: 36.947190 },
  { name: "Thika",     lat: -1.039780, lng: 37.069050 },
];

const NAME_LOOKUP = new Map<string, TownCentroid>(
  TOWN_CENTROIDS.map((t) => [t.name.toLowerCase(), t]),
);

/**
 * Look up a town centroid by display name (case-insensitive, prefix-tolerant).
 * Returns null if the name doesn't map to a known town — callers should treat
 * that as "no geo info" rather than as an error.
 */
export function getCentroid(location: string | null | undefined): TownCentroid | null {
  if (!location) return null;
  const key = location.trim().toLowerCase();
  const exact = NAME_LOOKUP.get(key);
  if (exact) return exact;
  // Prefix match handles values like "Westlands, Nairobi" or "Mombasa Old Town".
  for (const t of TOWN_CENTROIDS) {
    if (key.includes(t.name.toLowerCase())) return t;
  }
  return null;
}

/**
 * Haversine distance in kilometres between two lat/lng pairs.
 * Earth's mean radius = 6371 km.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number { return deg * (Math.PI / 180); }

export const RADIUS_OPTIONS = [
  { km:  10, label: "10 km"    },
  { km:  25, label: "25 km"    },
  { km:  50, label: "50 km"    },
  { km:   0, label: "Nationwide" }, // 0 = no filter
];
