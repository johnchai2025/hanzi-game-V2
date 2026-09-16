import { NextRequest, NextResponse } from 'next/server';
import { generateWordCardImage } from '@/lib/gemini';
import { buildImageUrl, getExistingVersion, getOrCreateInFlight, isValidWord, saveCompressedImage } from '@/lib/imageLibrary';

export async function POST(request: NextRequest) {
  try {
    const { word, force } = await request.json();

    if (!isValidWord(word)) {
      return NextResponse.json({ error: 'word 必须是恰好两个汉字' }, { status: 400 });
    }

    // 图库命中：不是强制重生就直接返回，零成本、零等待——
    // 这是"每个词全局只生成一次"的核心。
    if (!force) {
      const existingVersion = await getExistingVersion(word);
      if (existingVersion !== null) {
        return NextResponse.json({ imageUrl: buildImageUrl(word, existingVersion) });
      }
    }

    // 未命中 或 主动要求换一张：调百炼生图，压缩后落盘覆盖。
    // 用 in-flight Map 去重，避免同一个词并发触发多次计费。
    const version = await getOrCreateInFlight(word, async () => {
      const rawImage = await generateWordCardImage(word);
      return saveCompressedImage(word, rawImage);
    });

    return NextResponse.json({ imageUrl: buildImageUrl(word, version) });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
