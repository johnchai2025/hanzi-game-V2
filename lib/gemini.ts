const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const DASHSCOPE_IMAGE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const WAN_MODEL = 'wan2.6-t2i';
const NEGATIVE_PROMPT = '文字，汉字，拼音，字幕，标牌，水印，低分辨率，低画质，肢体畸形，构图混乱';

interface DashScopeImageResponse {
  output?: {
    choices?: Array<{ message?: { content?: Array<{ image?: string; text?: string }> } }>;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// DashScope 返回的图片 URL 仅 24 小时有效，必须立即下载转存，不能原样返回/持久化。
// 返回原始字节而不是 base64——调用方（lib/imageLibrary.ts）要用 sharp 压缩后落盘，
// base64 只是徒增一次编解码开销。
async function downloadImageBuffer(imgUrl: string): Promise<Buffer> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) throw new Error(`download failed: HTTP ${imgRes.status}`);
      return Buffer.from(await imgRes.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt);
    }
  }
  throw new Error(`图片已生成但下载失败（重试 ${MAX_ATTEMPTS} 次）: ${String(lastErr)}`);
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_MODEL_STORY = 'deepseek-v4-flash';

async function deepseekFetch(path: string, body: object) {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not configured');

  const res = await fetch(`${DEEPSEEK_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

// 角色固定为狐狸、不再传场景——场景由 AI 根据词意自己判断，这样同一个词的
// 提示词永远完全确定，是"一词一图、全局共享"的前提（否则场景随机会导致
// 同一个词在不同时刻生成出内容不一致的图，也可能出现"大海配太空"这类矛盾画面）。
export async function generateWordCardImage(word: string): Promise<Buffer> {
  if (!DASHSCOPE_API_KEY) throw new Error('DASHSCOPE_API_KEY is not configured');

  const prompt = `绘本插画风格，一只可爱的小狐狸，画面温馨地表现"${word}"这个中文词语的意思，背景和道具要贴合这个词本身的场景与含义。色彩鲜艳明亮，卡通可爱，适合6-8岁小朋友欣赏，构图简洁，画面中不要出现任何文字、汉字、拼音、字幕或标牌。`;

  const res = await fetch(DASHSCOPE_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DASHSCOPE_API_KEY}` },
    body: JSON.stringify({
      model: WAN_MODEL,
      input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
      parameters: {
        prompt_extend: true,
        watermark: false,
        n: 1,
        negative_prompt: NEGATIVE_PROMPT,
        size: '1280*1280',
      },
    }),
  });

  const data: DashScopeImageResponse = await res.json();
  if (!res.ok) {
    throw new Error(`wan2.6-t2i API error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const imgUrl = data.output?.choices?.[0]?.message?.content?.find((c) => c.image)?.image;
  if (!imgUrl) {
    throw new Error(`wan2.6-t2i returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return downloadImageBuffer(imgUrl);
}

const STORY_TYPES = [
  '探险冒险，主角在途中有意外发现',
  '帮助一个遇到麻烦的小伙伴，结局出人意料',
  '一个有趣的误会，最后被笑着解开',
  '发现了一个小秘密，结尾谜底令人惊喜',
  '遇到了一次小失败，却收获了更好的东西',
  '独自完成了一件有点难的事，心里满满自豪',
];

export async function generateStory(
  words: string[],
  animal: string,
  characterName: string,
  scene: string
): Promise<string> {
  const storyType = STORY_TYPES[Math.floor(Math.random() * STORY_TYPES.length)];

  const prompt = `你是专门为6-9岁中国小朋友创作故事的儿童文学作家，文笔活泼，善用拟声词和比喻。

【任务】用这${words.length}个词语：${words.join('、')}
为主角${characterName}（一只${animal}）写一个发生在${scene}的短故事。

【故事类型】${storyType}

【格式要求】
- 第一行写一个4-8字的故事标题，格式：《标题》
- 第二行起写故事正文，150-200字，分2-3自然段，段与段之间空一行

【创作要求】
- 每个词语在故事里出现至少1次，且真正推动情节（不是简单列举）
- 每个词语按照它在汉语里真实的语法用法出现：季节/时间词（春天、冬日等）做时间背景，抽象词做感受描写，不要把它们当成可以拿起或触碰的具体物品
- 故事有清晰的起因、转折、结局
- 加入${characterName}说的话或内心想法，用引号""标出
- 用生动的动作、颜色、声音描写，让画面栩栩如生
- 结局要出乎意料或温馨有趣，让小朋友想再读一遍

【禁止】不要用"走着走着""拍起手来""都是今天的新朋友"等套话；不要结尾列举词语总结；不要任何Markdown格式。

只输出标题行和故事正文，不要其他内容。`;

  const data = await deepseekFetch('/chat/completions', {
    model: DEEPSEEK_MODEL_STORY,
    messages: [{ role: 'user', content: prompt }],
    // deepseek-flash 默认是推理模型，写故事前的"思考"会吃掉 max_tokens 预算：
    // 实测推理常用 1600-8000 token，超出后 content 返回空，故事静默降级成本地模板。
    // 儿童故事不需要深度推理，直接关掉——耗时 31s→3s，输出 token 约降 35 倍。
    thinking: { type: 'disabled' },
    max_tokens: 4000,
    temperature: 0.9,
  });

  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) throw new Error('Empty response from DeepSeek API');
  return content;
}
