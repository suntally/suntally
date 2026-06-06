# SunTally

**The honest solar ROI tool.** See the true cost and payback of a solar system — projected
from a quote, or measured from your own utility bills. Free, open source, and **your data
never leaves your browser.**

**Live at [suntally.com](https://suntally.com).**

---

## What it is

A single static, client-side web app — no backend, no account, no build step.

- **Estimate a system** — enter system cost, financing, rates, and usage; get a 25-year
  projection: payback year, lifetime net, with-vs-without solar, and the
  generation-vs-delivery split of your future bill.
- **Analyze my ROI** — import your monthly utility data (CSV/Excel) or drop in utility-bill
  PDFs into a local, editable, structured ledger and see the real dashboard: cumulative
  payback, monthly savings, % of usage covered, effective $/kWh, and how much you pay the
  utility as a *delivery* company vs. a *generation* company.

The privacy posture (everything in-browser) is deliberate: it's the trust story **and**
what keeps hosting at ~$0, which makes a donation funding model viable.

## Try it locally

No server needed, but a tiny one avoids `file://` quirks:

```bash
cd docs && python3 -m http.server 8080
# open http://localhost:8080  (index.html = microsite, app.html = the app)
```

## Repo layout

```
docs/                  # the product — static site served at suntally.com
  index.html           #   marketing microsite
  app.html             #   the app (Estimate + Analyze)
  assets/
    styles.css         #   design system
    model.js           #   financial engine (projectEstimate / computeTrack)
    charts.js          #   ECharts rendering
    store.js           #   local-first data store + CSV/XLSX import/export
    extract.js         #   in-browser PDF/OCR extraction (proposals & bills)
    shot-*.png         #   screenshots used by the microsite
  content/             #   talk-tracks.md · launch-posts.md · faq.md
  DATA-FORMAT.md       #   import schema + column aliases
  template.csv         #   downloadable import template
  PRIVACY.md           #   privacy explainer
  vercel.json          #   security headers + Content-Security-Policy
.github/workflows/     #   deploy.yml — auto-deploy to Vercel on push to main
CONTRIBUTING.md        # principles + how to help
.github/FUNDING.yml    # Ko-fi / Sponsors buttons
LICENSE                # MIT
```

## The financial model

Lives in [`docs/assets/model.js`](docs/assets/model.js), intentionally readable:

- `projectEstimate(inputs)` — forward 25-year cashflow with inflation, panel degradation,
  self-consumption, net-metering export credit, and cash-or-loan financing (amortized).
- `computeTrack(rows, assumptions)` — backward-looking actuals from imported bills, with a
  defensible default "without solar" baseline (marginal retail rate × usage).

See data format in [`docs/DATA-FORMAT.md`](docs/DATA-FORMAT.md).

## Funding

SunTally is free for users forever and will never charge or sell data. Development is
supported by voluntary donations and company sponsorships (see `.github/FUNDING.yml`).

## License

MIT — see [`LICENSE`](LICENSE). Estimates are illustrative, not financial advice.

---

*Built by a homeowner who tracked their solar bills for 7 years and wanted an honest answer.*
