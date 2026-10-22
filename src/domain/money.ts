/** Kwoty trzymamy w groszach, żeby 333,33 zł nie rozjeżdżało się przy sumowaniu. */
export function zl(zloty: number): number {
  return Math.round(zloty * 100);
}

export function formatMoney(grosze: number): string {
  const sign = grosze < 0 ? "−" : "";
  const abs = Math.abs(grosze);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${fraction.toString().padStart(2, "0")}`;
}

export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(/zł/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** Jak `parseMoney`, ale dopuszcza 0 (np. edycja wpisu → usunięcie). */
export function parseMoneyAllowZero(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(/zł/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Wartość do pola input (bez spacji grupujących). */
export function moneyInputValue(grosze: number): string {
  const abs = Math.abs(grosze);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  return `${whole},${fraction.toString().padStart(2, "0")}`;
}

export function parsePercent(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace("%", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}
