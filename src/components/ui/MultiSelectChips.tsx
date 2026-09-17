import type { ReactNode } from 'react';
import { Banner } from './Banner';

export interface MultiSelectChipsOption<V extends string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
}

export interface MultiSelectChipsProps<V extends string> {
  options: Array<MultiSelectChipsOption<V>>;
  value: V[];
  onChange: (v: V[]) => void;
  validate?: (v: V[]) => string | null;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function MultiSelectChips<V extends string>({
  options, value, onChange, validate, columns = 2, className = '',
}: MultiSelectChipsProps<V>) {
  function toggle(v: V) {
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else onChange([...value, v]);
  }
  const err = validate ? validate(value) : null;
  const colsCls = ({ 1: 'grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const)[columns];
  return (
    <div className={className}>
      <div className={`grid grid-cols-1 ${colsCls} gap-2`}>
        {options.map(opt => {
          const on = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`text-left p-3 rounded-md border transition ${on ? 'border-[#580A46] bg-[#F5E8F0]' : 'border-black/10 hover:border-black/25'}`}
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={on} readOnly className="h-4 w-4 accent-[#580A46] pointer-events-none" />
                <span className="font-semibold text-sm">{opt.label}</span>
              </div>
              {opt.description && <div className="text-[11px] text-black/60 mt-1 ml-6">{opt.description}</div>}
            </button>
          );
        })}
      </div>
      {err && (
        <Banner tone="red" className="mt-3 text-[13px]" title="Rule violated">{err}</Banner>
      )}
    </div>
  );
}
