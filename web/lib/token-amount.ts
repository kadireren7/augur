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
