# Portfolio

Personal portfolio site. Plain HTML, CSS and JavaScript — no build step.

## Editing

All page content lives in [`content.json`](content.json): profile, links, skills, experience, projects, education and highlights. `sectionOrder` sets the order of sections.

- To add a job or project, copy an existing block and change the text.
- Leave a field as `""` (or a list as `[]`) to hide it.
- If the page shows "Couldn't load content.json", there's a JSON typo (usually a missing comma or quote).

The browser-tab title and link-preview tags are at the top of [`index.html`](index.html).

## Running locally

The page loads `content.json` with `fetch`, so open it through a local server rather than double-clicking `index.html`:

```bash
npx serve .
```
