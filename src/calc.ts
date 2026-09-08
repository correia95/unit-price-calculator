export type Mode = 'weight' | 'volume' | 'each';
export type Unit = 'g' | 'kg' | 'mL' | 'L' | 'item';

export const UNITS_FOR: Record<Mode, Unit[]> = {
  weight: ['g', 'kg'],
  volume: ['mL', 'L'],
  each: ['item'],
};

// Multiplier to the mode's base unit (g, mL, or item).
const TO_BASE: Record<Unit, number> = { g: 1, kg: 1000, mL: 1, L: 1000, item: 1 };

export interface Item {
  id: string;
  name: string;
  price: string; // raw input
  size: string; // raw input
  unit: Unit;
  qty: string; // raw input, packs / multi-buy count
}

export interface Computed {
  id: string;
  valid: boolean;
  /** price per single base unit (per g / per mL / per item) */
  perBase: number;
  totalBase: number; // total quantity in base units
  price: number;
}

export interface ModeDisplay {
  primaryLabel: string; // e.g. "per 100 g"
  primaryFactor: number; // multiply perBase by this
  secondaryLabel: string; // e.g. "per kg"
  secondaryFactor: number;
}

export const DISPLAY: Record<Mode, ModeDisplay> = {
  weight: { primaryLabel: 'per 100g', primaryFactor: 100, secondaryLabel: 'per kg', secondaryFactor: 1000 },
  volume: { primaryLabel: 'per 100mL', primaryFactor: 100, secondaryLabel: 'per L', secondaryFactor: 1000 },
  each: { primaryLabel: 'per item', primaryFactor: 1, secondaryLabel: 'per item', secondaryFactor: 1 },
};

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function compute(item: Item): Computed {
  const price = num(item.price);
  const size = num(item.size);
  const qty = Math.max(1, num(item.qty) || 1);
  const totalBase = size * qty * (TO_BASE[item.unit] ?? 1);
  const valid = price > 0 && totalBase > 0;
  return {
    id: item.id,
    valid,
    price,
    totalBase,
    perBase: valid ? price / totalBase : Infinity,
  };
}

export interface Ranked extends Computed {
  rank: number | null; // 1 = cheapest among valid
  isCheapest: boolean;
  /** fraction more expensive than the cheapest valid item (0 for the cheapest) */
  premium: number;
}

export function rank(items: Item[]): Ranked[] {
  const computed = items.map(compute);
  const valid = computed.filter((c) => c.valid).sort((a, b) => a.perBase - b.perBase);
  const cheapest = valid[0]?.perBase ?? Infinity;
  const orderById = new Map(valid.map((c, i) => [c.id, i + 1]));

  return computed.map((c) => {
    const r = orderById.get(c.id) ?? null;
    return {
      ...c,
      rank: r,
      isCheapest: r === 1 && valid.length > 1,
      premium: c.valid && cheapest > 0 && Number.isFinite(cheapest) ? c.perBase / cheapest - 1 : 0,
    };
  });
}

// Currency comparison here is ratio-based, so the symbol is cosmetic — pick it
// from the viewer's locale rather than forcing one, and let Intl choose the
// grouping/decimal style to match.
const REGION_CCY: Record<string, string> = {
  AU: 'AUD', US: 'USD', GB: 'GBP', CA: 'CAD', NZ: 'NZD', IN: 'INR', SG: 'SGD',
  ZA: 'ZAR', JP: 'JPY', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
  NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR',
};

function localCurrency(): string {
  try {
    const langs =
      typeof navigator !== 'undefined' && navigator.languages && navigator.languages.length
        ? navigator.languages
        : [typeof navigator !== 'undefined' ? navigator.language : 'en-AU'];
    for (const l of langs) {
      let region: string | undefined;
      try {
        region = new Intl.Locale(l).maximize().region;
      } catch {
        region = (l.split('-')[1] || '').toUpperCase() || undefined;
      }
      if (region && REGION_CCY[region]) return REGION_CCY[region];
    }
  } catch {
    /* ignore */
  }
  return 'AUD';
}

const CCY = localCurrency();

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const digits = abs > 0 && abs < 1 ? (abs < 0.1 ? 3 : 2) : 2;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: CCY,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(n: number): string {
  return (n * 100).toLocaleString('en-AU', { maximumFractionDigits: n < 0.1 ? 1 : 0 }) + '%';
}
