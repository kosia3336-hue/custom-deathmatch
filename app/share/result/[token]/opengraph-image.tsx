import { loadResultShare } from '@/lib/share/loadResultShare';
import { renderResultCardImage } from '@/lib/share/resultCardImage';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '커스텀 데스매치 전적';

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return renderResultCardImage(await loadResultShare(token));
}
