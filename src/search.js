// 全文搜索（零后端）——现场拉取各折的 markdown 文本，客户端匹配。
// 缓存进 localStorage、按 head sha 失效：第一次搜要翻折（有进度），之后基本即时。
// 纯文本函数（findMatches / snippetAround / lineOfIndex）单测覆盖，拉取编排不进单测。

const cacheKey = (num) => `zhupi.doccache.${num}`;

function readCache(num, sha) {
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey(num)));
    return c && c.sha === sha ? c.files : null;
  } catch { return null; }
}
function writeCache(num, sha, files) {
  try { localStorage.setItem(cacheKey(num), JSON.stringify({ sha, files })); }
  catch { /* 配额满：不缓存，搜索照常（内存里已有） */ }
}

const isDoc = (f) => f.filename.endsWith('.md') && f.status !== 'removed';

// 把（open + 归档）所有折的文档文本备齐；onProgress(done, total, title) 汇报翻折进度
export async function buildIndex(api, prs, onProgress) {
  const index = [];
  let done = 0;
  for (const pr of prs) {
    const sha = pr.head?.sha || '';
    let files = readCache(pr.number, sha);
    if (!files) {
      files = {};
      try {
        const list = (await api.listPRFiles(pr.number)).filter(isDoc);
        for (const f of list) {
          try { files[f.filename] = (await api.getFileText(f.filename, sha)).slice(0, 200_000); }
          catch { /* 单文件失败跳过，别废掉整次搜索 */ }
        }
        writeCache(pr.number, sha, files);
      } catch { /* 整折失败跳过 */ }
    }
    index.push({ pr, files });
    onProgress?.(++done, prs.length, pr.title);
  }
  return index;
}

// 大小写不敏感的多命中查找；cap 防某个词在长文档里刷屏
export function findMatches(text, query, cap = 5) {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return [];
  const out = [];
  let from = 0;
  while (out.length < cap) {
    const i = t.indexOf(q, from);
    if (i < 0) break;
    out.push(i);
    from = i + Math.max(q.length, 1);
  }
  return out;
}

// 命中处的源文件行号（1-based）——跳转就靠它对上 data-line
export function lineOfIndex(text, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

// 命中行做摘要：太长就以命中词为中心开窗
export function snippetAround(text, idx, qlen, width = 60) {
  const ls = text.lastIndexOf('\n', idx) + 1;
  let le = text.indexOf('\n', idx);
  if (le < 0) le = text.length;
  let s = ls, e = le;
  if (le - ls > width) {
    const half = Math.floor((width - qlen) / 2);
    s = Math.max(ls, idx - half);
    e = Math.min(le, idx + qlen + half);
  }
  return (s > ls ? '…' : '') + text.slice(s, e).trim() + (e < le ? '…' : '');
}

// 汇总：标题命中 + 正文命中，按折分组返回
export function searchIndex(index, query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const groups = [];
  for (const { pr, files } of index) {
    const hits = [];
    if (pr.title.toLowerCase().includes(q.toLowerCase())) {
      hits.push({ kind: 'title', path: null, line: null, snippet: pr.title });
    }
    for (const [path, text] of Object.entries(files)) {
      for (const idx of findMatches(text, q)) {
        hits.push({
          kind: 'doc', path,
          line: lineOfIndex(text, idx),
          snippet: snippetAround(text, idx, q.length),
        });
      }
    }
    if (hits.length) groups.push({ pr, hits });
  }
  return groups;
}
