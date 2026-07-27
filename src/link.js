// 折间链接（纯逻辑）——格式就用 GitHub 原生 permalink，不发明私有语法。
// 理由：这样在 GitHub 上是正常链接、agent 读得懂，朱批只是把它「拦下来」变成 app 内跳转。
// 镜片仍是镜片：链接图谱不是新数据，只是 markdown 里的普通 URL。

// 认得三种（都限本仓，跨仓一律当外链放行）：
//   .../pull/7                                → 跳到第 7 折
//   .../pull/7/files#diff-<hash>R42           → GitHub 划行链接（取不到路径，只能到折）
//   .../blob/<ref>/docs/a.md#L42              → 文件行链接，能精确到文档 + 行
//   .../pull/7#discussion_r123                → 某条批注（跳到折，批注串本来就在右缘）
export function parseZhupiLink(href, slug) {
  if (!href || !slug) return null;
  let u;
  try { u = new URL(href, 'https://github.com'); } catch { return null; }
  if (u.hostname !== 'github.com') return null;
  const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const [owner, repo, kind, ...rest] = parts;
  if (`${owner}/${repo}`.toLowerCase() !== slug.toLowerCase()) return null; // 别的仓：当外链

  if (kind === 'pull' && rest[0]) {
    const num = parseInt(rest[0], 10);
    if (!Number.isFinite(num)) return null;
    return { prNumber: num, path: null, line: lineFromHash(u.hash) };
  }
  if (kind === 'blob' && rest.length >= 2) {
    // blob/<ref>/<path...>：ref 可能含斜杠（分支名），但文档路径恒以 docs/ 开头，从那切
    const docsAt = rest.findIndex((p) => p === 'docs');
    if (docsAt < 1) return null;
    return { prNumber: null, path: rest.slice(docsAt).join('/'), line: lineFromHash(u.hash) };
  }
  return null;
}

// #L42 / #L42-L50 / ...R42（GitHub diff 行锚）
function lineFromHash(hash) {
  if (!hash) return null;
  const m = /#L(\d+)/.exec(hash) || /[LR](\d+)$/.exec(hash);
  return m ? parseInt(m[1], 10) : null;
}

// 「引用此处」按钮拷给你的东西：一条 GitHub permalink + 一句引文
// 引文是给人和 agent 看的兜底——链接哪天漂了，至少还知道当初指的是哪句（同锚定哲学）
export function buildRef({ slug, prNumber, path, line, quote }) {
  const base = `https://github.com/${slug}`;
  const url = path
    ? `${base}/blob/main/${path}#L${line || 1}`
    : `${base}/pull/${prNumber}`;
  const q = (quote || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return q ? `[「${q}」](${url})` : url;
}
