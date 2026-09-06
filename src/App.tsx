import { useEffect, useMemo, useState } from 'react';
import {
  DISPLAY,
  Item,
  Mode,
  UNITS_FOR,
  Unit,
  formatMoney,
  formatPercent,
  rank,
} from './calc';

const MODE_LABELS: Record<Mode, string> = { weight: 'Weight', volume: 'Volume', each: 'Each / pack' };
const MAX_ITEMS = 5;

let seq = 0;
const uid = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

function newItem(unit: Unit): Item {
  return { id: uid(), name: '', price: '', size: '', unit, qty: '1' };
}

interface State {
  mode: Mode;
  items: Item[];
}

function defaultState(): State {
  return {
    mode: 'weight',
    items: [newItem('g'), newItem('g')],
  };
}

function readInitial(): State {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('c');
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(raw)))) as State;
      if (parsed.mode && Array.isArray(parsed.items) && parsed.items.length >= 2) {
        return { mode: parsed.mode, items: parsed.items.slice(0, MAX_ITEMS).map((i) => ({ ...newItem(i.unit), ...i, id: uid() })) };
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem('upc.state');
    if (stored) {
      const p = JSON.parse(stored) as State;
      if (p.mode && Array.isArray(p.items) && p.items.length >= 2) {
        return { mode: p.mode, items: p.items.map((i) => ({ ...i, id: uid() })) };
      }
    }
  } catch {
    /* ignore */
  }
  return defaultState();
}

export default function App() {
  const [state, setState] = useState<State>(readInitial);
  const [copied, setCopied] = useState(false);
  const { mode, items } = state;

  const ranked = useMemo(() => rank(items), [items]);
  const disp = DISPLAY[mode];
  const validCount = ranked.filter((r) => r.valid).length;
  const cheapest = ranked.find((r) => r.isCheapest);
  const priciest = useMemo(() => {
    const v = ranked.filter((r) => r.valid);
    return v.length > 1 ? v.reduce((a, b) => (b.perBase > a.perBase ? b : a)) : undefined;
  }, [ranked]);

  useEffect(() => {
    try {
      localStorage.setItem('upc.state', JSON.stringify(state));
    } catch {
      /* ignore */
    }
    try {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      const p = new URLSearchParams();
      p.set('c', payload);
      window.history.replaceState(null, '', `?${p.toString()}`);
    } catch {
      /* ignore */
    }
    setCopied(false);
  }, [state]);

  const setMode = (m: Mode) =>
    setState((s) => ({
      mode: m,
      items: s.items.map((i) => (UNITS_FOR[m].includes(i.unit) ? i : { ...i, unit: UNITS_FOR[m][0] })),
    }));

  const patch = (id: string, key: keyof Item, value: string) =>
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? ({ ...i, [key]: value } as Item) : i)),
    }));

  const addItem = () =>
    setState((s) => (s.items.length >= MAX_ITEMS ? s : { ...s, items: [...s.items, newItem(UNITS_FOR[s.mode][0])] }));

  const removeItem = (id: string) =>
    setState((s) => (s.items.length <= 2 ? s : { ...s, items: s.items.filter((i) => i.id !== id) }));

  const reset = () => setState(defaultState());

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: 'Unit price comparison', url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* cancelled */
    }
  };

  const letter = (n: number) => String.fromCharCode(65 + n);
  const savingPerSecondary =
    cheapest && priciest && priciest.id !== cheapest.id
      ? (priciest.perBase - cheapest.perBase) * disp.secondaryFactor
      : 0;

  return (
    <div className="app">
      <header className="hero">
        <h1>Unit Price Calculator</h1>
        <p className="tagline">
          Which one is actually cheaper? Compare the real cost per {mode === 'each' ? 'item' : disp.secondaryLabel.replace('per ', '')},
          even when the packs and units don’t match.
        </p>
      </header>

      <div className="mode" role="tablist" aria-label="What are you comparing?">
        {(['weight', 'volume', 'each'] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <main className="items">
        {items.map((it, idx) => {
          const r = ranked.find((x) => x.id === it.id)!;
          return (
            <section className={`item ${r.isCheapest ? 'best' : ''}`} key={it.id}>
              <div className="item-head">
                <input
                  className="name"
                  value={it.name}
                  onChange={(e) => patch(it.id, 'name', e.target.value)}
                  placeholder={`Item ${letter(idx)}`}
                  aria-label={`Item ${letter(idx)} name`}
                />
                {items.length > 2 && (
                  <button className="remove" aria-label={`Remove item ${letter(idx)}`} onClick={() => removeItem(it.id)}>
                    ✕
                  </button>
                )}
              </div>

              <div className={`fields ${mode === 'each' ? 'fields-each' : ''}`}>
                <label className="f-price">
                  <span>Price</span>
                  <div className="with-prefix">
                    <span>$</span>
                    <input
                      inputMode="decimal"
                      value={it.price}
                      onChange={(e) => patch(it.id, 'price', e.target.value)}
                      placeholder="0.00"
                      aria-label={`Item ${letter(idx)} price`}
                    />
                  </div>
                </label>

                <label className="f-size">
                  <span>{mode === 'each' ? 'Items' : 'Size'}</span>
                  <input
                    inputMode="decimal"
                    value={it.size}
                    onChange={(e) => patch(it.id, 'size', e.target.value)}
                    placeholder={mode === 'each' ? '12' : '500'}
                    aria-label={`Item ${letter(idx)} ${mode === 'each' ? 'item count' : 'size'}`}
                  />
                </label>

                {mode !== 'each' && (
                  <label className="f-unit">
                    <span>Unit</span>
                    <select value={it.unit} onChange={(e) => patch(it.id, 'unit', e.target.value)} aria-label={`Item ${letter(idx)} unit`}>
                      {UNITS_FOR[mode].map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                )}

                {mode !== 'each' && (
                  <label className="f-qty">
                    <span>Packs</span>
                    <input
                      inputMode="numeric"
                      value={it.qty}
                      onChange={(e) => patch(it.id, 'qty', e.target.value)}
                      placeholder="1"
                      aria-label={`Item ${letter(idx)} number of packs`}
                    />
                  </label>
                )}
              </div>

              <div className="verdict" aria-live="polite">
                {r.valid ? (
                  <>
                    <div className="unit-price">
                      <strong>{formatMoney(r.perBase * disp.primaryFactor)}</strong>
                      <span>{disp.primaryLabel}</span>
                    </div>
                    {mode !== 'each' && (
                      <div className="unit-price sub">
                        <strong>{formatMoney(r.perBase * disp.secondaryFactor)}</strong>
                        <span>{disp.secondaryLabel}</span>
                      </div>
                    )}
                    {validCount > 1 &&
                      (r.isCheapest ? (
                        <span className="badge best">Best value</span>
                      ) : (
                        <span className="badge">+{formatPercent(r.premium)}</span>
                      ))}
                  </>
                ) : (
                  <span className="hint">Enter a price and size to compare</span>
                )}
              </div>
            </section>
          );
        })}
      </main>

      <div className="controls">
        {items.length < MAX_ITEMS && (
          <button className="add" onClick={addItem}>+ Add another</button>
        )}
        <button className="ghost" onClick={reset}>Reset</button>
        <button className="ghost" onClick={share}>{copied ? 'Link copied ✓' : 'Share'}</button>
      </div>

      {cheapest && priciest && cheapest.id !== priciest.id && (
        <p className="summary">
          <strong>
            {items.find((i) => i.id === cheapest.id)?.name?.trim() ||
              `Item ${letter(items.findIndex((i) => i.id === cheapest.id))}`}
          </strong>{' '}
          is the best value — {formatPercent(priciest.premium)} cheaper than the priciest
          {mode !== 'each' && savingPerSecondary > 0 && (
            <>, saving {formatMoney(savingPerSecondary)} {disp.secondaryLabel}</>
          )}
          .
        </p>
      )}

      <p className="disclaimer">
        Works out the price per {disp.primaryLabel.replace('per ', '')}{mode !== 'each' && ` and ${disp.secondaryLabel.replace('per ', '')}`} so you can
        compare products of different sizes. “Packs” multiplies the size for multi-buys (e.g. a
        3-pack of 400g = size 400, packs 3). Nothing is stored or sent anywhere.
      </p>
    </div>
  );
}
