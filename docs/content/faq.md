# SunTally — FAQ

**Is it really free?** Yes, and it always will be for users. It's open source (MIT) and
funded by voluntary donations and company sponsorships, not by charging you.

**Where does my data go?** Nowhere. There's no server and no account. Your bills are
parsed and stored locally in your browser. Clear your browser storage and it's gone. The
source is open — you can verify this yourself.

**Can it read my solar proposal or bill automatically?** Yes — in Estimate mode, drop a
PDF or image of your solar proposal, loan agreement, or utility/net-metering statement and
it will try to read the values (system size, cost, production, rates, APR, etc.) and pre-fill
the form. It's best-effort, so you review what it found before applying. Like everything
else, the file is parsed **entirely in your browser** — it is never uploaded.

**How accurate is it?** The Track mode uses your real bills, so it's as accurate as your
data. The Estimate mode is a projection from your assumptions — useful for sanity-checking
a quote, but it's illustrative, not financial advice. Net-metering rules and tariffs vary
and change; tweak the inputs to match your situation.

**What data do I need to import?** Monthly rows with: produced kWh, delivered (from grid)
kWh, sent-back kWh, net billed kWh, your generation charge, your delivery charge, and any
solar loan/lease payment. Download the template in the app to see the exact columns.
Missing a column? It still works — just leave it blank.

**My utility export looks different. Will it work?** The importer recognizes many common
column names. If yours isn't recognized, rename the headers to match the template (or open
an issue/PR to add your utility's format — that's a great contribution).

**Can I just drop in my utility bills?** Yes — in "Analyze my ROI," drop your utility-bill
PDFs (or images) and we'll read the month, kWh delivered/received, and charges into the
structured table. It's best-effort, so check the values in the editable table and fix
anything we misread. You can also import a CSV/Excel export or type rows by hand. As always,
files are parsed entirely in your browser.

**What's the "compared to no solar" setting?** To compute savings we need to estimate what
you'd have paid *without* solar. By default we use your marginal retail rate (energy
charges per net-billed kWh) applied to your full usage. You can override it with your own
assumed $/kWh if you know your pre-solar rate, plus an assumed monthly fixed fee.

**Why doesn't my bill go to zero even when I overproduce?** Because solar offsets the
*generation* part of your bill, not *delivery* and fixed/admin fees. The "delivery share"
chart shows how big that floor is for you — often surprisingly large.

**Can it handle batteries / EVs / time-of-use rates?** Not yet — those are on the roadmap.
Contributions welcome.

**Can I use this on my own site / for my customers?** Yes — MIT license. If you're a solar
company, consider sponsoring a release; there's a tasteful credit slot and it helps keep
the tool neutral and free.

**Is this financial advice?** No. It's a calculator and a dashboard. Verify with your
utility and a qualified advisor before making decisions.
