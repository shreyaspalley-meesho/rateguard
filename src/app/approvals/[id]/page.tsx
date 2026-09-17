import { SEED_REQUESTS } from '@/lib/seed';
import Client from './Client';

export function generateStaticParams() {
  return SEED_REQUESTS.map(r => ({ id: r.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Client id={id} />;
}
