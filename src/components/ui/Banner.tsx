import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type BannerTone = 'green' | 'amber' | 'red' | 'purple' | 'grey';

export interface BannerProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  tone: BannerTone;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}

const TONE_CLASS: Record<BannerTone, string> = {
  green: 'banner banner-green',
  amber: 'banner banner-amber',
  red: 'banner banner-red',
  purple: 'banner banner-purple',
  grey: 'banner banner-grey',
};

export function Banner({ tone, icon, title, children, className = '', ...rest }: BannerProps) {
  return (
    <div className={`${TONE_CLASS[tone]} ${className}`.trim()} {...rest}>
      {icon}
      <div>
        {title !== undefined && <div className="font-semibold">{title}</div>}
        {children && <div className={title !== undefined ? 'text-xs mt-1 opacity-80' : ''}>{children}</div>}
      </div>
    </div>
  );
}
