import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: ReactNode;
  helpText?: ReactNode;
  required?: boolean;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, helpText, required, error, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="field-label">
        {label}
        {required && <span className="text-[#B02B2B]"> *</span>}
      </label>
      {children}
      {helpText && !error && <div className="text-[11px] text-black/50 mt-1">{helpText}</div>}
      {error && <div className="text-[11px] text-[#B02B2B] mt-1">{error}</div>}
    </div>
  );
}
