import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface ComboboxItem {
  id: string;
  label: string;
  hint?: string;
}

export interface ComboboxProps extends Omit<ComponentPropsWithoutRef<'input'>, 'onChange' | 'value'> {
  items: ComboboxItem[];
  value: string;
  onChange: (v: string) => void;
  listId?: string;
}

export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { items, value, onChange, listId = 'combobox-list', className = '', ...rest },
  ref,
) {
  return (
    <>
      <input
        ref={ref}
        className={`field-input ${className}`.trim()}
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        {...rest}
      />
      <datalist id={listId}>
        {items.map(item => (
          <option key={item.id} value={item.label}>{item.hint}</option>
        ))}
      </datalist>
    </>
  );
});
