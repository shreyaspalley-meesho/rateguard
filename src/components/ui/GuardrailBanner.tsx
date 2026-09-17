import type { GuardrailVerdict } from '@/lib/guardrail';
import { Banner, type BannerTone } from './Banner';

const TONE_FOR: Record<GuardrailVerdict['status'], BannerTone> = {
  within: 'green',
  breach: 'amber',
  'no-ceiling': 'purple',
  'not-applicable': 'purple',
};

export interface GuardrailBannerProps {
  verdict: GuardrailVerdict;
  className?: string;
}

export function GuardrailBanner({ verdict, className }: GuardrailBannerProps) {
  const noCeiling = verdict.status === 'no-ceiling' || verdict.status === 'not-applicable';
  return (
    <Banner
      tone={TONE_FOR[verdict.status]}
      className={className}
      title={noCeiling ? 'No ceiling set — routes to BizFin' : verdict.reason}
    >
      Guardrail {verdict.version} · Route on submit: <strong>{verdict.route}</strong>
    </Banner>
  );
}
