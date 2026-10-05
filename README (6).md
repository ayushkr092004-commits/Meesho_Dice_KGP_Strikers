# Valmo RTO Shield

**Prevent, prove and redirect COD RTOs with two lightweight levers that plug into the existing Valmo stack.**

| | Lever | Where it runs | What it does |
|---|---|---|---|
| 1 | **Pakka Check** | Between *seller marks order ready* and *first-mile allocation* | Scores each COD order for risk, confirms intent on WhatsApp or SMS, fixes the address, offers a payday date or a switch to UPI, and holds or cancels uncommitted high-risk orders **before any linehaul is spent**. |
| 2 | **Attempt Rewards** | Valmo Pilot app, at the doorstep | Pays pilots only for **verified** attempts (geofence + doorway photo or masked call), with distance, zone and tier bonuses and a per-shift cap to stop route farming. |

```
Total COD orders ──► [Pakka Check: filter low intent] ──► Dispatched ──► [Attempt Rewards: verified attempts] ──► Delivered
```

<p align="center">
  <img src="docs/screenshots/02_whatsapp_template.png" width="210" alt="WhatsApp confirmation">
  <img src="docs/screenshots/11_sms_upi_offer.png" width="210" alt="SMS fallback with UPI offer">
  <img src="docs/screenshots/23_attempt_verified.png" width="210" alt="Verified attempt in the Pilot app">
  <img src="docs/screenshots/24_incentive_result.png" width="210" alt="Incentive breakdown">
</p>

## Run it

No build step and no dependencies.

```bash
git clone https://github.com/<your-org>/valmo-rto-shield.git
cd valmo-rto-shield
open index.html            # or: python3 -m http.server 8000  →  http://localhost:8000
```

**GitHub Pages:** push to `main`. The included workflow (`.github/workflows/pages.yml`) publishes the site automatically. In the repo, set *Settings → Pages → Source* to **GitHub Actions** once.

## Demo script (about 3 minutes)

1. **Tab 1, Pakka Check.** Select *Priya Verma* → **Mark ready to ship** → on the phone tap **Confirm order** → **Move the pin** → tap the map → **Save location**.
2. Select *Ravi Kumar* (feature phone, SMS) → **Mark ready** → reply **3** (Cancel) → **2** (Won't have cash) → **1** (Pay with UPI). A cancellation becomes a prepaid order.
3. **Mark all ready**, then press **+6 h** three times. *Mohd. Imran* (high risk, no reply) goes on hold and is auto-cancelled: ₹170 RTO cost avoided.
4. **Tab 2, Attempt Rewards.** Start Priya's parcel → **Call** (wait ~6 s) → **End** → **Capture** → **Not available** → **Submit verified attempt** (₹26 with the Pro tier).
5. Slide *Distance from customer pin* to 300 m: the attempt is blocked. Tick *Reuse the last photo*: the duplicate is flagged in the hub audit.
6. **Tab 3, Impact.** Click through the scenarios; note the 2.4% break-even.

## Features

**Pakka Check**
- Transparent, configurable risk score (first-time buyer, landmark-only address, high-RTO pincode, high COD value, past RTOs) → High / Medium / Low policy.
- WhatsApp utility template with product image, exact cash amount, delivery date and 3 actions: *Confirm order*, *Change date*, *Cancel order*.
- SMS fallback with numbered replies for feature phones; English and Hindi copy.
- Address pin check and drag-to-correct for landmark-only addresses.
- Date change including a **payday window** (1st–5th).
- "Won't have cash" → **UPI offer** (UPI 123PAY on SMS) before cancelling.
- 12 h confirmation window, reminder, 6 h hold, auto-cancel; medium risk dispatches with a *call first* flag.
- Event log with JSON payloads for every decision.

**Attempt Rewards**
- Parcel list linked to Pakka Check status; cancelled orders never reach the route.
- Live geofence map, masked-call timer (≥ 25 s, must connect) and geo-tagged doorway photo with hash.
- Incentive engine: verified attempt ₹10 (high-risk / long-distance parcels only), distance ₹10 (5–10 km) / ₹20 (>10 km), delivery ₹5 / ₹10 / ₹15 by zone, tier multiplier 1.0×–1.5×, per-shift attempt cap.
- Anti-gaming: submission blocked outside geofence, duplicate-photo detection, unanswered or short calls rejected, one attempt bonus per parcel, hub audit flags.
- Earnings ledger and monthly tier screen (Base, Performer, Pro, Elite).

**Impact model**
- Live sliders for volume, failure rate, cost per RTO, reduction, messaging cost and incentive spend; scenario table; 30-60-90 rollout.

## Project structure

```
valmo-rto-shield/
├── index.html                 # Markup for the three tabs
├── assets/
│   ├── css/styles.css         # Design tokens (light + dark), layout, phone UIs
│   └── js/
│       ├── config.js          # ALL business rules: weights, windows, bonuses, tiers
│       └── app.js             # Risk engine, intent state machine, channel renderers,
│                              # incentive engine, Pilot app, impact model
├── docs/
│   ├── ARCHITECTURE.md        # State machine, event catalogue, integration points
│   ├── screenshots/           # 36 high-res captures used in the deck
│   ├── Valmo_RTO_Shield_Prototype_Walkthrough.docx
│   └── Valmo_RTO_Shield_Prototype_Walkthrough.pdf
├── tests/e2e_smoke.py         # Playwright end-to-end test of every main flow
└── .github/workflows/pages.yml
```

## Configuration

Edit `assets/js/config.js` (or use the *Rules* panels in the UI for a live session):

| Key | Default | Meaning |
|---|---|---|
| `intent.confirmWindowHrs` | 12 | Time a high/medium-risk customer has to reply |
| `intent.holdHrs` | 6 | Hold before a silent high-risk order is auto-cancelled |
| `intent.thresholds` | medium 30, high 50 | Risk score cut-offs |
| `intent.weights` | see file | Points per risk factor |
| `incentive.geofenceM` | 100 | Max distance from pin for a valid attempt |
| `incentive.minCallSec` | 25 | Minimum connected masked-call length |
| `incentive.proofMode` | `any` | `any` = photo or call, `all` = photo and call |
| `incentive.attemptBonus` | 10 | Verified attempt bonus (₹) |
| `incentive.shiftAttemptCap` | 100 | Cap on attempt bonuses per shift (₹) |
| `tiers` | 4 tiers | Completion / RTO thresholds and multipliers |

## Testing

```bash
pip install playwright && playwright install chromium
python tests/e2e_smoke.py      # exits non-zero on any JavaScript error
```

## Impact (baseline from the proposal)

~588 M COD orders a year, 23.5% failing, ₹170 per RTO (₹50 forward + ₹120 reverse).

| Scenario | RTO cut | Failures avoided | Gross / year | Net / year* |
|---|---|---|---|---|
| Conservative | 10% | 13.8 M | ₹235 Cr | ₹178 Cr |
| Moderate | 20% | 27.6 M | ₹470 Cr | ₹413 Cr |
| Aggressive | 25% | 34.5 M | ₹586 Cr | ₹530 Cr |

\*After ₹0.12 messaging per order and a ₹7 average bonus on 12% of orders. Break-even at a 2.4% RTO cut.

## Note

This is a front-end prototype with simulated orders, customers, pilots and clock. No real customer data is used, and no messages are sent. Meesho and Valmo names are used for case-competition submission.
