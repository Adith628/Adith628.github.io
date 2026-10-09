// Fetches the last 30 days of visitor stats from GoatCounter and writes them to a JSON file
// that stats.html reads. Runs in GitHub Actions (see .github/workflows/stats.yml).
//
// Usage: GOATCOUNTER_TOKEN=... node scripts/fetch-stats.mjs stats.json

import { writeFile } from "node:fs/promises";

const SITE = process.env.GOATCOUNTER_SITE || "adithyant";
const TOKEN = process.env.GOATCOUNTER_TOKEN;
const DAYS = 30;
const OUT = process.argv[2] || "stats.json";

if (!TOKEN) {
  console.error("GOATCOUNTER_TOKEN is not set");
  process.exit(1);
}

const API = `https://${SITE}.goatcounter.com/api/v0`;
const isoDay = (d) => d.toISOString().slice(0, 10);

const end = new Date();
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - (DAYS - 1));
const range = { start: isoDay(start), end: isoDay(end) };

async function api(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries({ ...range, ...params })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

// Dimension lists (sources, countries, ...). A failure here leaves that list empty instead of failing the run.
const errors = [];
async function dimension(page) {
  try {
    const data = await api(`/stats/${page}`, { limit: 10 });
    return (data.stats || []).map((s) => ({ name: s.name || "", count: s.count || 0 }));
  } catch (e) {
    errors.push(e.message);
    return [];
  }
}

const { hits = [] } = await api("/stats/hits", { limit: 100 });

// Page views per day, summed over every non-event path; days with no visits are filled with 0.
const perDay = new Map();
for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) perDay.set(isoDay(d), 0);
for (const hit of hits.filter((h) => !h.event)) {
  for (const s of hit.stats || []) if (perDay.has(s.day)) perDay.set(s.day, perDay.get(s.day) + (s.daily || 0));
}

const byCount = (a, b) => b.count - a.count;
const stats = {
  site: `${SITE}.goatcounter.com`,
  generatedAt: new Date().toISOString(),
  days: DAYS,
  ...range,
  daily: [...perDay].map(([day, visits]) => ({ day, visits })),
  pages: hits.filter((h) => !h.event).map((h) => ({ path: h.path, title: h.title || "", count: h.count || 0 })).sort(byCount),
  clicks: hits.filter((h) => h.event).map((h) => ({ name: h.path.replace(/^click: /, ""), count: h.count || 0 })).sort(byCount),
  referrers: await dimension("toprefs"),
  locations: await dimension("locations"),
  sizes: await dimension("sizes"),
  browsers: await dimension("browsers"),
  systems: await dimension("systems"),
};
if (errors.length) stats.errors = errors;

await writeFile(OUT, JSON.stringify(stats, null, 2) + "\n");
const total = stats.daily.reduce((n, d) => n + d.visits, 0);
console.log(`Wrote ${OUT}: ${total} visits, ${stats.clicks.length} tracked links, ${errors.length} errors`);
for (const e of errors) console.warn("warning:", e);
