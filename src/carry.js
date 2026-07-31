// F12 携卷 —— 把当前折拼成一份自包含 markdown，粘给任意 agent 接续工作。
//
// 由来（评估折 #60 / BACKLOG F12）：回奏赌「呈折的那个 Happy 会话还活着」；2026-07-29 已定调
// 真正的兜底是**自包含文档**。携卷把这句定调做成产品——剪贴板是所有 agent 都认的唯一集成面，
// 一键拷走 = 零成本的跨 harness 交接。
//
// 这一层是**纯函数**：只吃已在内存里的数据（pr / 已取正文的 docs / 已串好的 threads / 判 / 拍板点），
// 产出一个字符串。取正文、写剪贴板、按钮反馈都在 ui.js 那侧（IO 与视图不进这里，好单测）。
//
// 三条拼装原则：
// 1. **文档正文用分隔线包，不用外层围栏**：文档自带 ``` 围栏，再套一层外层 fence 必嵌套破碎。
//    改用「一行标签 + 前后各一条水平分隔线」界定每篇正文，正文原样落下，agent 照读不误。
//    （评估折 #60 明确点了这个坑：外层要么用更长反引号串、要么用明确分隔线——这里取后者。）
// 2. **批注按文档位置排序**：先按文档在折内的出现序分组，组内按行号升序；锚不到行的（旧版漂移 /
//    整折判）沉到各组末尾，再不行归到「未定位」尾巴。读的人顺着正文往下走，批注就在它该在的地方。
// 3. **引文/批语/回话原样落 markdown**：它们本就是 markdown，LLM 直接读；不再套壳、不转义，
//    只在整篇末尾统一汇总拍板点。

// 每篇文档正文的界定符：一条足够长、正文里不会撞上的水平分隔线。
const RULE = '─'.repeat(60);

// 批注串锚定行：line 是当前版行号，null 表示旧版漂移（outdated）。排序用它，取不到的排在最后。
const anchorLineOf = (t) => {
  const l = t.root?.line;
  return Number.isFinite(l) ? l : Infinity;
};

// 一条批注串（根 + 回话）拼成 markdown 段。
// thread：{ root:{ body, user, line, original_line }, replies:[{ body, user }] }
// parseBody：注入的 parseCommentBody（把 `> 引文` 从正文里拆出来），保持与 app 内渲染一致的拆法。
function renderThread(t, parseBody, i) {
  const { quote, body } = parseBody(t.root.body);
  const who = t.root.user?.login || '?';
  const line = Number.isFinite(t.root?.line) ? t.root.line
    : (Number.isFinite(t.root?.original_line) ? t.root.original_line : null);
  const loc = line != null
    ? `第 ${line} 行${Number.isFinite(t.root?.line) ? '' : '（旧版，已漂移）'}`
    : '未定位';

  const out = [`#### 涂归 ${i}（${loc}）· ${who}`];
  if (quote && quote.trim()) out.push('', `> 引句：${quote.trim().replace(/\n/g, ' ')}`);
  out.push('', body.trim() || '（空批语）');
  t.replies.forEach((r) => {
    out.push('', `**回话 · ${r.user?.login || '?'}**：`, '', (r.body || '').trim() || '（空）');
  });
  return out.join('\n');
}

/**
 * 组装携卷 markdown。
 *
 * @param {object}   pr          { number, title, url, body }
 * @param {Array}    docs        [{ path, lang, text }]（text 已取回；lang: 'zh' | 'en'）
 * @param {Array}    threads     [{ root, replies }]（inline 批注串，已 threadComments 串好）
 * @param {Array}    zongpis     [{ body, user, created_at }]（整折判 / issue 评论）
 * @param {?string}  decisions   「待你拍板」段正文，无则 null
 * @param {?string}  deepLink    门下深链
 * @param {string}   assembledAt 组装时刻（人类可读串）
 * @param {function} parseCommentBody 注入：把 `> 引文` 从批注正文里拆出来
 * @returns {string} 自包含 markdown
 */
export function assembleCarry({
  pr, docs = [], threads = [], zongpis = [], decisions = null,
  deepLink = null, assembledAt, parseCommentBody,
}) {
  const parseBody = parseCommentBody || ((raw) => ({ quote: '', body: String(raw || '') }));
  const P = [];

  // ── 头部 ──
  P.push(`# 携卷 · #${pr.number}「${pr.title}」`);
  const head = [
    `- 折号：#${pr.number}`,
    `- 标题：${pr.title}`,
    pr.url ? `- PR：${pr.url}` : null,
    deepLink ? `- 门下深链：${deepLink}` : null,
    assembledAt ? `- 组装于：${assembledAt}` : null,
    `- 文档：${docs.length} 篇 · 涂归：${threads.length} 串 · 判：${zongpis.length} 条`,
  ].filter(Boolean);
  P.push(head.join('\n'));
  P.push('> 这是「门下」阅读器里一整折的自包含快照，供接手的 agent 无需任何外部访问即可续作。'
    + '正文、批注、待决事项全在下面。');

  // ── PR 说明（body 原文，含 TLDR / 待你拍板 等）──
  if (pr.body && String(pr.body).trim()) {
    P.push('## 折子说明（PR body 原文）');
    P.push(fenced(String(pr.body).trim()));
  }

  // ── 每篇文档全文 ──
  P.push('## 正文');
  if (!docs.length) {
    P.push('（此折无 markdown 正文。）');
  } else {
    docs.forEach((d) => {
      const langLabel = d.lang === 'zh' ? '中文' : (d.lang === 'en' ? 'English' : '');
      P.push(`### 文档：\`${d.path}\`${langLabel ? `（${langLabel}）` : ''}`);
      P.push(fenced(d.text != null ? String(d.text) : '（正文取不到。）'));
    });
  }

  // ── 批注线程（按文档位置排序）──
  P.push('## 涂归线程');
  if (!threads.length) {
    P.push('（此折暂无划句批注。）');
  } else {
    // 文档出现序 → 组序；组内按行号升序，锚不到的沉底；不属于任何已知文档的归「未定位」。
    const order = new Map(docs.map((d, i) => [d.path, i]));
    const groups = new Map();          // path → threads[]
    const orphan = [];
    threads.forEach((t) => {
      const p = t.root?.path;
      if (p != null && order.has(p)) {
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p).push(t);
      } else {
        orphan.push(t);
      }
    });
    const sortedPaths = [...groups.keys()].sort((a, b) => order.get(a) - order.get(b));
    let n = 0;
    sortedPaths.forEach((p) => {
      const list = groups.get(p).sort((a, b) => anchorLineOf(a) - anchorLineOf(b));
      P.push(`### 针对 \`${p}\``);
      list.forEach((t) => { n++; P.push(renderThread(t, parseBody, n)); });
    });
    if (orphan.length) {
      P.push('### 未定位 / 其他文档');
      orphan.forEach((t) => { n++; P.push(renderThread(t, parseBody, n)); });
    }
  }

  // ── 整折判（判 / 总评）──
  if (zongpis.length) {
    P.push('## 判（整折总评）');
    // 与 app 内一致：最新在前。带 created_at 就按时间排，缺了保持传入序。
    const sorted = [...zongpis].sort((a, b) => {
      const ta = Date.parse(a?.created_at); const tb = Date.parse(b?.created_at);
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
      return tb - ta;
    });
    sorted.forEach((z, i) => {
      P.push(`#### 判 ${i + 1} · ${z.user?.login || '?'}`);
      P.push((z.body || '').trim() || '（空）');
    });
  }

  // ── 待决事项汇总（尾部）──
  if (decisions && String(decisions).trim()) {
    P.push('## 待决事项（待你拍板）');
    P.push(String(decisions).trim());
  }

  return P.join('\n\n') + '\n';
}

// 用分隔线包一段可能自带 ``` 围栏的正文，避免嵌套围栏破碎。
function fenced(text) {
  return `${RULE}\n${text}\n${RULE}`;
}
