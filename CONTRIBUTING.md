# Contributing to SunTally

Thanks for helping make solar economics honest and legible. This project is
deliberately simple: a static, client-side app with no build step and no backend.

## Principles (please keep these)

1. **Privacy is the product.** No data leaves the user's browser. No analytics on
   user data, no uploads, no accounts. Any feature that breaks this is a no.
2. **Honest by default.** We don't sell solar. The tool should be just as willing to
   tell someone their system is underwater. Defaults must be defensible, and
   assumptions must be visible and editable.
3. **No build step.** Plain HTML/CSS/JS, libraries from a CDN. Anyone should be able to
   open `docs/index.html` and have it work.

## Project layout

```
docs/                 # the product (deployable static site)
  index.html          # marketing microsite
  app.html            # the app (Estimate + Track)
  assets/
    styles.css        # shared design system
    model.js          # financial engine (projectEstimate / computeTrack)
    charts.js         # ECharts rendering layer
    store.js          # local-first data store + import/export
  content/            # talk tracks, launch posts, FAQ
.github/workflows/    # deploy.yml — auto-deploy to Vercel on push to main
```

## Running locally

No server required, but a tiny one avoids any `file://` quirks:

```bash
cd docs && python3 -m http.server 8080
# open http://localhost:8080
```

## Good first issues

- More utility CSV presets / column aliases in `store.js` (`FIELDS[].aliases`).
- Regional production-factor presets for Estimate mode.
- Time-of-use rate support in `model.js`.
- Accessibility passes (keyboard nav, ARIA, contrast).
- Client-side PDF/photo bill parsing (OCR) — must stay 100% in-browser.

## Pull requests

- Keep changes focused; describe the user-facing effect.
- If you touch `model.js`, include a quick sanity check (numbers in → numbers out).
- Don't add tracking, servers, or anything that sends user data anywhere.

## Financial model changes

The engine lives in `docs/assets/model.js` and is intentionally readable. If you
change a formula, explain the reasoning in the PR — the credibility of this tool is the
whole point.
