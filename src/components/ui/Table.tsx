import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  width?: string;
}

export interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  emptyMessage?: ReactNode;
  rowKey: (row: T, i: number) => string;
  className?: string;
}

export function Table<T>({ columns, rows, emptyMessage = 'No records.', rowKey, className = '' }: TableProps<T>) {
  if (rows.length === 0) {
    return <div className={`text-sm text-black/50 py-6 text-center ${className}`.trim()}>{emptyMessage}</div>;
  }
  return (
    <table className={`w-full text-sm ${className}`.trim()}>
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-black/50 border-b border-black/8">
          {columns.map(c => (
            <th key={c.key} className={`py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`} style={c.width ? { width: c.width } : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={rowKey(row, i)} className="border-b border-black/5">
            {columns.map(c => {
              const raw = c.render
                ? c.render(row)
                : (row as unknown as Record<string, ReactNode>)[c.key];
              return (
                <td key={c.key} className={`py-2 ${c.align === 'right' ? 'text-right' : ''} ${c.mono ? 'mono' : ''}`}>
                  {raw}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
