// Builds the page from content.json. Edit content.json to change what the page says.

const app = document.getElementById("app");

// h("p", { class: "title" }, "text", childNode, ...) -> element. Strings are inserted as text, never as HTML.
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

// Links to other sites open in a new tab; mailto and local files (cv.pdf) behave normally except the CV.
function link(url, text, attrs = {}) {
  const external = /^https?:\/\//.test(url);
  return h("a", {
    href: url,
    target: external || url.endsWith(".pdf") ? "_blank" : undefined,
    rel: external ? "noopener noreferrer" : undefined,
    ...attrs,
  }, text);
}

const list = (items = []) => (items.length ? h("ul", {}, items.map((item) => h("li", {}, h("span", {}, item)))) : null);

// "Go · TypeScript · Tailwind CSS": each name stays on one line; lines only wrap at the dots
const dotted = (items) => items.map((item, i) => [
  i ? [" ", h("span", { class: "sep", "aria-hidden": "true" }, "·"), " "] : null,
  h("span", { class: "nowrap" }, item),
]);

// keep year ranges like "2023 – 2024" together on one line (browsers may otherwise break after the dash)
const keepRanges = (text) =>
  text.split(/(\d{4}\s*–\s*(?:\d{4}|Present))/).map((part, i) => (i % 2 ? h("span", { class: "nowrap" }, part) : part));
const section = (title, ...body) => h("section", {}, h("h2", {}, title), ...body);

function renderHeader(profile, links) {
  return h("header", {},
    h("div", { class: "header-top" },
      h("img", { id: "avatar", src: profile.photo, alt: profile.name, width: 88, height: 88, draggable: "false" }),
      createThemeToggle(),
    ),
    h("h1", {}, profile.name),
    h("p", { class: "role" },
      profile.role,
      profile.company ? [" at ", profile.companyUrl ? link(profile.companyUrl, profile.company) : profile.company] : null,
    ),
    h("p", { class: "bio" }, profile.bio),
    h("p", { class: "meta" }, profile.location, " · ", h("span", { id: "clock" }, profile.timezoneLabel)),
    h("nav", {}, links.map((l) => link(l.url, l.label, { "data-track": l.url.startsWith("mailto:") ? "Email" : l.label }))),
  );
}

const sections = {
  skills: (skills) => section("Skills",
    h("dl", { class: "skills" }, skills.map((s) => [
      h("dt", {}, s.group),
      h("dd", {}, dotted(s.items)),
    ])),
  ),

  experience: (jobs) => section("Experience",
    h("div", { class: "stack" }, jobs.map((job) =>
      h("div", { class: "entry" },
        h("div", { class: "row" },
          h("p", { class: "title" }, job.role, " · ", job.url ? link(job.url, job.company) : job.company),
          h("p", { class: "date" }, job.dates),
        ),
        list(job.bullets),
      ),
    )),
  ),

  projects: (projects) => section("Projects",
    h("div", { class: "stack" }, projects.map((p) =>
      h("div", { class: "entry" },
        h("div", { class: "row" },
          p.live ? link(p.live, `${p.name} ↗`, { class: "title", "data-track": `${p.name} (live)` }) : h("p", { class: "title" }, p.name),
          p.code ? link(p.code, "code ↗", { class: "date", "data-track": `${p.name} (code)` }) : null,
        ),
        h("p", { class: "desc" }, p.description),
        list(p.bullets),
        p.tech?.length ? h("p", { class: "tech" }, dotted(p.tech)) : null,
      ),
    )),
  ),

  education: (schools) => section("Education",
    h("div", { class: "stack" }, schools.map((e) =>
      h("div", { class: "row" },
        h("p", { class: "title" }, `${e.degree} · ${e.school}`),
        h("p", { class: "date" }, e.dates),
      ),
    )),
  ),

  highlights: (items) => section("Highlights",
    h("ul", {}, items.map((item) => {
      const title = h("strong", {}, item.title);
      return h("li", {}, h("span", {}, item.url ? link(item.url, title) : title, item.detail ? [" — ", keepRanges(item.detail)] : null));
    })),
  ),
};

function render(content) {
  app.replaceChildren(
    renderHeader(content.profile, content.links || []),
    ...(content.sectionOrder || Object.keys(sections))
      .filter((key) => sections[key] && content[key]?.length)
      .map((key) => sections[key](content[key])),
    h("footer", {}, h("p", {}, `© ${new Date().getFullYear()} ${content.profile.name}`)),
  );
  app.removeAttribute("aria-busy");
  startClock(content.profile);
}

// live local time next to your location
function startClock({ timezone, timezoneLabel }) {
  const clock = document.getElementById("clock");
  const tick = () => {
    const time = new Date().toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
    clock.textContent = `${time} ${timezoneLabel}`;
  };
  tick();
  setInterval(tick, 30_000);
}

// Click tracking: links with data-track show up in GoatCounter as "click: <name>".
// Does nothing if GoatCounter didn't load (ad blockers) or on localhost (GoatCounter skips it).
app.addEventListener("click", (e) => {
  const el = e.target.closest("a[data-track]");
  if (!el || !window.goatcounter?.count) return;
  const name = el.dataset.track;
  window.goatcounter.count({ path: `click: ${name}`, title: name, event: true });
});

// Show a readable message instead of a blank page when content.json has a typo.
function showError(error) {
  app.removeAttribute("aria-busy");
  app.replaceChildren(h("div", { class: "load-error" },
    h("p", {}, h("strong", {}, "Couldn't load content.json")),
    h("p", {}, String(error.message || error)),
    h("p", {}, "Check for a missing comma or quote near the place mentioned above, or paste the file into jsonlint.com to find it."),
  ));
  console.error(error);
}

fetch("content.json", { cache: "no-cache" })
  .then((res) => {
    if (!res.ok) throw new Error(`content.json returned ${res.status}`);
    return res.json();
  })
  .then(render)
  .catch(showError);
