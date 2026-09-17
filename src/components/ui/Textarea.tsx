import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', invalid, rows = 3, ...rest },
  ref,
) {
  const cls = [
    'field-input',
    invalid ? 'border-[#B87500] bg-[#FFF7E8]' : '',
    className,
  ].filter(Boolean).join(' ');
  return <textarea ref={ref} rows={rows} className={cls} {...rest} />;
});
