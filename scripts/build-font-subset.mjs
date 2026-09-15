#!/usr/bin/env node
/**
 * 计算游戏界面需要的汉字集合，供 pyftsubset 裁剪字体使用。
 *
 * 背景：两款中文手写体（Ma Shan Zheng / ZCOOL KuaiLe）只用于界面装饰
 * （标题、按钮、关卡名、奖励词卡大字）。AI 现场生成的故事正文走系统字体，
 * 所以需要的字符在打包时完全可以穷举。
 *
 * 新增关卡词之后重新运行本脚本，再跑一次 pyftsubset 即可。
 *
 *   node scripts/build-font-subset.mjs
 *
 * 字体源文件（TTF）不入库，首次使用先下载：
 *   mkdir -p scripts/fonts-src && cd scripts/fonts-src
 *   curl -LO https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
 *   curl -LO https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf
 *
 * 然后按字表裁剪（需要 pip install fonttools brotli）：
 *   pyftsubset scripts/fonts-src/MaShanZheng-Regular.ttf \
 *     --text-file=scripts/font-charset.txt \
 *     --output-file=public/fonts/MaShanZheng-subset.woff2 \
 *     --flavor=woff2 --layout-features='' --no-hinting --desubroutinize --drop-tables+=DSIG
 *   （ZCOOLKuaiLe 同理，输出 public/fonts/ZCOOLKuaiLe-subset.woff2）
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

// 扫描这些位置：界面文案 + 关卡词库
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib'];
const SCAN_FILES = ['public/levels.json', 'types.ts'];
const SCAN_GLOB_DIRS = ['public/curriculum'];
const EXTS = new Set(['.ts', '.tsx', '.css', '.json']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const files = [];
for (const d of SCAN_DIRS) files.push(...walk(join(ROOT, d)));
for (const f of SCAN_FILES) files.push(join(ROOT, f));
for (const d of SCAN_GLOB_DIRS) {
  for (const name of readdirSync(join(ROOT, d))) files.push(join(ROOT, d, name));
}

const chars = new Set();
// CJK 基本区 + 常用中文标点
const CJK = /[一-鿿　-〿＀-￯]/u;

for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const ch of text) if (CJK.test(ch)) chars.add(ch);
}

// 界面上会和中文混排的西文字符（关卡编号、百分比、箭头等）
for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;!?()[]%+-×÷=/\\\'"、。，！？：；…—·←→↑↓✓✗★☆ ') {
  chars.add(ch);
}

const sorted = [...chars].sort();
const outPath = join(ROOT, 'scripts', 'font-charset.txt');
writeFileSync(outPath, sorted.join(''), 'utf8');

const cjkCount = sorted.filter(c => /[一-鿿]/u.test(c)).length;
console.log(`扫描文件数: ${files.length}`);
console.log(`字符总数:   ${sorted.length}（其中汉字 ${cjkCount} 个）`);
console.log(`字表已写入: scripts/font-charset.txt`);
