import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  n?: string;
  title: ReactNode;
  hint?: ReactNode;
}

export function SectionHeader({ n, title, hint }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-black/8">
      {n !== undefined && (
        <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-[#580A46] text-white">{n}</span>
      )}
      <h2 className="font-semibold text-[15px]">{title}</h2>
      {hint && <span className="text-xs text-black/50">{hint}</span>}
    </div>
  );
}
