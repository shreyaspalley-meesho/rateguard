import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface NumberInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  invalid?: boolean;
  rightAlign?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { className = '', invalid, rightAlign = true, inputMode = 'decimal', step = '0.01', ...rest },
  ref,
) {
  const cls = [
    'field-input num',
    rightAlign ? 'text-right' : '',
    invalid ? 'border-[#B87500] bg-[#FFF7E8]' : '',
    className,
  ].filter(Boolean).join(' ');
  return <input ref={ref} type="number" inputMode={inputMode} step={step} className={cls} {...rest} />;
});
