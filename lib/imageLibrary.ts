import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// 服务器共享词卡图库：文件名就是词本身，天然实现"一词一图、全局唯一"。
// 目录来自环境变量，未设置时落到项目下的本地开发目录（已加入 .gitignore）。
// 部署时必须给容器挂一个数据卷指到这个目录，否则容器重建/重启图库就没了。
const LIBRARY_DIR = process.env.IMAGE_LIBRARY_DIR || path.join(process.cwd(), '.data', 'word-images');

const EXT = 'webp';
const MAX_EDGE = 768; // 词卡实际显示尺寸很小，768 足够清晰，比原图 1280 小很多
const WEBP_QUALITY = 82;

// 严格校验：必须恰好是两个连续的 CJK 汉字。这不只是数据规范检查——
// 它是防路径穿越的唯一防线（文件名直接由词拼出来），任何非法输入一律拒绝，
// 不做转义/清洗，因为清洗后的字符串仍可能拼出意料之外的路径。
const WORD_PATTERN = /^[一-鿿]{2}$/;

export function isValidWord(word: unknown): word is string {
  return typeof word === 'string' && WORD_PATTERN.test(word);
}

function filePathFor(word: string): string {
  if (!isValidWord(word)) throw new Error(`非法词语: ${JSON.stringify(word)}`);
  return path.join(LIBRARY_DIR, `${word}.${EXT}`);
}

async function ensureDir(): Promise<void> {
  await mkdir(LIBRARY_DIR, { recursive: true });
}

/** 图库里已有这个词的图，返回版本号（文件修改时间毫秒数，用于客户端缓存失效）；没有则返回 null。 */
export async function getExistingVersion(word: string): Promise<number | null> {
  try {
    const s = await stat(filePathFor(word));
    return Math.round(s.mtimeMs);
  } catch {
    return null;
  }
}

/** 读取图库里的原始图片字节，供 GET 路由直接返回；不存在则返回 null。 */
export async function readImage(word: string): Promise<Buffer | null> {
  try {
    return await readFile(filePathFor(word));
  } catch {
    return null;
  }
}

/**
 * 压缩并落盘。用临时文件 + rename 做原子写入——避免"换一张图"覆盖到一半时，
 * 正好有请求在读同一个词，读到一个内容被截断的坏文件。
 */
export async function saveCompressedImage(word: string, rawImage: Buffer): Promise<number> {
  await ensureDir();
  const compressed = await sharp(rawImage)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const finalPath = filePathFor(word);
  const tmpPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, compressed);
  await rename(tmpPath, finalPath);

  const version = await getExistingVersion(word);
  return version ?? Date.now();
}

export async function deleteImage(word: string): Promise<void> {
  try {
    await unlink(filePathFor(word));
  } catch {
    // 本来就不存在，忽略
  }
}

/** 拼给客户端用的 URL。带版本号是为了让"换一张图"之后浏览器不会继续用旧缓存。 */
export function buildImageUrl(word: string, version: number): string {
  return `/api/word-image/${encodeURIComponent(word)}?v=${version}`;
}

// 在途生成去重：同一个词并发多次请求（比如孩子手快连点），只真正调一次生图 API，
// 其余请求排队等同一个 Promise 的结果。force 重生也走这条去重，避免连点"换一张图"
// 在极短时间内触发多次计费。
const pending = new Map<string, Promise<number>>();

export function getOrCreateInFlight(word: string, run: () => Promise<number>): Promise<number> {
  const existing = pending.get(word);
  if (existing) return existing;

  const task = run().finally(() => {
    pending.delete(word);
  });
  pending.set(word, task);
  return task;
}
