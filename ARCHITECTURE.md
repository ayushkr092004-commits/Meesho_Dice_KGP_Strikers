# Architecture

The prototype is deliberately dependency-free so it can be read in one sitting and lifted into the Valmo codebase piece by piece. `app.js` is organised into numbered sections that map to production services.

| Section in `app.js` | Production equivalent |
|---|---|
| 6. Risk engine (`scoreRisk`) | Stateless scoring service, called on `seller.order_ready` |
| 7. Intent flow (`markReady`, `runAction`, `processClock`) | Intent orchestrator + scheduler (timeouts) |
| 8. Channel renderers (WhatsApp, SMS) | Channel adapters behind one action contract |
| 9. Incentive engine (`evaluateAttempt`, `computeIncentive`) | Pure functions in the payout service |
| 10. Pilot app | Screens inside the existing Valmo Pilot app |
| 11. Impact model | Business case calculator |

## Intent state machine

```
READY ──markReady──► risk scored
   ├─ low ───────────► AUTO_CLEARED ─────────────► (allocated)
   └─ medium / high ─► AWAITING  (fm.allocate gated)
         ├─ confirm / addr ok ─────► CONFIRMED ──► (allocated)
         ├─ change date ───────────► RESCHEDULED ► (allocated)
         ├─ cancel ─► no cash ─► UPI ► PREPAID ──► (allocated)
         │                  └─► decline ─► CANCELLED
         ├─ cancel (other reason) ──► CANCELLED   (₹170 avoided)
         └─ window expires
               ├─ medium ─► DISPATCH_UNCONFIRMED (pilot calls first)
               └─ high ───► HELD ──(hold expires)──► AUTO_CANCELLED (₹170 avoided)
                              └─ confirm ─► CONFIRMED
```

## Verification gate (Attempt Rewards)

```
verified = insideGeofence AND proof
proof    = proofMode == "any" ? (photoOk OR callOk) : (photoOk AND callOk)
photoOk  = photo captured AND hash not seen before
callOk   = call connected AND duration >= minCallSec
```

Outside the geofence an attempt cannot be submitted. Inside but without proof, it is logged with no bonus and flagged for hub review.

## Incentive calculation

```
lines  = delivered ? [zone success bonus] : verified && difficultParcel && !alreadyPaid ? [attempt bonus] : []
lines += distance bonus (once per parcel, on delivery or verified attempt)
each line × tier multiplier, rounded
attempt line limited by remaining per-shift cap
```

## Event catalogue

| Event | Emitted when |
|---|---|
| `seller.order_ready` | Seller marks a COD order ready (existing OMS event) |
| `intent.risk_scored` | Score, tier and factors computed |
| `intent.message_sent` | Template sent on WhatsApp or SMS |
| `fm.allocation_gated` | First-mile allocation held pending intent |
| `intent.customer_reply` | Any customer action |
| `address.check_requested` / `address.verified` / `address.pin_corrected` / `address.callback_requested` | Address flow |
| `intent.confirmed` / `intent.rescheduled` | Customer commits |
| `intent.prepaid_offer_shown` / `payment.cod_converted_to_prepaid` | UPI redirect |
| `intent.cancelled` / `intent.auto_cancelled` | Stopped before dispatch, with `rtoCostAvoided` |
| `intent.reminder_sent` / `intent.hold_placed` / `intent.window_expired` | Timeouts |
| `fm.partner_allocated` / `fm.allocation_released` | First-mile hand-off |
| `attempt.submitted` | Pilot submits an attempt (GPS, call, photo hash, verification, incentive lines) |
| `payout.ledger_credited` | Incentive credited to the daily payout |

## Integration points

- **Input:** existing `seller.order_ready` event; no seller-side change.
- **Gate:** `fm.allocate` waits for `intent.confirmed`, a reschedule, prepaid conversion, low-risk auto-clear, or the medium-risk timeout.
- **Shared record:** risk tier and intent status are written to the shipment, read by the Pilot app for priority and bonus eligibility.
- **Channels:** WhatsApp Business utility template primary, SMS fallback; IVR can be added as another adapter against the same action set.
- **Scale:** rules are data (`config.js`), so they can move to a per-hub or per-pincode config service for A/B tests.
