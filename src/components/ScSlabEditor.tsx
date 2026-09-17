'use client';

import type { Tier } from '@/lib/types';
import {
  computeBlended,
  tierAscendingViolations,
} from '@/lib/blended';

const MAX_TIERS = 10;

export interface ScSlabEditorProps {
  tiers: Tier[];
  onChange: (next: Tier[]) => void;
  unit: 'shipment' | 'bag';
  mobile?: boolean;
}

export function ScSlabEditor({ tiers, onChange, unit, mobile }: ScSlabEditorProps) {
  const blended = computeBlended(tiers);
  const ascendingBad = tierAscendingViolations(tiers);
  const atMax = tiers.length >= MAX_TIERS;

  function updateTier(i: number, patch: Partial<Tier>) {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    onChange(next);
  }

  function addTier() {
    if (atMax) return;
    // The prior last tier had upTo:null (open-ended). Give it a numeric upTo
    // (bumped from the previous-previous tier's upTo) so the new row can be
    // the open-ended top.
    const last = tiers[tiers.length - 1];
    const prevPrev = tiers[tiers.length - 2];
    const bumpFrom =
      prevPrev && typeof prevPrev.upTo === 'number' ? prevPrev.upTo : 0;
    const promoted: Tier = {
      ...last,
      upTo: last.upTo === null ? bumpFrom + 5000 : last.upTo,
    };
    const newRow: Tier = { upTo: null, rate: 0 };
    const next = [...tiers.slice(0, -1), promoted, newRow];
    onChange(next);
  }

  function removeTier(i: number) {
    if (tiers.length <= 1) return;
    const next = tiers.filter((_, idx) => idx !== i);
    // Ensure the last row is always open-ended.
    if (next.length > 0) {
      const lastIdx = next.length - 1;
      if (next[lastIdx].upTo !== null) {
        next[lastIdx] = { ...next[lastIdx], upTo: null };
      }
    }
    onChange(next);
  }

  return (
    <div className="space-y-3" data-testid="sc-slab-editor">
      {!mobile && (
        <div className="grid grid-cols-[36px_1fr_1fr_1fr_36px] gap-3 items-center text-[10px] uppercase tracking-wider text-black/50 pb-2 border-b border-black/8">
          <div>#</div>
          <div>Up to ({unit}s)</div>
          <div>Rate ₹</div>
          <div>Blended ₹</div>
          <div />
        </div>
      )}

      {tiers.map((t, i) => {
        const isLast = i === tiers.length - 1;
        const isOpen = t.upTo === null;
        const b = blended[i];
        const ascendingErr = ascendingBad[i];

        if (mobile) {
          return (
            <div
              key={i}
              className={`rounded-lg border p-3 ${
                ascendingErr
                  ? 'border-[#B00020] bg-[#FFF3F5]'
                  : 'border-black/10 bg-white'
              }`}
              data-testid={`sc-slab-row-${i}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="mono text-[11px] text-black/50">Tier {i + 1}</div>
                <button
                  type="button"
                  className={`text-black/40 hover:text-black/70 min-w-[44px] min-h-[44px] flex items-center justify-center ${tiers.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  onClick={() => removeTier(i)}
                  aria-label={`Remove tier ${i + 1}`}
                  disabled={tiers.length <= 1}
                >
                  ×
                </button>
              </div>
              <div className="mb-3">
                <label className="field-label">Up to ({unit}s)</label>
                {isOpen ? (
                  <div className="field-input bg-black/[.04] text-black/60 flex items-center !text-[16px] !py-3">
                    No upper limit
                  </div>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    className={`field-input num !text-[16px] !py-3 ${ascendingErr ? 'border-[#B00020]' : ''}`}
                    value={t.upTo ?? ''}
                    onChange={e =>
                      updateTier(i, {
                        upTo: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="e.g. 5,000"
                  />
                )}
                {ascendingErr && (
                  <div className="text-[11px] text-[#B00020] mt-1">
                    Must be greater than previous tier
                  </div>
                )}
              </div>
              <div className="mb-3">
                <label className="field-label">Rate ₹</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="field-input num text-right !text-[16px] !py-3"
                  value={t.rate || ''}
                  onChange={e =>
                    updateTier(i, { rate: Number(e.target.value) })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/50 mb-1">
                  Blended <span className="opacity-60">· derived</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F6EDF3] text-[#580A46] mono text-[13px]">
                  {b !== null ? `₹${b.toFixed(2)}` : '—'}
                  <span className="text-[9px] uppercase tracking-wider opacity-70">
                    derived
                  </span>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={i} data-testid={`sc-slab-row-${i}`}>
            <div className="grid grid-cols-[36px_1fr_1fr_1fr_36px] gap-3 items-center py-2">
              <div className="mono text-[12px] text-black/45">{i + 1}</div>
              <div>
                {isOpen ? (
                  <div className="field-input bg-black/[.04] text-black/60 flex items-center">
                    No upper limit
                  </div>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    className={`field-input num ${ascendingErr ? 'border-[#B00020] bg-[#FFF3F5]' : ''}`}
                    value={t.upTo ?? ''}
                    onChange={e =>
                      updateTier(i, {
                        upTo: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="e.g. 5000"
                    data-testid={`sc-slab-upto-${i}`}
                  />
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className="field-input num text-right"
                value={t.rate || ''}
                onChange={e => updateTier(i, { rate: Number(e.target.value) })}
                placeholder="0.00"
                data-testid={`sc-slab-rate-${i}`}
              />
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F6EDF3] text-[#580A46] mono text-[12.5px] w-fit">
                {b !== null ? `₹${b.toFixed(2)}` : '—'}
                <span className="text-[9px] uppercase tracking-wider opacity-70">
                  derived
                </span>
              </div>
              <button
                type="button"
                className={`text-black/40 hover:text-black/70 text-center ${tiers.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                onClick={() => removeTier(i)}
                aria-label={`Remove tier ${i + 1}`}
                disabled={tiers.length <= 1}
              >
                ×
              </button>
            </div>
            {ascendingErr && (
              <div
                className="text-[11px] text-[#B00020] pl-[48px] pb-2"
                data-testid={`sc-slab-ascending-err-${i}`}
              >
                Must be greater than previous tier
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost text-[13px]"
          onClick={addTier}
          disabled={atMax}
          data-testid="sc-slab-add"
        >
          + Add tier
        </button>
        <span className="text-[11px] text-black/50">
          {atMax
            ? 'Ten is the maximum'
            : `${tiers.length} of ${MAX_TIERS} tiers · KRD §2.1.1`}
        </span>
      </div>
    </div>
  );
}

export { MAX_TIERS };
