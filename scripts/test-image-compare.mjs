// 生图效果对比测试脚本：wanx2.0-t2i-turbo vs wan2.6-t2i vs 现有 Gemini
// 用法：node --env-file=.env.local scripts/test-image-compare.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const proxyDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

const OUT_DIR = new URL('../test-output/image-compare/', import.meta.url);

const TEST_CASES = [
  { word: '月亮' },
  { word: '风筝' },
  { word: '雪人' },
  { word: '大海' },
];

const NEGATIVE_PROMPT = '文字，汉字，拼音，字幕，标牌，水印，低分辨率，低画质，肢体畸形，构图混乱';

// 角色固定为狐狸、不传场景——跟 lib/gemini.ts 的生产提示词保持一致
// （场景由 AI 根据词意自己判断，不再随机指定，见 lib/gemini.ts 顶部注释）
function buildPrompt(word) {
  return `绘本插画风格，一只可爱的小狐狸，画面温馨地表现"${word}"这个中文词语的意思，背景和道具要贴合这个词本身的场景与含义。色彩鲜艳明亮，卡通可爱，适合6-8岁小朋友欣赏，构图简洁，画面中不要出现任何文字、汉字、拼音、字幕或标牌。`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function proxiedFetch(url, options) {
  if (proxyDispatcher) {
    return undiciFetch(url, { ...options, dispatcher: proxyDispatcher });
  }
  return fetch(url, options);
}

async function saveFromUrl(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filepath, buf);
}

async function saveFromBase64(b64, filepath) {
  await writeFile(filepath, Buffer.from(b64, 'base64'));
}

// ---------- wanx2.0-t2i-turbo（异步：创建任务 + 轮询） ----------
async function generateWanx20(prompt) {
  const createRes = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wanx2.0-t2i-turbo',
        input: { prompt, negative_prompt: NEGATIVE_PROMPT },
        parameters: { size: '1024*1024', n: 1 },
      }),
    }
  );
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`创建任务失败: ${JSON.stringify(createData)}`);
  }
  const taskId = createData.output?.task_id;
  if (!taskId) throw new Error(`未返回 task_id: ${JSON.stringify(createData)}`);

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const pollRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${DASHSCOPE_API_KEY}` },
    });
    const pollData = await pollRes.json();
    const status = pollData.output?.task_status;
    if (status === 'SUCCEEDED') {
      const imgUrl = pollData.output?.results?.[0]?.url;
      if (!imgUrl) throw new Error(`任务成功但无图片URL: ${JSON.stringify(pollData)}`);
      return imgUrl;
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`任务${status}: ${JSON.stringify(pollData)}`);
    }
  }
  throw new Error('轮询超时（90秒未完成）');
}

// ---------- wan2.6-t2i（同步调用） ----------
async function generateWan26(prompt) {
  const res = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'wan2.6-t2i',
        input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
        parameters: {
          prompt_extend: true,
          watermark: false,
          n: 1,
          negative_prompt: NEGATIVE_PROMPT,
          size: '1280*1280',
        },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`wan2.6-t2i 调用失败: ${JSON.stringify(data)}`);
  const imgUrl = data.output?.choices?.[0]?.message?.content?.find((c) => c.image)?.image;
  if (!imgUrl) throw new Error(`未返回图片: ${JSON.stringify(data)}`);
  return imgUrl;
}

// ---------- Gemini（现有生产方案，作为基线对照） ----------
async function generateGemini(prompt) {
  const res = await proxiedFetch(
    `${GEMINI_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart?.inlineData) throw new Error(`Gemini 未返回图片: ${JSON.stringify(data).slice(0, 200)}`);
  return imagePart.inlineData.data; // base64
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const report = [];

  for (const { word } of TEST_CASES) {
    const prompt = buildPrompt(word);
    console.log(`\n=== ${word} ===`);
    console.log(`prompt: ${prompt}`);

    const tasks = [
      {
        name: 'wanx2.0-t2i-turbo',
        run: () => generateWanx20(prompt).then((url) => ({ kind: 'url', data: url })),
      },
      {
        name: 'wan2.6-t2i',
        run: () => generateWan26(prompt).then((url) => ({ kind: 'url', data: url })),
      },
      DASHSCOPE_API_KEY && GEMINI_API_KEY
        ? { name: 'gemini-3.1-flash-image', run: () => generateGemini(prompt).then((b64) => ({ kind: 'base64', data: b64 })) }
        : null,
    ].filter(Boolean);

    for (const task of tasks) {
      const start = Date.now();
      try {
        const result = await task.run();
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const filename = `${task.name}_${word}.png`;
        const filepath = new URL(filename, OUT_DIR);
        if (result.kind === 'url') {
          await saveFromUrl(result.data, filepath);
        } else {
          await saveFromBase64(result.data, filepath);
        }
        console.log(`✅ ${task.name}: ${elapsed}s → ${filename}`);
        report.push({ word, model: task.name, status: 'ok', elapsed, file: filename });
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`❌ ${task.name}: ${elapsed}s → ${err.message}`);
        report.push({ word, model: task.name, status: 'error', elapsed, error: err.message });
      }
    }
  }

  console.log('\n\n=== 汇总 ===');
  console.table(report);
  console.log(`\n图片已保存到: ${OUT_DIR.pathname}`);
}

if (!DASHSCOPE_API_KEY) {
  console.error('缺少 DASHSCOPE_API_KEY，请检查 .env.local');
  process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
