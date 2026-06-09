/**
 * Format a token quantity:
 * - >= 1: 2 decimals, space as thousands separator (1 138.84)
 * - < 1 and > 0: 2 significant digits after leading zeros (0.000023)
 * - <= 0 or NaN: "0"
 */
export function formatQty(value: number): string {
  if (!isFinite(value) || value <= 0) return "0";

  if (value >= 1) {
    const parts = value.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.join(".");
  }

  // Very small: scientific notation
  if (value < 1e-8) {
    return value.toExponential(1);
  }

  // < 1: show 2 significant digits after leading zeros
  const s = value.toFixed(20);
  const match = s.match(/^0\.(0*)(\d)/);
  if (!match) return value.toPrecision(2);

  const leadingZeros = match[1].length;
  return value.toFixed(leadingZeros + 2);
}

/**
 * Format a USD amount:
 * - 2 decimals, comma thousands separator ($2,252,103.07)
 * - Non-finite: "-"
 */
export function formatUSD(value: number): string {
  if (!isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs > 0 && abs < 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format an APY value (decimal to percentage string).
 * e.g. 0.0193 → "1.93%"
 */
export function formatAPY(value: number | undefined): string {
  if (value === undefined || !isFinite(value)) return "-";
  return (value * 100).toFixed(2) + "%";
}

/**
 * Format a percentage (decimal to percentage string).
 * e.g. 0.75 → "75.00%"
 */
export function formatPercent(value: number): string {
  if (!isFinite(value)) return "-";
  return (value * 100).toFixed(2) + "%";
}
