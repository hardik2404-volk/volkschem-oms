// ============================================================================
// VOLKSCHEM OMS — Ampoule Packaging Structure Constants
// ============================================================================
// These values come directly from the ampoule quotation PDF specifications.
// They define how many ampoule pieces each packaging component holds.
// Used for cost-per-piece division in the component cost calculator.
// ============================================================================

const AMPOULE_PACKAGING = {
  '20ml': { trayPcs: 5,  fbbBoxPcs: 5,  innerBoxPcs: 50,  outerBoxPcs: 200 },
  '15ml': { trayPcs: 5,  fbbBoxPcs: 5,  innerBoxPcs: 50,  outerBoxPcs: 200 },
  '10ml': { trayPcs: 10, fbbBoxPcs: 10, innerBoxPcs: 100, outerBoxPcs: 200 },
  '5ml':  { trayPcs: 10, fbbBoxPcs: 10, innerBoxPcs: 250, outerBoxPcs: 500 },
  '2ml':  { trayPcs: 10, fbbBoxPcs: 10, innerBoxPcs: 250, outerBoxPcs: 500 },
};

module.exports = { AMPOULE_PACKAGING };
