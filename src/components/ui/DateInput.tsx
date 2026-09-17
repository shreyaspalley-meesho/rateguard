import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface DateInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  invalid?: boolean;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { className = '', invalid, ...rest },
  ref,
) {
  const cls = [
    'field-input',
    invalid ? 'border-[#B87500] bg-[#FFF7E8]' : '',
    className,
  ].filter(Boolean).join(' ');
  return <input ref={ref} type="date" className={cls} {...rest} />;
});
