import type { Make, Model, MakeWithModels } from "@/types";

// Static fallback for the makes/models taxonomy.
// Used when DATABASE_URL is not configured (local dev with an empty DB).
// Mirrors the seed in db/schema.sql — keep the two in sync.
// IDs are deterministic slug strings here, not UUIDs.

interface StaticMake {
  slug: string;
  name: string;
  models: { slug: string; name: string }[];
}

const STATIC: StaticMake[] = [
  {
    slug: "toyota", name: "Toyota",
    models: [
      { slug: "aqua",               name: "Aqua" },
      { slug: "allion",             name: "Allion" },
      { slug: "alphard",            name: "Alphard" },
      { slug: "auris",              name: "Auris" },
      { slug: "avensis",            name: "Avensis" },
      { slug: "belta",              name: "Belta" },
      { slug: "camry",              name: "Camry" },
      { slug: "corolla",            name: "Corolla" },
      { slug: "corolla-axio",       name: "Corolla Axio" },
      { slug: "corolla-fielder",    name: "Corolla Fielder" },
      { slug: "crown",              name: "Crown" },
      { slug: "estima",             name: "Estima" },
      { slug: "fortuner",           name: "Fortuner" },
      { slug: "harrier",            name: "Harrier" },
      { slug: "hiace",              name: "Hiace" },
      { slug: "hilux",              name: "Hilux" },
      { slug: "ist",                name: "IST" },
      { slug: "land-cruiser",       name: "Land Cruiser" },
      { slug: "land-cruiser-prado", name: "Land Cruiser Prado" },
      { slug: "mark-x",             name: "Mark X" },
      { slug: "noah",               name: "Noah" },
      { slug: "passo",              name: "Passo" },
      { slug: "premio",             name: "Premio" },
      { slug: "prius",              name: "Prius" },
      { slug: "probox",             name: "Probox" },
      { slug: "ractis",             name: "Ractis" },
      { slug: "rav4",               name: "RAV4" },
      { slug: "sienta",             name: "Sienta" },
      { slug: "spade",              name: "Spade" },
      { slug: "succeed",            name: "Succeed" },
      { slug: "vellfire",           name: "Vellfire" },
      { slug: "vitz",               name: "Vitz" },
      { slug: "voxy",               name: "Voxy" },
      { slug: "wish",               name: "Wish" },
    ],
  },
  {
    slug: "nissan", name: "Nissan",
    models: [
      { slug: "ad", name: "AD" }, { slug: "bluebird", name: "Bluebird" },
      { slug: "cube", name: "Cube" }, { slug: "dualis", name: "Dualis" },
      { slug: "elgrand", name: "Elgrand" }, { slug: "juke", name: "Juke" },
      { slug: "lafesta", name: "Lafesta" }, { slug: "latio", name: "Latio" },
      { slug: "leaf", name: "Leaf" }, { slug: "march", name: "March" },
      { slug: "murano", name: "Murano" }, { slug: "navara", name: "Navara" },
      { slug: "note", name: "Note" }, { slug: "nv200", name: "NV200" },
      { slug: "patrol", name: "Patrol" }, { slug: "qashqai", name: "Qashqai" },
      { slug: "sentra", name: "Sentra" }, { slug: "serena", name: "Serena" },
      { slug: "skyline", name: "Skyline" }, { slug: "sunny", name: "Sunny" },
      { slug: "sylphy", name: "Sylphy" }, { slug: "teana", name: "Teana" },
      { slug: "tiida", name: "Tiida" }, { slug: "vanette", name: "Vanette" },
      { slug: "wingroad", name: "Wingroad" }, { slug: "x-trail", name: "X-Trail" },
    ],
  },
  {
    slug: "mazda", name: "Mazda",
    models: [
      { slug: "atenza", name: "Atenza" }, { slug: "axela", name: "Axela" },
      { slug: "biante", name: "Biante" }, { slug: "bongo", name: "Bongo" },
      { slug: "bt-50", name: "BT-50" }, { slug: "carol", name: "Carol" },
      { slug: "cx-3", name: "CX-3" }, { slug: "cx-5", name: "CX-5" },
      { slug: "cx-7", name: "CX-7" }, { slug: "cx-8", name: "CX-8" },
      { slug: "cx-9", name: "CX-9" }, { slug: "demio", name: "Demio" },
      { slug: "familia", name: "Familia" }, { slug: "mpv", name: "MPV" },
      { slug: "mx-5", name: "MX-5" }, { slug: "premacy", name: "Premacy" },
      { slug: "rx-8", name: "RX-8" }, { slug: "tribute", name: "Tribute" },
      { slug: "verisa", name: "Verisa" },
    ],
  },
  {
    slug: "mercedes-benz", name: "Mercedes-Benz",
    models: [
      { slug: "a-class", name: "A-Class" }, { slug: "b-class", name: "B-Class" },
      { slug: "c-class", name: "C-Class" }, { slug: "cla", name: "CLA" },
      { slug: "cls", name: "CLS" }, { slug: "e-class", name: "E-Class" },
      { slug: "g-class", name: "G-Class" }, { slug: "gla", name: "GLA" },
      { slug: "glb", name: "GLB" }, { slug: "glc", name: "GLC" },
      { slug: "gle", name: "GLE" }, { slug: "gls", name: "GLS" },
      { slug: "ml", name: "ML" }, { slug: "s-class", name: "S-Class" },
      { slug: "slk", name: "SLK" }, { slug: "sprinter", name: "Sprinter" },
      { slug: "v-class", name: "V-Class" }, { slug: "vito", name: "Vito" },
    ],
  },
  {
    slug: "bmw", name: "BMW",
    models: [
      { slug: "1-series", name: "1 Series" }, { slug: "2-series", name: "2 Series" },
      { slug: "3-series", name: "3 Series" }, { slug: "4-series", name: "4 Series" },
      { slug: "5-series", name: "5 Series" }, { slug: "6-series", name: "6 Series" },
      { slug: "7-series", name: "7 Series" }, { slug: "8-series", name: "8 Series" },
      { slug: "x1", name: "X1" }, { slug: "x2", name: "X2" },
      { slug: "x3", name: "X3" }, { slug: "x4", name: "X4" },
      { slug: "x5", name: "X5" }, { slug: "x6", name: "X6" },
      { slug: "x7", name: "X7" }, { slug: "z4", name: "Z4" },
    ],
  },
  {
    slug: "subaru", name: "Subaru",
    models: [
      { slug: "brz", name: "BRZ" }, { slug: "exiga", name: "Exiga" },
      { slug: "forester", name: "Forester" }, { slug: "impreza", name: "Impreza" },
      { slug: "legacy", name: "Legacy" }, { slug: "levorg", name: "Levorg" },
      { slug: "outback", name: "Outback" }, { slug: "trezia", name: "Trezia" },
      { slug: "wrx", name: "WRX" }, { slug: "xv", name: "XV" },
    ],
  },
  {
    slug: "honda", name: "Honda",
    models: [
      { slug: "accord", name: "Accord" }, { slug: "civic", name: "Civic" },
      { slug: "cr-v", name: "CR-V" }, { slug: "cr-z", name: "CR-Z" },
      { slug: "fit", name: "Fit" }, { slug: "freed", name: "Freed" },
      { slug: "hr-v", name: "HR-V" }, { slug: "insight", name: "Insight" },
      { slug: "jazz", name: "Jazz" }, { slug: "odyssey", name: "Odyssey" },
      { slug: "pilot", name: "Pilot" }, { slug: "stepwgn", name: "Stepwgn" },
      { slug: "stream", name: "Stream" }, { slug: "vezel", name: "Vezel" },
    ],
  },
  {
    slug: "mitsubishi", name: "Mitsubishi",
    models: [
      { slug: "asx", name: "ASX" }, { slug: "colt", name: "Colt" },
      { slug: "delica", name: "Delica" }, { slug: "eclipse-cross", name: "Eclipse Cross" },
      { slug: "galant", name: "Galant" }, { slug: "l200", name: "L200" },
      { slug: "lancer", name: "Lancer" }, { slug: "mirage", name: "Mirage" },
      { slug: "outlander", name: "Outlander" }, { slug: "pajero", name: "Pajero" },
      { slug: "pajero-sport", name: "Pajero Sport" }, { slug: "rvr", name: "RVR" },
      { slug: "triton", name: "Triton" },
    ],
  },
  {
    slug: "volkswagen", name: "Volkswagen",
    models: [
      { slug: "amarok", name: "Amarok" }, { slug: "beetle", name: "Beetle" },
      { slug: "caddy", name: "Caddy" }, { slug: "golf", name: "Golf" },
      { slug: "jetta", name: "Jetta" }, { slug: "passat", name: "Passat" },
      { slug: "polo", name: "Polo" }, { slug: "tiguan", name: "Tiguan" },
      { slug: "touareg", name: "Touareg" }, { slug: "touran", name: "Touran" },
      { slug: "transporter", name: "Transporter" },
    ],
  },
  {
    slug: "land-rover", name: "Land Rover",
    models: [
      { slug: "defender", name: "Defender" }, { slug: "discovery", name: "Discovery" },
      { slug: "discovery-sport", name: "Discovery Sport" }, { slug: "freelander", name: "Freelander" },
      { slug: "range-rover", name: "Range Rover" }, { slug: "range-rover-evoque", name: "Range Rover Evoque" },
      { slug: "range-rover-sport", name: "Range Rover Sport" }, { slug: "range-rover-velar", name: "Range Rover Velar" },
    ],
  },
  {
    slug: "isuzu", name: "Isuzu",
    models: [
      { slug: "d-max", name: "D-Max" }, { slug: "faster", name: "Faster" },
      { slug: "frr", name: "FRR" }, { slug: "mu-7", name: "MU-7" },
      { slug: "mu-x", name: "MU-X" }, { slug: "npr", name: "NPR" },
      { slug: "trooper", name: "Trooper" }, { slug: "wizard", name: "Wizard" },
    ],
  },
  {
    slug: "suzuki", name: "Suzuki",
    models: [
      { slug: "alto", name: "Alto" }, { slug: "apv", name: "APV" },
      { slug: "baleno", name: "Baleno" }, { slug: "carry", name: "Carry" },
      { slug: "celerio", name: "Celerio" }, { slug: "ertiga", name: "Ertiga" },
      { slug: "escudo", name: "Escudo" }, { slug: "grand-vitara", name: "Grand Vitara" },
      { slug: "ignis", name: "Ignis" }, { slug: "jimny", name: "Jimny" },
      { slug: "s-cross", name: "S-Cross" }, { slug: "solio", name: "Solio" },
      { slug: "splash", name: "Splash" }, { slug: "swift", name: "Swift" },
      { slug: "vitara", name: "Vitara" }, { slug: "wagon-r", name: "Wagon R" },
    ],
  },
  {
    slug: "ford", name: "Ford",
    models: [
      { slug: "ecosport", name: "EcoSport" }, { slug: "edge", name: "Edge" },
      { slug: "escape", name: "Escape" }, { slug: "explorer", name: "Explorer" },
      { slug: "f-150", name: "F-150" }, { slug: "fiesta", name: "Fiesta" },
      { slug: "focus", name: "Focus" }, { slug: "mustang", name: "Mustang" },
      { slug: "ranger", name: "Ranger" }, { slug: "transit", name: "Transit" },
    ],
  },
  {
    slug: "hyundai", name: "Hyundai",
    models: [
      { slug: "accent", name: "Accent" }, { slug: "creta", name: "Creta" },
      { slug: "elantra", name: "Elantra" }, { slug: "h-1", name: "H-1" },
      { slug: "i10", name: "i10" }, { slug: "i20", name: "i20" },
      { slug: "kona", name: "Kona" }, { slug: "palisade", name: "Palisade" },
      { slug: "santa-fe", name: "Santa Fe" }, { slug: "sonata", name: "Sonata" },
      { slug: "tucson", name: "Tucson" },
    ],
  },
  {
    slug: "kia", name: "Kia",
    models: [
      { slug: "carnival", name: "Carnival" }, { slug: "cerato", name: "Cerato" },
      { slug: "k3", name: "K3" }, { slug: "k5", name: "K5" },
      { slug: "mohave", name: "Mohave" }, { slug: "picanto", name: "Picanto" },
      { slug: "rio", name: "Rio" }, { slug: "seltos", name: "Seltos" },
      { slug: "sorento", name: "Sorento" }, { slug: "soul", name: "Soul" },
      { slug: "sportage", name: "Sportage" }, { slug: "stonic", name: "Stonic" },
    ],
  },
  {
    slug: "lexus", name: "Lexus",
    models: [
      { slug: "ct", name: "CT" }, { slug: "es", name: "ES" },
      { slug: "gs", name: "GS" }, { slug: "gx", name: "GX" },
      { slug: "is", name: "IS" }, { slug: "lc", name: "LC" },
      { slug: "ls", name: "LS" }, { slug: "lx", name: "LX" },
      { slug: "nx", name: "NX" }, { slug: "rc", name: "RC" },
      { slug: "rx", name: "RX" }, { slug: "ux", name: "UX" },
    ],
  },
  {
    slug: "audi", name: "Audi",
    models: [
      { slug: "a3", name: "A3" }, { slug: "a4", name: "A4" },
      { slug: "a5", name: "A5" }, { slug: "a6", name: "A6" },
      { slug: "a8", name: "A8" }, { slug: "e-tron", name: "e-tron" },
      { slug: "q3", name: "Q3" }, { slug: "q5", name: "Q5" },
      { slug: "q7", name: "Q7" }, { slug: "q8", name: "Q8" },
      { slug: "tt", name: "TT" },
    ],
  },
  {
    slug: "peugeot", name: "Peugeot",
    models: [
      { slug: "208", name: "208" }, { slug: "308", name: "308" },
      { slug: "408", name: "408" }, { slug: "508", name: "508" },
      { slug: "2008", name: "2008" }, { slug: "3008", name: "3008" },
      { slug: "5008", name: "5008" }, { slug: "partner", name: "Partner" },
    ],
  },
];

function makeId(slug: string)             { return `make_${slug}`; }
function modelId(makeSlug: string, slug: string) { return `model_${makeSlug}_${slug}`; }

export const STATIC_MAKES: Make[] = STATIC.map((m) => ({
  id:   makeId(m.slug),
  slug: m.slug,
  name: m.name,
}));

export const STATIC_MODELS: Model[] = STATIC.flatMap((m) =>
  m.models.map((mod) => ({
    id:     modelId(m.slug, mod.slug),
    makeId: makeId(m.slug),
    slug:   mod.slug,
    name:   mod.name,
  })),
);

export function getStaticMakeBySlug(slug: string): Make | null {
  return STATIC_MAKES.find((m) => m.slug === slug) ?? null;
}

export function getStaticModelsByMakeSlug(slug: string): Model[] {
  const m = STATIC.find((x) => x.slug === slug);
  if (!m) return [];
  return m.models.map((mod) => ({
    id:     modelId(m.slug, mod.slug),
    makeId: makeId(m.slug),
    slug:   mod.slug,
    name:   mod.name,
  }));
}

export function getStaticMakeWithModels(slug: string): MakeWithModels | null {
  const m = STATIC.find((x) => x.slug === slug);
  if (!m) return null;
  return {
    id:     makeId(m.slug),
    slug:   m.slug,
    name:   m.name,
    models: m.models.map((mod) => ({
      id:     modelId(m.slug, mod.slug),
      makeId: makeId(m.slug),
      slug:   mod.slug,
      name:   mod.name,
    })),
  };
}
