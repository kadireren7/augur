/** AUGD has 18 decimals. Indexed integer strings stay exact through JSON and rendering. */
export function formatAugd(amount: string | bigint | number): string {
  if (typeof amount === "number") {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid local token amount");
    return String(amount);
  }
  const value = String(amount);
  if (!/^\d+$/.test(value)) throw new Error("Invalid AUGD base-unit amount");
  const padded = BigInt(value).toString().padStart(19, "0");
  const whole = padded.slice(0, -18);
  const fraction = padded.slice(-18).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Display-only ratio. All accounting remains exact integers. */
export function poolPercentage(amount: string | number, total: string | number): number {
  const integer = (value: string | number) => typeof value === "number" ? BigInt(value) * 10n ** 18n : BigInt(value);
  const pool = integer(total);
  return pool === 0n ? 0 : Number(integer(amount) * 10000n / pool) / 100;
}
