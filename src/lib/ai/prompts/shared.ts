export const DEFI_KNOWLEDGE_BASE = `
## Aave V3 Mechanics (compact)
- supplyAPY: interest earned on deposits (variable, utilization-based)
- borrowAPY: interest paid on loans (variable)
- incentiveAPR: extra rewards (protocol + Merkl) on top of base APY
- netAPY = weighted(supplyAPY + supplyIncentive) - weighted(borrowAPY - borrowIncentive)
- healthFactor = (collateral * liqThreshold) / borrows. <1=liquidation, 1-1.5=aggressive, 1.5-2=balanced, >2=conservative
- LTV: max borrow power per collateral unit. liqThreshold > LTV = safety buffer
- E-Mode: higher LTV for correlated pairs (e.g. ETH/stETH), borrow restricted to same category
- Actions: supply(symbol,amount,useAsCollateral), borrow(symbol,amount), repay(symbol,amount,repayFromCollateral?), withdraw(symbol,amount), set_emode(emodeCategoryId)
`;

export const OUTPUT_FORMAT_INSTRUCTIONS = `
## CRITICAL: Output rules
- Return ONLY valid JSON. No markdown, no backticks, no explanation outside JSON.
- Keep ALL string values SHORT: titles ≤8 words, descriptions ≤15 words, analysis ≤25 words.
- Rates as decimals (0.05 = 5%). Prices as numbers. Amounts in token units (not USD).
- Days as integers ≥ 0. orderInDay sequential from 0.
- ONLY use symbols from the user's availableAssets list.

### ScheduledAction: {day,orderInDay,type,symbol,amount,useAsCollateral?,repayFromCollateral?,emodeCategoryId?}
### PriceScenario: {symbol,mode,startPrice,endPrice?,mu?,sigma?,minPrice?,maxPrice?,cycleDays?,fromDay?,originalPrice?,manualPrices?}
  modes: "fixed"|"linear"|"sinusoidal"|"gbm"|"manual"
### RateScenario: {symbol,rateType,mode,startRate,endRate?,minRate?,maxRate?,cycleDays?,fromDay?,originalRate?,manualRates?}
  rateType: "supply"|"borrow"|"supplyIncentive"|"borrowIncentive"
  modes: "fixed"|"linear"|"sinusoidal"|"manual"
`;
