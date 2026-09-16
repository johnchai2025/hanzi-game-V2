// 客户端请求词卡图片的共享封装。生图和图鉴里的"换一张图"都走这里，
// 避免同一份 fetch 逻辑抄两份。
export async function fetchWordImage(word: string, force = false): Promise<{ imageUrl: string; error?: string }> {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, force }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${text}`);
    }
    const data = await response.json();
    return { imageUrl: data.imageUrl ?? '' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { imageUrl: '', error: msg };
  }
}
