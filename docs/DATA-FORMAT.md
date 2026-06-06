# SunTally — data format

Track mode imports monthly utility-bill rows. Bring a CSV or Excel file with a header row.
The importer matches your column names against the aliases below (case / spaces /
underscores don't matter). Anything it doesn't recognize is ignored; missing columns
default to 0.

## Columns

| Field | Meaning | Common source | Accepted header names |
|---|---|---|---|
| `month` | Billing month | bill date | month, date, bill month, period, statement date |
| `produced_kwh` | kWh your panels generated | solar app ("Billing") | produced, produced kwh, total kwh produced, solar produced, generation kwh |
| `delivered_kwh` | kWh pulled **from** the grid | utility bill ("Dlvd") | delivered, delivered kwh, dlvd, from grid, grid import, imported kwh |
| `sent_back_kwh` | kWh exported **to** the grid | utility bill ("Rcvd") | sentback, sent back, rcvd, received, exported, to grid |
| `billed_kwh` | net kWh you paid for (delivered − sent) | utility bill ("Billed Usage") | billed, billed kwh, generation billed, net kwh, billed usage |
| `generation_charge` | $ for energy generation | utility bill | generation charge, generation cost, supply charge, energy charge |
| `delivery_charge` | $ for delivery + fixed/admin fees | utility bill | delivery charge, delivery, delivery fees, transmission, distribution |
| `panel_payment` | $ your solar loan/lease payment | lender | panel payment, loan payment, solar payment, lease payment |

## Derived for you

- **Usage** = produced − sent back + delivered (what the house actually consumed)
- **Invoice** = generation charge + delivery charge
- **Actual all-in** = invoice + panel payment
- **Savings** = (usage × without-solar rate + assumed fixed fee) − actual all-in
- **% covered** = produced ÷ usage
- **Effective rate** = invoice ÷ usage
- **Delivery share** = delivery ÷ (delivery + generation)

## Example

```csv
month,produced_kwh,delivered_kwh,sent_back_kwh,billed_kwh,generation_charge,delivery_charge,panel_payment
2024-01,256,1009,116,893,46.26,68.09,0
2024-02,480,690,240,450,22.40,64.47,0
```

`month` accepts `YYYY-MM`, `YYYY-MM-DD`, or `M/D/YYYY`. Dollar signs and commas in
numbers are fine. Everything stays in your browser.
