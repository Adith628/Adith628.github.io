// Renders stats.html from stats.json, which a GitHub Action publishes to the `stats` branch
// every 3 hours (see .github/workflows/stats.yml). Add ?src=<url> to preview another file.

const STATS_URL =
  new URLSearchParams(location.search).get("src") ||
  "https://raw.githubusercontent.com/Adith628/Adith628.github.io/stats/stats.json";

const body = document.getElementById("stats-body");
const meta = document.getElementById("stats-meta");
document.getElementById("toggle-slot").replaceWith(createThemeToggle());

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null && value !== false) el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === "") continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

const SVG = "http://www.w3.org/2000/svg";
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

const fmt = (n) => n.toLocaleString("en-US");
const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return plural(hours, "hour") + " ago";
  return plural(Math.round(hours / 24), "day") + " ago";
}

// Round the axis maximum up to 1, 2 or 5 × 10^k so tick labels are clean numbers.
function niceMax(value) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 5, 10]) if (m * step >= value) return m * step;
}

const section = (title, ...children) => h("section", {}, h("h2", {}, title), ...children);

function tile(label, value, note) {
  // numbers get the big figure; text (like a domain) is smaller and truncates instead of wrapping mid-word
  const isNumber = /^[\d,]+$/.test(value);
  return h("div", { class: "tile" },
    h("p", { class: "tile-label" }, label),
    h("p", { class: isNumber ? "tile-value" : "tile-value text", title: isNumber ? undefined : value }, value),
    note ? h("p", { class: "tile-note" }, note) : null,
  );
}

// Visits per day: one series, so no legend; the section title names it.
function dailyChart(daily) {
  const wrap = h("div", { class: "chart" });
  const tooltip = h("div", { class: "chart-tooltip", role: "status", hidden: true });

  function draw() {
    wrap.querySelector("svg")?.remove();
    const width = Math.max(wrap.clientWidth, 280);
    const height = 180;
    const m = { top: 8, right: 4, bottom: 22, left: 30 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const max = niceMax(Math.max(...daily.map((d) => d.visits), 1));
    const slot = plotW / daily.length;
    const barW = Math.max(2, Math.min(24, slot - 2)); // 2px surface gap between neighbours
    const y = (v) => m.top + plotH - (v / max) * plotH;

    const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Visits per day" });

    // hairline gridlines + y ticks at 0, half and max
    for (const v of [0, max / 2, max]) {
      svg.append(s("line", { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: v ? "grid" : "baseline" }));
      const label = s("text", { x: m.left - 8, y: y(v), class: "axis", "text-anchor": "end", "dominant-baseline": "middle" });
      label.textContent = fmt(v);
      svg.append(label);
    }

    daily.forEach((d, i) => {
      const x = m.left + i * slot + (slot - barW) / 2;
      if (d.visits > 0) {
        // 4px rounded data-end, square at the baseline
        const top = y(d.visits);
        const r = Math.min(4, barW / 2, m.top + plotH - top);
        const base = m.top + plotH;
        svg.append(s("path", {
          class: "bar",
          d: `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`,
        }));
      }
      // hit target: the whole slot, taller than the mark
      const hit = s("rect", { x: m.left + i * slot, y: m.top, width: slot, height: plotH, class: "hit" });
      const show = () => {
        tooltip.textContent = `${dayLabel(d.day)} · ${plural(d.visits, "visit")}`;
        tooltip.hidden = false;
        const left = Math.min(Math.max(m.left + i * slot + slot / 2, 60), width - 60);
        tooltip.style.left = `${left}px`;
        hit.classList.add("active");
      };
      const hide = () => { tooltip.hidden = true; hit.classList.remove("active"); };
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("pointerleave", hide);
      svg.append(hit);
    });

    // first, middle and last day on the x axis
    for (const i of [0, Math.floor((daily.length - 1) / 2), daily.length - 1]) {
      const label = s("text", {
        x: m.left + i * slot + slot / 2, y: height - 4, class: "axis",
        "text-anchor": i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle",
      });
      label.textContent = dayLabel(daily[i].day);
      svg.append(label);
    }
    wrap.prepend(svg);
  }

  wrap.append(tooltip);
  requestAnimationFrame(draw);
  let resizeTimer;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(draw, 100); }).observe(wrap);

  const table = h("details", { class: "chart-table" },
    h("summary", {}, "Show as table"),
    h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "Day"), h("th", {}, "Visits"))),
      h("tbody", {}, [...daily].reverse().map((d) => h("tr", {}, h("td", {}, dayLabel(d.day)), h("td", {}, fmt(d.visits))))),
    ),
  );
  return [wrap, table];
}

// Ranked list with a thin proportional bar under each name; every value is labelled.
function barList(rows, { empty = "Nothing yet", rename = (n) => n } = {}) {
  if (!rows?.length) return h("p", { class: "empty" }, empty);
  const max = Math.max(...rows.map((r) => r.count), 1);
  return h("ul", { class: "bar-list" }, rows.map((r) =>
    h("li", {},
      h("div", { class: "bar-row" }, h("span", { class: "bar-name" }, rename(r.name)), h("span", { class: "bar-count" }, fmt(r.count))),
      h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: `width:${Math.max(2, (r.count / max) * 100)}%` })),
    ),
  ));
}

function render(data) {
  const daily = data.daily || [];
  const total = daily.reduce((n, d) => n + d.visits, 0);
  const week = daily.slice(-7).reduce((n, d) => n + d.visits, 0);
  const cv = data.clicks?.find((c) => c.name === "CV")?.count || 0;
  const refs = (data.referrers || []).filter((r) => r.name);
  const direct = (name) => name || "Direct or unknown";

  meta.textContent = `Last ${data.days || daily.length} days · updated ${timeAgo(data.generatedAt)}`;
  body.replaceChildren(
    h("div", { class: "tiles" },
      tile("Visits", fmt(total), `last ${daily.length} days`),
      tile("This week", fmt(week), "last 7 days"),
      tile("CV opens", fmt(cv), `last ${daily.length} days`),
      tile("Top source", refs[0] ? refs[0].name : "—", refs[0] ? plural(refs[0].count, "visit") : "no referrers yet"),
    ),
    section("Visits per day", dailyChart(daily)),
    section("Link clicks", barList(data.clicks, { empty: "No tracked link clicks yet" })),
    section("Where visitors came from", barList(data.referrers, { rename: direct })),
    section("Countries", barList(data.locations, { rename: (n) => n || "Unknown" })),
    section("Devices", barList(data.sizes, { rename: (n) => n || "Unknown" })),
    section("Browsers", barList(data.browsers, { rename: (n) => n || "Unknown" })),
    section("Operating systems", barList(data.systems, { rename: (n) => n || "Unknown" })),
    h("footer", {}, h("p", {}, "Data from ", h("a", { href: `https://${data.site}`, target: "_blank", rel: "noopener noreferrer" }, "GoatCounter"), ". Visitors using ad blockers aren't counted.")),
  );
}

function showMessage(title, detail) {
  meta.textContent = "";
  body.replaceChildren(h("div", { class: "load-error" }, h("p", {}, h("strong", {}, title)), h("p", {}, detail)));
}

fetch(STATS_URL, { cache: "no-cache" })
  .then((res) => {
    if (res.status === 404) throw Object.assign(new Error("not published"), { notYet: true });
    if (!res.ok) throw new Error(`stats.json returned ${res.status}`);
    return res.json();
  })
  .then(render)
  .catch((e) => e.notYet
    ? showMessage("No stats yet", "The first update runs within 3 hours of setup. You can also run the “Update site stats” workflow by hand in the repository's Actions tab.")
    : showMessage("Couldn't load stats", String(e.message || e)))
  .finally(() => document.getElementById("stats").removeAttribute("aria-busy"));
