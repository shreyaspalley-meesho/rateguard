import type { ReactNode } from 'react';

export interface KeyValueProps {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

export function KeyValue({ label, value, mono, align = 'left', className = '' }: KeyValueProps) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase text-black/50 mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? 'mono' : ''} ${align === 'right' ? 'text-right' : ''}`.trim()}>{value}</div>
    </div>
  );
}
