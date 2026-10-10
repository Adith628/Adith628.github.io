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
// GoatCounter wants full timestamps rounded to the hour, e.g. 2026-10-10T12:00:00Z
const isoHour = (d) => d.toISOString().slice(0, 13) + ":00:00Z";

const HOUR = 3600 * 1000;
const end = new Date(Math.ceil(Date.now() / HOUR) * HOUR);
const start = new Date(end);
start.setUTCHours(0, 0, 0, 0);
start.setUTCDate(start.getUTCDate() - (DAYS - 1));
const range = { start: isoHour(start), end: isoHour(end) };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GoatCounter rate-limits the API, so requests are spaced out and a 429 is retried once after a pause.
async function api(path, params = {}, retried = false) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries({ ...range, ...params })) url.searchParams.set(k, v);
  await sleep(600);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  console.log(`GET ${path} -> ${res.status}`);
  if (res.status === 429 && !retried) {
    await sleep(3000);
    return api(path, params, true);
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 160)}`);
  return res.json();
}

// Each request is independent: a failure leaves that part empty instead of failing the whole run.
const errors = [];
async function attempt(fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    errors.push(e.message);
    return fallback;
  }
}
// Screen sizes come back with an empty name and the category in `id`.
const SIZE_NAMES = { phone: "Phone", largephone: "Large phone", tablet: "Tablet", desktop: "Desktop", desktophd: "Large desktop", unknown: "" };
const dimension = (page) =>
  attempt(async () => ((await api(`/stats/${page}`, { limit: 10 })).stats || [])
    .filter((s) => s.count > 0)
    .map((s) => ({ name: s.name || (SIZE_NAMES[s.id] ?? s.id ?? ""), count: s.count })), []);

// Visits per day from the site-wide total; days with no visits are filled with 0.
const perDay = new Map();
for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) perDay.set(isoDay(d), 0);
const total = await attempt(() => api("/stats/total"), null);
for (const s of total?.stats || []) if (perDay.has(s.day)) perDay.set(s.day, s.daily || 0);

// Per-path counts: pages viewed, and "click: ..." events from tracked links.
const { hits = [] } = await attempt(() => api("/stats/hits", { limit: 100 }), {});

const byCount = (a, b) => b.count - a.count;
const stats = {
  site: `${SITE}.goatcounter.com`,
  generatedAt: new Date().toISOString(),
  days: DAYS,
  start: isoDay(start),
  end: isoDay(new Date(end - 1)),
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
const visits = stats.daily.reduce((n, d) => n + d.visits, 0);
console.log(`Wrote ${OUT}: ${visits} visits, ${stats.clicks.length} tracked links, ${errors.length} errors`);
for (const e of errors) console.warn("warning:", e);
// Fail the run (so it shows red in Actions) only if nothing at all could be fetched.
if (!total && !hits.length && errors.length) process.exit(1);
