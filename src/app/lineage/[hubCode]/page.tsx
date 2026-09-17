import { SEED_HUBS } from '@/lib/seed';
import Client from './Client';

export function generateStaticParams() {
  const seen = new Set<string>();
  const params: { hubCode: string }[] = [];
  for (const h of SEED_HUBS) {
    if (!seen.has(h.code)) {
      seen.add(h.code);
      params.push({ hubCode: h.code });
    }
  }
  return params;
}

export default async function Page({ params }: { params: Promise<{ hubCode: string }> }) {
  const { hubCode } = await params;
  return <Client hubCode={hubCode} />;
}
