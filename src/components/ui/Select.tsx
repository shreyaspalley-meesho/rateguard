import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface SelectProps extends ComponentPropsWithoutRef<'select'> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', invalid, children, ...rest },
  ref,
) {
  const cls = [
    'field-input',
    invalid ? 'border-[#B87500] bg-[#FFF7E8]' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <select ref={ref} className={cls} {...rest}>
      {children}
    </select>
  );
});
