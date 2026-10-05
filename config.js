/*
 * Valmo RTO Shield - business rules.
 * Every threshold, window, weight and bonus lives here so a hub or region can be
 * tuned without touching application code. Values can also be changed live from
 * the "Rules" panels in the UI (changes are in-memory for the session).
 */
window.VALMO_CONFIG = {
  intent: {
    confirmWindowHrs: 12, holdHrs: 6, reminderBeforeHrs: 4,
    thresholds: { medium: 30, high: 50 },
    weights: { firstTime: 30, nonStdAddress: 25, highRtoPin: 20, highValue: 15, pastRtoEach: 15, pastRtoMax: 2 },
    highValueAt: 800, forwardCost: 50, reverseCost: 120, upiDiscount: 10
  },
  incentive: {
    geofenceM: 100, minCallSec: 25, proofMode: 'any', attemptBonus: 10, shiftAttemptCap: 100,
    distance: [ { min: 5, max: 10, bonus: 10 }, { min: 10, max: Infinity, bonus: 20 } ],
    success: { standard: 5, highRto: 10, rural: 15 },
    callSpeed: 5, unansweredRingSec: 20, minutesPerStop: 12
  },
  tiers: [
    { name: 'Base', minCompletion: 0, maxRto: 100, mult: 1.0, perk: 'Standard pay' },
    { name: 'Performer', minCompletion: 85, maxRto: 12, mult: 1.1, perk: '+10% on all incentives, priority access to good routes' },
    { name: 'Pro', minCompletion: 90, maxRto: 8, mult: 1.25, perk: '+25% on all incentives, early access to high-density routes' },
    { name: 'Elite', minCompletion: 95, maxRto: 5, mult: 1.5, perk: '+50% on all incentives, priority support and rewards' }
  ]
};
