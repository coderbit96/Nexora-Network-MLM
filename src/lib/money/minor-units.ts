const MINOR_UNITS_PER_CURRENCY_UNIT = 100n;

/** Converts a trusted decimal string to integer minor units without floating-point math. */
export function decimalToMinorUnits(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("Amount must contain at most two decimal places.");
  }

  const negative = value.startsWith("-");
  const [wholePart, fractionPart = ""] = value.replace("-", "").split(".");
  const minor = BigInt(wholePart) * MINOR_UNITS_PER_CURRENCY_UNIT + BigInt(fractionPart.padEnd(2, "0"));
  return negative ? -minor : minor;
}

export function minorUnitsToDecimal(value: bigint): string {
  const negative = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${negative}${absolute / MINOR_UNITS_PER_CURRENCY_UNIT}.${(absolute % MINOR_UNITS_PER_CURRENCY_UNIT).toString().padStart(2, "0")}`;
}
