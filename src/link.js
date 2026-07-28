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

// ── F7 外部直达链接（deep link）──
// 支持两种进场形态，都收敛成 F6 已有的 {prNumber, path, line}：
//   ?pr=13 / ?pr=13&path=docs/a.md&line=42   —— 短、好念、agent 好拼
//   ?ref=<GitHub permalink>                  —— F6 已认得的三种链接原样塞进来，零新语法
export function parseDeepLink(search, slug) {
  const q = new URLSearchParams(search || '');
  const ref = q.get('ref');
  if (ref) return parseZhupiLink(ref, slug);
  const pr = q.get('pr');
  if (!pr) return null;
  const prNumber = parseInt(pr, 10);
  if (!Number.isFinite(prNumber) || prNumber <= 0) return null;
  const line = parseInt(q.get('line') || '', 10);
  return {
    prNumber,
    path: q.get('path') || null,
    line: Number.isFinite(line) && line > 0 ? line : null,
  };
}

// ── F9 回奏对（回呈折的 Happy 会话）──
// 批完要回去说「读批注」，得找回是哪个会话呈的折。agent 开折时在 PR body 埋一行：
//   <!-- happy-session: cms3yv065k1oqyc0teh4a5why -->
// 用 HTML 注释：GitHub 上不显示、不碍眼，agent 只需 append 一行。
// 也认 body 里可见的会话链接（agent 手写时更自然），以及标记里直接写整条 URL（fork 自架 Happy）。
// 会话可能早已散场——朱批无从判断，只保证链接指对地方。
const HAPPY_BASE = 'https://charliezong18.github.io/happy';
const SESSION_ID = /^[a-z0-9]{16,40}$/i;   // 锚定：`http://evil/...` 之类不得当成裸 id

export function parseHappySession(body) {
  const text = String(body || '');
  const marked = /<!--\s*happy-session:\s*([^\s>]+)\s*-->/i.exec(text);
  const raw = marked?.[1] || urlInBody(text);
  if (!raw) return null;
  if (/^https:\/\//i.test(raw)) return sessionUrl(raw);       // 标记里写了整条 URL
  return SESSION_ID.test(raw) ? `${HAPPY_BASE}/session/${raw}` : null;
}

// 可见链接只认 https 的 /session/<id>，挡掉 javascript: 之类的注入
const urlInBody = (text) => /https:\/\/[^\s)>\]]*\/session\/[a-z0-9]{16,40}/i.exec(text)?.[0] || null;

function sessionUrl(href) {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && /\/session\/[a-z0-9]{16,40}$/i.test(u.pathname) ? u.href : null;
  } catch { return null; }
}

// 当前位置 → 可分享地址（写地址栏 + 「拷直达链」都用它）
export function buildDeepLink(origin, { prNumber, path, line }) {
  if (!prNumber) return origin;
  const q = new URLSearchParams({ pr: String(prNumber) });
  if (path) q.set('path', path);
  if (line) q.set('line', String(line));
  return `${origin}?${q}`;
}
