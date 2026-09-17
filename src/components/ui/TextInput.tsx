import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface TextInputProps extends ComponentPropsWithoutRef<'input'> {
  mono?: boolean;
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className = '', mono, invalid, type = 'text', ...rest },
  ref,
) {
  const cls = [
    'field-input',
    mono ? 'num' : '',
    invalid ? 'border-[#B87500] bg-[#FFF7E8]' : '',
    className,
  ].filter(Boolean).join(' ');
  return <input ref={ref} type={type} className={cls} {...rest} />;
});
