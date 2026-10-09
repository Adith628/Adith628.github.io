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
const section = (title, ...body) => h("section", {}, h("h2", {}, title), ...body);

function renderHeader(profile, links) {
  return h("header", {},
    h("img", { id: "avatar", src: profile.photo, alt: profile.name, width: 88, height: 88, draggable: "false" }),
    h("h1", {}, profile.name),
    h("p", { class: "role" },
      profile.role,
      profile.company ? [" at ", profile.companyUrl ? link(profile.companyUrl, profile.company) : profile.company] : null,
    ),
    h("p", { class: "bio" }, profile.bio),
    h("p", { class: "meta" }, profile.location, " · ", h("span", { id: "clock" }, profile.timezoneLabel)),
    h("nav", {}, links.map((l) => link(l.url, l.label))),
  );
}

const sections = {
  skills: (skills) => section("Skills",
    h("dl", { class: "skills" }, skills.map((s) => [h("dt", {}, s.group), h("dd", {}, s.items.join(", "))])),
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
          p.live ? link(p.live, `${p.name} ↗`, { class: "title" }) : h("p", { class: "title" }, p.name),
          p.code ? link(p.code, "code ↗", { class: "date" }) : null,
        ),
        h("p", { class: "desc" }, p.description),
        list(p.bullets),
        p.tech?.length ? h("p", { class: "tech" }, p.tech.join(" · ")) : null,
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
      return h("li", {}, h("span", {}, item.url ? link(item.url, title) : title, item.detail ? ` — ${item.detail}` : ""));
    })),
  ),
};

// Theme toggle: cycles system → light → dark. "system" follows the OS setting and is the default.
const THEMES = ["system", "light", "dark"];
const THEME_ICONS = {
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

function getTheme() {
  const saved = document.documentElement.dataset.theme;
  return saved === "light" || saved === "dark" ? saved : "system";
}

function setTheme(theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {}
}

function renderThemeToggle() {
  const button = h("button", { type: "button", class: "theme-toggle" });
  const update = () => {
    const theme = getTheme();
    const label = theme[0].toUpperCase() + theme.slice(1);
    button.innerHTML = `${THEME_ICONS[theme]}<span>${label}</span>`;
    button.setAttribute("aria-label", `Theme: ${label}. Click to change.`);
    button.title = `Theme: ${label}`;
  };
  button.addEventListener("click", () => {
    setTheme(THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length]);
    update();
  });
  update();
  return button;
}

function render(content) {
  app.replaceChildren(
    renderThemeToggle(),
    renderHeader(content.profile, content.links || []),
    ...(content.sectionOrder || Object.keys(sections))
      .filter((key) => sections[key] && content[key]?.length)
      .map((key) => sections[key](content[key])),
    h("footer", {}, h("p", {}, `© ${new Date().getFullYear()} ${content.profile.name}`)),
  );
  app.removeAttribute("aria-busy");
  startClock(content.profile);
  makeAvatarDraggable();
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

// draggable avatar that springs back when released (mouse only, so touch still scrolls the page)
function makeAvatarDraggable() {
  const avatar = document.getElementById("avatar");
  let start = null;

  avatar.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    start = { x: e.clientX, y: e.clientY };
    avatar.classList.add("dragging");
    avatar.setPointerCapture(e.pointerId);
  });

  avatar.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    avatar.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)`;
  });

  function release() {
    if (!start) return;
    start = null;
    avatar.classList.remove("dragging");
    avatar.style.transform = "";
  }
  avatar.addEventListener("pointerup", release);
  avatar.addEventListener("pointercancel", release);
}

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
