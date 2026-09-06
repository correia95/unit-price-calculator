# unit-price-calculator

Compare the real cost of products per 100g, per kg, per 100mL, per litre or per item — across
different pack sizes and multi-buys. Enter price + size for two to five products; it flags the
best value and how much you save. 100% client-side, no tracking.

**Live:** https://unit-price-calculator.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker (`wrangler.jsonc`)

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy   # build + wrangler deploy (needs CLOUDFLARE_API_TOKEN in env)
```

## How it works

- [`src/calc.ts`](src/calc.ts) — normalises each item to a base unit (g / mL / item),
  computes price-per-base, ranks valid items, and reports the premium over the cheapest.
- Three modes (weight / volume / each); "Packs" multiplies size for multi-buys.
- Comparison state is kept in `localStorage` and encoded in the URL (`?c=` base64) for sharing.
