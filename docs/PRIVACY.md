# Privacy

**Short version: your data never leaves your browser.** SunTally has no backend, no
account, and no analytics. Anything you type or upload is processed on your own device and
stored only in your browser. We can't see it, because it never reaches us.

## What happens to the data you enter or upload

- **Estimate inputs** (system cost, rates, etc.) live only in the page while you use it.
- **Uploaded files** (utility bills, solar proposals — PDF, image, CSV, Excel) are read and
  parsed **entirely in your browser**. The file bytes are never uploaded anywhere.
- **Your bill ledger** (the rows in "Analyze my ROI") is saved in your browser's
  `localStorage` so it's there when you come back. It stays on that device. Use **Clear
  all** to erase it, or **Export** to save your own copy.

## What does touch the network

To keep the tool free and serverless, your browser downloads a few open-source **code
libraries** the first time they're needed (charts, spreadsheet/PDF parsing, and—only if you
use document import—an OCR engine). These are downloads of *code*, the same as any website
loading a script. They never receive your data. The app's
[Content-Security-Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP) is configured to
**forbid sending data to any other server** — connections are limited to fetching those
libraries.

(Like any website, the host and the libraries' CDN can see your IP address and that you
loaded the page. That's it — never your bills or your numbers.)

## How to verify this yourself

You don't have to take our word for it:

1. **Read the source.** It's open. The app is `docs/app.html` plus `docs/assets/*.js` —
   there are no server calls that send your data (no analytics, no uploads).
2. **Watch the network.** Open your browser's DevTools → Network tab, then upload a bill or
   enter numbers. You'll see the one-time library downloads and **no request carrying your
   data**.
3. **Go offline.** Load the page once, turn off Wi-Fi, and keep using it — entering data,
   importing a CSV, viewing charts all still work, because it's all local.

## No tracking

No Google Analytics, no pixels, no tracking cookies. The **app** (where you enter and
upload data) loads no third-party scripts beyond the open-source libraries above. The
marketing **homepage** additionally shows a Ko-fi "Support" donate button — a standard
widget that only opens a tip page and never has access to your bills or numbers (they're
only in the app).

## Disclaimer

SunTally produces illustrative estimates, not financial advice. Verify numbers with
your utility and a qualified advisor before making decisions.
