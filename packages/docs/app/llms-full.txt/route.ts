import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  // English only — other languages are reachable by swapping /en/ in page URLs
  const scan = source.getPages('en').map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
