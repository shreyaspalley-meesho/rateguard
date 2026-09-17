import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface CardProps extends ComponentPropsWithoutRef<'section'> {
  padded?: boolean;
  children: ReactNode;
}

function CardRoot({ padded = true, children, className = '', ...rest }: CardProps) {
  return (
    <section className={`card ${padded ? 'p-6' : ''} ${className}`.trim()} {...rest}>
      {children}
    </section>
  );
}

function CardHeader({ children, className = '', ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={`mb-4 pb-2 border-b border-black/8 ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

function CardBody({ children, className = '', ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ children, className = '', ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={`mt-4 pt-3 border-t border-black/8 ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
