// Shared by index.html and stats.html. The saved choice is applied before paint by an inline script in each page's <head>.

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

function createThemeToggle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  const update = () => {
    const theme = getTheme();
    const label = theme[0].toUpperCase() + theme.slice(1);
    button.innerHTML = THEME_ICONS[theme];
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
