// ?demo=1 —— 免 token 的演示/冒烟数据源：实现 App 用到的 api 子集，写操作只打 console。
// 顺带是迁移后的永久冒烟靶：?demo=1&auto=1 会用真实事件路径自动划两条朱批。

const DOC = `# 朱批 demo 折

这是一份演示奏折：不需要 token，写操作不会真的发出。划选任意文字试试朱批。

## 为什么要有 demo 模式

迁移到 Preact 之后，需要一个不依赖真仓库的冒烟靶：渲染、划句、攒批、提交管线（到 console 为止）都走真实代码路径。

| 能力 | 状态 |
|---|---|
| 渲染阅读 | 可用 |
| 划句朱批 | 可用（写到 console） |
| 钦此 | 可用（写到 console） |

\`\`\`js
const DEBOUNCE_MS = 300;
export const pushUsage = debounce(update, DEBOUNCE_MS);
\`\`\`

结尾一段：镜片随时可以摘掉，数据与循环全部留在 GitHub。

## 加长段（冒烟用，别删）

这一节的唯一职责是把 demo 文档撑到超过一屏——迁移评审抓过一个只有长文档才暴露的滚动断链（#root 高度），短文档冒烟永远测不出那类雷。

${Array.from({ length: 14 }, (_, i) => `第 ${i + 1} 段填充：读折台的滚动、批注卡对齐、浮批按钮收纳，都要在超过一屏的文档上才真正受测。`).join('\n\n')}

末行锚点：见此行即已滚到底。
`;

// 旧版正文：删掉「为什么要有 demo 模式」一节——rev 切换后正文明显变短（冒烟断言据此）
const DOC_OLD = DOC.replace(/## 为什么要有 demo 模式[\s\S]*?结尾一段：镜片随时可以摘掉，数据与循环全部留在 GitHub。\n\n/, '');

const PR = {
  number: 999,
  title: '朱批 demo 折（不落库）',
  updated_at: new Date(Date.now() - 36e5).toISOString(),
  draft: false,
  node_id: 'DEMO',
  head: { sha: 'demo0000' },
};

// 整份新增文件的 patch：全行可批
const PATCH = ['@@ -0,0 +1,' + DOC.split('\n').length + ' @@', ...DOC.split('\n').map((l) => '+' + l)].join('\n');

// 3 个 rev：v3=head（sha 对齐 PR.head.sha），v1/v2 更早。旧 rev 的正文用 DOC_OLD。
const COMMITS = [
  { sha: 'demoAAAA', commit: { message: '初稿', committer: { date: new Date(Date.now() - 72e5).toISOString() } } },
  { sha: 'demoBBBB', commit: { message: '补加长段', committer: { date: new Date(Date.now() - 54e5).toISOString() } } },
  { sha: 'demo0000', commit: { message: '收尾', committer: { date: new Date(Date.now() - 36e5).toISOString() } } },
];

// 2 串已呈批注：一串带 agent 回话（in_reply_to_id 串到根），一串 outdated（line=null）
const COMMENTS = [
  {
    id: 101, path: 'docs/demo.md', line: 20, original_line: 20, in_reply_to_id: null,
    user: { login: 'charlie' }, created_at: new Date(Date.now() - 30e5).toISOString(),
    body: '> 镜片随时可以摘掉，数据与循环全部留在 GitHub。\n\n这句放结尾太谦虚了，提到开头当卖点。',
  },
  {
    id: 102, path: 'docs/demo.md', line: 20, original_line: 20, in_reply_to_id: 101,
    user: { login: 'agent-bot' }, created_at: new Date(Date.now() - 24e5).toISOString(),
    body: '已接受：把「镜片可摘」挪到 Why 的第一句，结尾只留循环闭环。',
  },
  {
    id: 103, path: 'docs/demo.md', line: null, original_line: 7, in_reply_to_id: null,
    user: { login: 'charlie' }, created_at: new Date(Date.now() - 20e5).toISOString(),
    body: '> 迁移到 Preact 之后\n\n这行在新版已经改写，锚定失效——保留看处理即可。',
  },
];

export const demoApi = {
  verifyToken: async () => ({ repo: {}, canWrite: true, prAccess: true }),
  listOpenPRs: async () => [PR],
  listPRFiles: async () => [{ filename: 'docs/demo.md', status: 'added', patch: PATCH }],
  // ref 落在旧 rev（非 head sha）时返回删节版，模拟版本间正文差异
  getFileText: async (_path, ref) => (ref && ref !== 'demo0000' ? DOC_OLD : DOC),
  getFileBlobUrl: async () => { throw new Error('demo 无图'); },
  listPRComments: async () => COMMENTS,
  listPRCommits: async () => COMMITS,
  submitReview: async (num, payload) => { console.log('[demo] submitReview', num, payload); return {}; },
  createIssueComment: async (num, body) => { console.log('[demo] 总批', num, body); return {}; },
  mergePR: async (num, sha) => { console.log('[demo] 钦此', num, sha); return {}; },
  markReady: async () => {},
};

// 自动演示：用真实的 Selection + mouseup + 按钮点击走完「划句 → 存批」两轮
export async function autoAnnotate(docEl) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = async (text, note, save) => {
    const block = [...docEl.querySelectorAll('[data-line]')].find((b) => b.textContent.includes(text));
    if (!block) return;
    const idx = block.textContent.indexOf(text);
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let pos = 0, sN = null, sO = 0, node, r = null;
    while ((node = walker.nextNode())) {
      const next = pos + node.data.length;
      if (!sN && idx < next) { sN = node; sO = idx - pos; }
      if (sN && idx + text.length <= next) {
        r = document.createRange(); r.setStart(sN, sO); r.setEnd(node, idx + text.length - pos);
        break;
      }
      pos = next;
    }
    if (!r) return;
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    docEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await sleep(120);
    document.querySelector('.zhupi-float')?.click();
    await sleep(120);
    const ta = document.querySelector('.anno-input');
    if (ta) {
      ta.value = note;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (save) [...document.querySelectorAll('.anno-save')].pop()?.click();
    }
    await sleep(120);
  };
  // ── 断言机制：不再是 console.log 打印真假值（那样断言变 false 也照样"绿"）。
  // 每条走 chk()，失败打 [smoke] FAIL 并计数，末行输出 RESULT 供 run-browser.sh 判退出码。
  let pass = 0, fail = 0;
  const chk = (name, cond, detail = '') => {
    cond ? pass++ : fail++;
    console.log(`[smoke] ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  await sleep(300);
  await pick('镜片随时可以摘掉', '这句放结尾太谦虚了，提到开头', true);
  await pick('const DEBOUNCE_MS = 300;', '300ms 的依据补个注释', false);

  // 长文档必须可滚（#root 高度链断裂那类雷靠这条抓；demo 文档特意长过一屏）
  const work = document.querySelector('.work');
  chk('long-doc-scrollable', Boolean(work && work.scrollHeight > work.clientHeight),
    `scrollH=${work?.scrollHeight} clientH=${work?.clientHeight}`);

  // 两次划批各产出一张卡（含已呈串共 4 张），提交按钮随草稿出现
  const draftCards = document.querySelectorAll('.anno-card:not(.anno-shown)').length;
  chk('draft-cards>=2', draftCards >= 2, `draft-cards=${draftCards}`);
  chk('submit-btn-visible', Boolean(document.querySelector('.btn-submit')));

  // 草稿落进 localStorage（刷新不丢的保证）
  const stored = JSON.parse(localStorage.getItem('zhupi.drafts.999') || '{}')?.items?.length || 0;
  chk('drafts-persisted', stored >= 2, `stored=${stored}`);

  // 锚定精度：fence 内那条必须精确到 DEBOUNCE 所在行（DOC 第 16 行），不是代码块首行
  const fenceDraft = (JSON.parse(localStorage.getItem('zhupi.drafts.999') || '{}')?.items || [])
    .find((d) => d.quote.includes('DEBOUNCE_MS'));
  chk('fence-line-precise', fenceDraft?.line === 16, `line=${fenceDraft?.line} want=16`);

  // M3：已呈批注串 + 回话渲染
  chk('shown-threads>=1', document.querySelectorAll('.anno-shown').length >= 1);
  chk('reply-rendered>=1', document.querySelectorAll('.anno-reply').length >= 1);

  // 卡片排序：右缘卡必须按锚点行号递增（草稿与已呈串合并排序，否则串卡被压到天边）
  const tops = [...document.querySelectorAll('#margin-col .anno-card')]
    .map((el) => ({ line: +el.dataset.blockLine || 0, top: parseFloat(el.style.top) || 0 }))
    .filter((x) => x.line);
  const sortedByLine = [...tops].sort((a, b) => a.line - b.line);
  chk('margin-cards-ordered', sortedByLine.every((x, i, arr) => i === 0 || x.top >= arr[i - 1].top),
    JSON.stringify(sortedByLine));

  // rev 切换器（3 个 rev）
  chk('rev-switcher-3-opts', document.querySelectorAll('.rev-opt').length === 3,
    `opts=${document.querySelectorAll('.rev-opt').length}`);

  // &norev=1：停在 head 态供截图
  if (new URLSearchParams(location.search).get('norev') === '1') {
    console.log(`[smoke] RESULT pass=${pass} fail=${fail}`);
    return;
  }

  // 切到 v1（最旧）：正文变短（DOC_OLD 删了一节）+ 旧版只读（划句不出浮批钮）
  const headLen = (docEl?.textContent || '').length;
  document.querySelector('.rev-opt')?.click(); // 升序，首个 = v1
  await sleep(600); // 等岛屿 effect 重新取文并注入
  const oldLen = (docEl?.textContent || '').length;
  chk('old-rev-body-shorter', oldLen < headLen, `${oldLen} < ${headLen}`);
  chk('old-rev-notice-shown', Boolean(document.querySelector('.rev-notice')));

  const b = [...docEl.querySelectorAll('[data-line]')].find((x) => x.textContent.trim().length > 4);
  if (b) {
    const r = document.createRange(); r.selectNodeContents(b);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    docEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await sleep(150);
  }
  chk('old-rev-float-suppressed', !document.querySelector('.zhupi-float'));
  const submitBtn = document.querySelector('.btn-submit');
  chk('old-rev-submit-disabled', !submitBtn || submitBtn.disabled);

  console.log(`[smoke] RESULT pass=${pass} fail=${fail}`);
}
