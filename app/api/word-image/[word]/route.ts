import { NextRequest, NextResponse } from 'next/server';
import { isValidWord, readImage } from '@/lib/imageLibrary';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ word: string }> }) {
  const { word: rawWord } = await params;
  const word = decodeURIComponent(rawWord);

  if (!isValidWord(word)) {
    return NextResponse.json({ error: 'word 必须是恰好两个汉字' }, { status: 400 });
  }

  const image = await readImage(word);
  if (!image) {
    return NextResponse.json({ error: '图片不存在' }, { status: 404 });
  }

  // URL 带 ?v=<版本号>，同一个 URL 内容永远不变，可以放心让浏览器长期缓存；
  // "换一张图"会生成新版本号、拼出新 URL，天然绕开旧缓存，不用去清 CDN/浏览器缓存。
  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
