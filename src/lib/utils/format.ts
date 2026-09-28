export function formatCurrency(
  amountMinor: bigint | number | string,
  currency = "INR",
  locale = "en-IN",
) {
  const minor = BigInt(amountMinor);
  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  const whole = (absolute / 100n).toString();
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  // Keep formatting integer-derived: converting a large ledger balance to Number loses cents.
  const grouped = locale === "en-IN"
    ? whole.length <= 3 ? whole : `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`
    : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = currency === "INR" ? "₹" : `${currency} `;
  return `${sign}${prefix}${grouped}.${fraction}`;
}

export function formatDate(value: Date | string, locale = "en-IN") {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string, locale = "en-IN") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
