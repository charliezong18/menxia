// 一次性维护工具（不在测试路径上——测试只读已提交的 corpus/）：
//   node test/golden/import-corpus.mjs              只重写 corpus/edge-crlf.md
//   node test/golden/import-corpus.mjs <review 仓根> 另把 corpus-sources.json 登记的真折逐字节拷进 corpus/
// 换完语料再跑 `node test/golden/export.mjs` 重生 golden。
//
// edge-crlf.md 由这里生成而不是手写：编辑器/写文件工具会把 CR 吃掉，靠手写保不住 CRLF 与 TAB。
// test/golden/.gitattributes 对 corpus/ 设了 -text，git 也不会替它改换行。
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const CRLF_LINES = [
  '---',
  'title: CRLF 文档',
  '---',
  '# CRLF 换行的文档',
  '',
  '第一段，',
  '软换行续行。',
  '',
  '- 列表一',
  '- 列表二',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '```diff',
  '-旧',
  '+新',
  '```',
  '',
  '\t制表符缩进＝缩进代码块',
  '\t第二行',
  '',
  '<a id="crlf-anchor"></a>',
  '',
  '段内\t制表符与行尾空格  ',
  '硬换行之后。',
  '',
];
writeFileSync(join(here, 'corpus', 'edge-crlf.md'), CRLF_LINES.join('\r\n'));
console.log('写出 corpus/edge-crlf.md（CRLF）');

const root = process.argv[2];
if (root) {
  const { files } = JSON.parse(readFileSync(join(here, 'corpus-sources.json'), 'utf8'));
  for (const f of files) {
    copyFileSync(join(root, f.source), join(here, 'corpus', f.name));
    console.log(`${f.source} → corpus/${f.name}`);
  }
}
