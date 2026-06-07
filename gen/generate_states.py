#!/usr/bin/env python3
"""Generate per-state "Is solar worth it in {State}?" pages for SunTally (SEO Phase 2).

Reads data/states.json, computes a representative payback with the SAME model as the app
(cash purchase, ported from docs/assets/model.js), and writes:
  docs/solar/index.html        (hub)
  docs/solar/<slug>.html        (one per state)
  docs/sitemap.xml              (regenerated: core + learn + story + solar)

Run:  python gen/generate_states.py
Then commit docs/ — the existing GitHub Actions → Vercel deploy ships it.

Figures are approximate state averages (clearly labeled); the page's value is the honest,
state-specific framing + a free calculator to run real numbers — not thin templated text.
"""
import json, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://suntally.com"
US_AVG_RATE = 0.17  # ~US residential average $/kWh, for context

# Representative cash system used for the illustrative payback
SYS_KW, GROSS, INCENT, USAGE, SELFCON = 8, 24000, 7200, 11000, 0.5
NET_COST = GROSS - INCENT

def project_cash(net_cost, annual_production, usage, gen, deliv, fixed_mo, export_rate,
                 sc=SELFCON, infl=0.03, deg=0.005, years=25):
    """Cash-purchase projection — mirrors projectEstimate() in model.js."""
    cum, payback, total_sav, yr1 = -net_cost, None, 0.0, 0.0
    for y in range(1, years + 1):
        f = (1 + infl) ** (y - 1)
        prod = annual_production * ((1 - deg) ** (y - 1))
        self_used = min(prod * sc, usage)
        exported = max(prod - self_used, 0)
        imported = max(usage - self_used, 0)
        rate, dl, fixedY, expR = gen * f, deliv * f, fixed_mo * 12 * f, export_rate * f
        bill_without = usage * (rate + dl) + fixedY
        bill_with = imported * (rate + dl) + fixedY - exported * expR
        gross = bill_without - bill_with
        prev = cum; cum += gross
        if payback is None and prev < 0 <= cum:
            payback = (y - 1) + (-prev) / (cum - prev)
        if y == 1: yr1 = gross
        total_sav += gross
    return payback, cum, yr1

NEM_LABEL = {"retail": "Net metering (≈ retail credit)",
             "netbilling": "Net billing (reduced export credit)",
             "varies": "Varies by utility"}
def nem_text(name, nem):
    if nem == "retail":
        return (f"{name} generally credits exported solar at or near the retail rate "
                "(traditional net metering), which makes midday surplus more valuable. "
                "Net-metering rules change, so confirm your specific utility's current terms.")
    if nem == "netbilling":
        return (f"In {name}, major utilities credit exported solar <em>below</em> retail "
                "(net billing / reduced export credit). Using more of your own production — "
                "or pairing with a battery — matters more here. Confirm your utility's terms.")
    return (f"{name} has no single statewide net-metering mandate, so what you're credited "
            "for exported solar varies by utility. Check your provider's solar/buyback tariff.")

def rates_for(rate, nem):
    gen = round(rate * 0.6, 4); deliv = round(rate * 0.4, 4)
    export = gen if nem == "retail" else (round(rate * 0.25, 4) if nem == "netbilling" else round(gen * 0.7, 4))
    return gen, deliv, export, 12

def ctx(rate, sun):
    if rate >= US_AVG_RATE * 1.12: rc = "higher than the US average — a point in solar's favor, since you're offsetting pricier power"
    elif rate <= US_AVG_RATE * 0.88: rc = "lower than the US average, which lengthens payback a bit (cheap grid power is harder to beat)"
    else: rc = "close to the US average"
    sc = ("abundant sun" if sun >= 1500 else "solid sun" if sun >= 1300 else "moderate sun")
    return rc, sc

NAV = """<nav class="nav"><div class="wrap">
  <a class="brand" href="../"><span class="sun"></span>SunTally</a><input type="checkbox" id="navcb" class="nav-cb" hidden/><label for="navcb" class="hamburger" aria-label="Menu">☰</label>
  <a class="link" href="../#how">How it works</a>
  <a class="link" href="../learn/">Learn</a>
  <a class="link" href="../#privacy">Privacy</a>
  <a class="link" href="https://github.com/suntally/suntally" target="_blank" rel="noopener">GitHub</a>
  <span class="spacer"></span>
  <a class="btn gold sm" href="../app">Run the Numbers →</a>
</div></nav>"""
FOOT = """<footer><div class="wrap">
  <span>SunTally — free &amp; open source · MIT · your data stays on your device</span>
  <span><a href="../app">Run the Numbers</a> · <a href="../learn/">Learn</a> · <a href="../#support">Support</a></span>
</div></footer>"""

def head(title, desc, canon, extra_jsonld):
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}"/>
<link rel="canonical" href="{canon}"/>
<meta name="theme-color" content="#0b0f17"/>
<meta property="og:type" content="article"/><meta property="og:site_name" content="SunTally"/>
<meta property="og:url" content="{canon}"/><meta property="og:title" content="{html.escape(title)}"/>
<meta property="og:description" content="{html.escape(desc)}"/>
<meta property="og:image" content="{SITE}/assets/og.png"/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:image" content="{SITE}/assets/og.png"/>
<link rel="stylesheet" href="../assets/styles.css"/>
<script type="application/ld+json">{extra_jsonld}</script>
</head><body>
{NAV}
"""

def state_page(s):
    name, slug = s["name"], s["name"].lower().replace(" ", "-")
    rate, sun, nem = s["rate"], s["sun"], s["nem"]
    gen, deliv, export, fixed = rates_for(rate, nem)
    annual_prod = SYS_KW * sun
    payback, net25, yr1 = project_cash(NET_COST, annual_prod, USAGE, gen, deliv, fixed, export)
    pb = f"about {round(payback)} years" if payback else "more than 25 years"
    rc, sc = ctx(rate, sun)
    canon = f"{SITE}/solar/{slug}"
    cta = (f"../app?grossCost={GROSS}&incentives={INCENT}&systemKw={SYS_KW}&productionFactor={sun}"
           f"&annualUsageKwh={USAGE}&selfConsumption=50&genRate={gen}&deliveryPerKwh={deliv}"
           f"&fixedMonthly={fixed}&exportRate={export}")
    title = f"Is solar worth it in {name}? (2026 payback estimate) — SunTally"
    desc = (f"How solar pays off in {name}: a typical 8 kW system pays back in {pb}. "
            f"What drives it — ~{round(rate*100)}¢/kWh power, {sun} kWh/kW of sun, net metering — "
            "plus a free calculator for your own numbers.")
    jsonld = json.dumps({"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Solar by state", "item": SITE + "/solar"},
            {"@type": "ListItem", "position": 3, "name": name, "item": canon}]},
        {"@type": "Article", "headline": f"Is solar worth it in {name}?", "description": desc,
         "image": SITE + "/assets/og.png", "author": {"@type": "Organization", "name": "SunTally"},
         "publisher": {"@type": "Organization", "name": "SunTally", "logo": {"@type": "ImageObject", "url": SITE + "/assets/og.png"}},
         "mainEntityOfPage": canon},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": f"Is solar worth it in {name}?",
             "acceptedAnswer": {"@type": "Answer", "text": f"For a typical 8 kW home system bought with cash (about ${NET_COST:,} after the 30% federal tax credit), solar in {name} pays back in {pb} on illustrative average assumptions, then keeps saving for the panels' ~25-year life. Your result depends on your exact rates, usage, roof, and net-metering terms — run your own numbers to be sure."}},
            {"@type": "Question", "name": f"What is the average solar payback period in {name}?",
             "acceptedAnswer": {"@type": "Answer", "text": f"Using ~{round(rate*100)}¢/kWh electricity and {sun} kWh per kW of annual production, a cash-purchased system pays back in {pb}. Financing with a loan lengthens it due to interest."}},
            {"@type": "Question", "name": f"Does {name} have net metering?",
             "acceptedAnswer": {"@type": "Answer", "text": NEM_LABEL[nem] + ". " + html.unescape(nem_text(name, nem).replace('<em>','').replace('</em>',''))}}]}]}, separators=(",", ":"))

    body = f"""<article class="article">
  <div class="crumbs"><a href="../">Home</a> · <a href="./">Solar by state</a> · {name}</div>
  <h1>Is solar worth it in {name}?</h1>
  <p class="lede">Short answer: on illustrative average numbers, a typical 8 kW system bought with cash pays back in <strong>{pb}</strong> in {name} — then keeps saving for the rest of the panels' ~25-year life. But it hinges on <em>your</em> rates, usage, and net-metering terms, so run your own numbers below.</p>
  <p class="meta">Approximate {name} averages (~2026) · not financial advice</p>

  <div class="grid cols-3" style="margin:18px 0">
    <div class="keystat"><div class="n">{round(rate*100)}¢</div><div class="l">avg electricity rate ($/kWh)</div></div>
    <div class="keystat"><div class="n">{sun:,}</div><div class="l">kWh per kW of solar / year (sun)</div></div>
    <div class="keystat"><div class="n">~{round(payback) if payback else '25+'}&nbsp;yrs</div><div class="l">illustrative cash payback</div></div>
  </div>

  <h2>What drives solar economics in {name}</h2>
  <p>Two things move the needle most: how much you pay for grid power, and how much sun your panels get. {name}'s residential electricity runs around <strong>{round(rate*100)}¢/kWh</strong>, {rc}. And with {sc} (about <strong>{sun:,} kWh per kW</strong> installed each year), an 8 kW system produces roughly <strong>{annual_prod:,.0f} kWh/year</strong>.</p>
  <p>The third factor is net metering. {nem_text(name, nem)}</p>
  <p>Remember solar offsets the <a href="../learn/why-solar-doesnt-zero-your-bill">generation part of your bill, not delivery and fixed fees</a> — so even a great system in {name} won't take your bill to zero.</p>

  <h2>A typical system, run honestly</h2>
  <p>For an 8 kW system at about $3/W (≈${GROSS:,}), minus the 30% federal tax credit (≈${INCENT:,}), the net cost is roughly <strong>${NET_COST:,}</strong>. On {name}'s averages that returns about <strong>${net25:,.0f} net over 25 years</strong>, with first-year savings near <strong>${yr1:,.0f}</strong>. These are illustrative — your quote, roof, and utility will differ.</p>

  <div class="cta-box">
    <h3>Run <em>your</em> {name} numbers</h3>
    <p>This opens the calculator pre-filled with {name} averages — then adjust to match your quote and bill.</p>
    <a class="btn gold" href="{cta}">Run the Numbers →</a>
  </div>

  <h2>FAQ</h2>
  <div class="faq">
    <details><summary>Is solar worth it in {name}?</summary><p>For a typical 8 kW cash system (~${NET_COST:,} after the federal credit), payback is {pb} on illustrative averages, then it keeps saving for ~25 years. Confirm with your own rates and net-metering terms.</p></details>
    <details><summary>What's the average payback period in {name}?</summary><p>About {round(payback) if payback else 'over 25'} years for a cash purchase at ~{round(rate*100)}¢/kWh and {sun:,} kWh/kW of sun. A loan lengthens it because of interest.</p></details>
    <details><summary>Does {name} have net metering?</summary><p>{NEM_LABEL[nem]}. {nem_text(name, nem)}</p></details>
  </div>

  <p class="note" style="margin-top:18px">Figures are approximate {name} averages (~2026) for illustration, drawn from public EIA rate data and NREL production ranges. Net-metering policy changes often. Verify everything against your own bill and current utility tariffs. Not financial advice.</p>

  <div class="next-reads">
    <a class="card learn-card" href="./"><h3>Solar by state →</h3><p>Compare payback in other states.</p></a>
    <a class="card learn-card" href="../learn/net-metering-explained"><h3>Net metering, explained →</h3><p>What exported solar is really worth.</p></a>
  </div>
</article>
{FOOT}
</body></html>"""
    return slug, head(title, desc, canon, jsonld) + body

def hub_page(states, results):
    canon = f"{SITE}/solar"
    rows = "\n".join(
        f'<tr><td><a href="{slug}">{html.escape(s["name"])}</a></td><td>{round(s["rate"]*100)}¢</td>'
        f'<td>{s["sun"]:,}</td><td>{("~"+str(round(pb))+" yrs") if pb else "25+ yrs"}</td>'
        f'<td>{NEM_LABEL[s["nem"]].split(" (")[0]}</td></tr>'
        for s, slug, pb in results)
    jsonld = json.dumps({"@context": "https://schema.org", "@type": "CollectionPage",
        "name": "Is solar worth it? Payback by state", "url": canon,
        "description": "Illustrative solar payback by US state, with a free calculator to run your own numbers."}, separators=(",", ":"))
    title = "Is solar worth it? Solar payback by state — SunTally"
    desc = "Compare illustrative solar payback across US states — electricity rates, sun, and net metering — then run your own numbers with a free, private calculator."
    body = f"""<div class="article">
  <span class="eyebrow eyebrow-stack">Solar by state</span>
  <h1>Is solar worth it where you live?</h1>
  <p class="lede">A quick, honest read on solar payback by state — driven by local electricity rates, sun, and net-metering rules. Pick your state, then run your exact numbers in the free calculator.</p>
</div>
<div class="wrap" style="max-width:880px;padding-bottom:30px">
  <div class="dt-wrap"><table class="dt">
    <tr><th>State</th><th>Avg rate</th><th>Sun (kWh/kW)</th><th>Cash payback*</th><th>Net metering</th></tr>
    {rows}
  </table></div>
  <p class="note" style="margin-top:10px">*Illustrative cash-purchase payback for a typical 8 kW system (~${NET_COST:,} after the 30% federal credit) on approximate ~2026 state averages. Your result will differ — <a href="../app">run your own numbers</a>. Sources: EIA (rates), NREL (production), DSIRE/utilities (net metering).</p>
  <div class="cta-box"><h3>Don't see your exact situation?</h3><p>The calculator works anywhere — enter your quote and bill.</p><a class="btn gold" href="../app">Run the Numbers →</a></div>
</div>
{FOOT}
</body></html>"""
    return head(title, desc, canon, jsonld) + body

def write_sitemap(slugs):
    urls = ["/", "/app", "/learn", "/learn/why-solar-doesnt-zero-your-bill",
            "/learn/is-solar-worth-it", "/learn/net-metering-explained", "/story", "/solar"]
    urls += [f"/solar/{sl}" for sl in slugs]
    items = "\n".join(f"  <url><loc>{SITE}{u}</loc><changefreq>monthly</changefreq>"
                      f"<priority>{'1.0' if u=='/' else '0.8'}</priority></url>" for u in urls)
    (ROOT / "docs" / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + items + "\n</urlset>\n")

def main():
    data = json.loads((ROOT / "data" / "states.json").read_text())
    states = sorted(data["states"], key=lambda x: x["name"])
    (ROOT / "docs" / "solar").mkdir(parents=True, exist_ok=True)
    results = []
    for s in states:
        slug, htmltext = state_page(s)
        (ROOT / "docs" / "solar" / f"{slug}.html").write_text(htmltext)
        pb, _, _ = project_cash(NET_COST, SYS_KW * s["sun"], USAGE, *rates_for(s["rate"], s["nem"]))
        results.append((s, slug, pb))
    (ROOT / "docs" / "solar" / "index.html").write_text(hub_page(states, results))
    write_sitemap([slug for _, slug, _ in results])
    print(f"Generated {len(states)} state pages + hub + sitemap.")

if __name__ == "__main__":
    main()
