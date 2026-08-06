// ?demo=1 —— 免 token 的演示/冒烟数据源：实现 App 用到的 api 子集，写操作只打 console。
// 顺带是迁移后的永久冒烟靶：?demo=1&auto=1 会用真实事件路径自动划两条涂归。

const DOC = `# 涂归 demo 折

这是一份演示敕草：不需要 token，写操作不会真的发出。划选任意文字试试涂归。

## 为什么要有 demo 模式

迁移到 Preact 之后，需要一个不依赖真仓库的冒烟靶：渲染、划句、攒批、提交管线（到 console 为止）都走真实代码路径。据说迁移后包体积下降了约四成【需核实】，这句就是 F13 标记的冒烟靶。

| 能力 | 状态 |
|---|---|
| 渲染阅读 | 可用 |
| 划句涂归 | 可用（写到 console） |
| 画可 | 可用（写到 console） |

\`\`\`js
const DEBOUNCE_MS = 300;
export const pushUsage = debounce(update, DEBOUNCE_MS);
\`\`\`

结尾一段：镜片随时可以摘掉，数据与循环全部留在 GitHub。

## 加长段（冒烟用，别删）

这一节的唯一职责是把 demo 文档撑到超过一屏——迁移评审抓过一个只有长文档才暴露的滚动断链（#root 高度），短文档冒烟永远测不出那类雷。

${Array.from({ length: 14 }, (_, i) => `第 ${i + 1} 段填充：读折台的滚动、批注卡对齐、浮批按钮收纳，都要在超过一屏的文档上才真正受测。`).join('\n\n')}

折间链接测试：见 [另一折](https://github.com/demo/repo/pull/998) 与 [本折某行](https://github.com/demo/repo/blob/main/docs/demo.md#L20)；外链 [GitHub](https://github.com/slopus/happy) 不该被拦。

页内锚点测试：[照 GitHub 锚写](#加长段冒烟用别删)、[照标题原文写](#加长段（冒烟用，别删）)、[指不着的锚](#根本没有这一节)。

末行锚点：见此行即已滚到底。
`;

// 旧版正文：删掉「为什么要有 demo 模式」一节——rev 切换后正文明显变短（冒烟断言据此）
const DOC_OLD = DOC.replace(/## 为什么要有 demo 模式[\s\S]*?结尾一段：镜片随时可以摘掉，数据与循环全部留在 GitHub。\n\n/, '');

// 呈折说明（PR body）。**照 menxia-mcp `buildBody` 的真实产物摆**：五段 `## 段名`、段间空行、
// 尾巴一行「回奏对」标记。issue #13 之前门下只从这里抠会话 id，五段一个字都不渲染——
// 「待你拍板」（要他决定的问题清单）因此彻底不可见。冒烟靶必须带全五段，否则那条断言测的是空气。
// 段里塞了标题 / 列表 / 表格：markdown 真渲染这条断言要有东西可断。
const BODY = `## 目的地

merge 后作为门下 issue #13 的实现依据。不对外发布。

## 直达链

[渲染版](https://charliezong18.github.io/menxia/?pr=999)

## TLDR

PR body 的五段结构化正文此前在门下不可见，本折把它渲染到折首。细节见正文的 [〈加长段〉](#加长段冒烟用别删)。

| 段 | 之前 | 之后 |
|---|---|---|
| 待你拍板 | 看不见 | 折首默认展开 |

## 待你拍板

1. 折首折叠块（B）还是独立 tab（A）？
2. 有「待你拍板」时默认展开，其余默认收起——这个条件展开可以吗？
3. 段序原样保留，不把「待你拍板」提到最前，行不行？

## 怎么用

逐篇批。批完在这个会话说「读批注」，我逐条回话并出 v2。

<!-- happy-session: cmsdemo0000demo0000demo -->
`;

// 手开折的 body：没有任何 `## 段名`，只有散文（review #7 就长这样）。
// 归档折用它当靶——「认不出五段 ⇒ 不该判成有拍板点 ⇒ 默认收起」这条路径要有真数据走。
const BODY_FREEFORM = `读物快照。**这两篇是要发到别人仓库去的**，比内部文档更该被你逐句挑。

划句朱批。你说「发」我才发，不说就一直压着。

<!-- happy-session: cmsdemo0000demo0000demo -->`;

const PR = {
  number: 999,
  title: '涂归 demo 折（不落库）',
  updated_at: new Date(Date.now() - 36e5).toISOString(),
  draft: false,
  node_id: 'DEMO',
  head: { sha: 'demo0000' },
  body: BODY,
};

// 弘文馆的样例折（review #69）。demo 里没有它的话，第三个 tab 点开永远是空的——
// 而「点开里面什么都没有」正是这个功能上一轮报障的原话，demo 不该再复现一次。
// 带 labels 是全部要点：弘文馆的判据只看 `kind:读物`（见 track.js）。
const SHELF_PR = {
  ...PR,
  number: 997,
  title: '读物：弘文馆样例（闲时读，不催）',
  labels: [{ name: 'proj:menxia' }, { name: 'kind:读物' }, { name: 'wait:闲' }],
  updated_at: new Date(Date.now() - 1728e5).toISOString(),
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
  // 坏数据哨兵：回话的 body 不过 parseCommentBody（那个函数自带 String(raw||'')），
  // 是直连 renderMarkdown 的裸调用点。markdown-it 对非字符串直接抛 → 整个 app 白屏。
  // 放这儿当报警器：防线没了整套冒烟会全灭，而不是悄悄少一条。
  {
    id: 104, path: 'docs/demo.md', line: 20, original_line: 20, in_reply_to_id: 101,
    user: { login: 'agent-bot' }, created_at: new Date(Date.now() - 22e5).toISOString(),
    body: null,
  },
];

// 已呈判（会话区）。真实评审历史长这样：agent 一轮一轮追加 changelog，用户偶尔插一句短的。
// issue #1 实测 PR #30 是 9 条 / 8,132 字，全展开把正文推下 2–3 屏。冒烟必须撑到这个量级，
// 否则「正文在首屏」那条断言在短数据上恒真——折叠被改回去也照样绿。
const changelog = (v, head) => `## ${v} ${head}

**改了什么**

${Array.from({ length: 8 }, (_, i) => `${i + 1}. 第 ${i + 1} 处：结论前置，删掉重复的背景铺陈，并补一行取舍依据与它的反面。`).join('\n')}

| 项 | 前 | 后 |
|---|---|---|
| 篇幅 | 长 | 短 |

剩下的分歧留到下一轮，先按这版读。`;

// 数组序 / id 序 / created_at 序三者**故意错开**：真实 GitHub 是三序共线的，而共线数据下
// 「按时间降序」「按 id 降序」「把数组 reverse 一下」三种实现给出同一个答案，断言就白写了。
// 最新的那条（v4 定稿）故意摆在数组中间且 id 不是最大——只有真按 created_at 排才拿得到它。
// body: null 是坏数据哨兵：markdown-it 对非字符串直接抛，抛在组件渲染里就是整个 app 白屏。
const ZONGPIS = [
  { id: 205, user: { login: 'agent-bot' }, created_at: new Date(Date.now() - 34e5).toISOString(), body: changelog('v2', '按批注重写 Why 一节') },
  { id: 203, user: { login: 'agent-bot' }, created_at: new Date(Date.now() - 18e5).toISOString(), body: changelog('v4 定稿', '只留结论与清单') },
  // 相对路径图片：私有仓的 raw 链接取不到，必须换 blob URL。#5 之前评论正文这条路径没接 hydrate，读者看到断图
  { id: 201, user: { login: 'charlie' }, created_at: new Date(Date.now() - 40e5).toISOString(), body: '图好像有问题\n\n![截图](assets/shot.png)' },
  { id: 202, user: { login: 'charlie' }, created_at: new Date(Date.now() - 22e5).toISOString(), body: null },
  { id: 204, user: { login: 'agent-bot' }, created_at: new Date(Date.now() - 28e5).toISOString(), body: changelog('v3', '补齐数据来源') },
];

// ?fail=401|403：让列表接口抛出 ApiError 形状，测消费层的分流（401 才清 token）
const FAIL = new URLSearchParams(location.search).get('fail');
const failErr = () => Object.assign(new Error(`${FAIL} demo failure`), {
  status: +FAIL, tokenDead: FAIL === '401', rateLimited: FAIL === '403',
});

export const demoApi = {
  verifyToken: async () => ({ repo: {}, canWrite: true, prAccess: true }),
  listOpenPRs: async () => { if (FAIL) throw failErr(); return [PR, SHELF_PR]; },
  listMergedPRs: async () => [{
    ...PR, number: 998, title: '涂归 demo 折 · 已画可（归档样例）',
    merged_at: new Date(Date.now() - 864e5).toISOString(),
    body: BODY_FREEFORM,  // 手开折：无五段结构 → 说明块该默认收起（issue #13 的条件展开）
  }],
  listPRFiles: async () => [
    { filename: 'docs/demo.md', status: 'added', patch: PATCH },
    { filename: 'docs/guide.md', status: 'added', patch: '@@ -0,0 +1,3 @@\n+# Guide\n+\n+English variant for the language switch.' },
    { filename: 'docs/guide.zh-CN.md', status: 'added', patch: '@@ -0,0 +1,3 @@\n+# 指南\n+\n+中文版，用来验语言切页。' },
  ],
  // ref 落在旧 rev（非 head sha）时返回删节版，模拟版本间正文差异
  getFileText: async (path, ref) => {
    if (path === 'docs/guide.md') return '# Guide\n\nEnglish variant for the language switch.';
    if (path === 'docs/guide.zh-CN.md') return '# 指南\n\n中文版，用来验语言切页。';
    return ref && ref !== 'demo0000' ? DOC_OLD : DOC;
  },
  // 换 blob URL 的桩：回一张 1×1 gif 的 data URL。原本是 throw（demo 文档里没图，从没被调用过），
  // 但评论正文接上 hydrate 之后要能断言「相对路径真被换掉了」，throw 只能验到降级占位符
  getFileBlobUrl: async (path) => {
    return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  },
  listPRComments: async () => COMMENTS,
  listIssueComments: async () => ZONGPIS,
  listPRCommits: async () => COMMITS,
  submitReview: async (num, payload) => { window.__lastReview = { num, payload }; console.log('[demo] submitReview', num, payload); return {}; },
  // 真往 ZONGPIS 里追加，否则「发完判能不能立刻看见」这条路径在测试基建上不可达
  createIssueComment: async (num, body) => {
    console.log('[demo] 判', num, body);
    ZONGPIS.push({ id: 900 + ZONGPIS.length, user: { login: 'charlie' }, created_at: new Date().toISOString(), body });
    return {};
  },
  mergePR: async (num, sha) => { console.log('[demo] 画可', num, sha); return {}; },
  markReady: async () => {},
};

if (FAIL) {
  localStorage.setItem('zhupi.token', 'github_pat_demo_token');
  localStorage.setItem('zhupi.repo', 'demo/repo');
  setTimeout(() => {
    let pass = 0, fail = 0;
    const chk = (name, cond, detail = '') => {
      cond ? pass++ : fail++;
      console.log(`[smoke] ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const onSetup = Boolean(document.getElementById('setup'));
    const tokenLeft = Boolean(localStorage.getItem('zhupi.token'));
    if (FAIL === '403') {
      // 限流：绝不能清钥匙、也不该把人踢回设置页（历史上误删过有效 token）
      chk('403-keeps-token', tokenLeft);
      chk('403-stays-in-app', !onSetup);
      chk('403-shows-notice', Boolean(document.querySelector('.notice, .state.err')));
    } else {
      chk('401-clears-token', !tokenLeft);
      chk('401-back-to-setup', onSetup);
    }
    console.log(`[smoke] RESULT pass=${pass} fail=${fail}`);
  }, 1200);
}

// ?demo=1&deep=1：验直达进场——URL 带 ?pr=998（归档折）应直接开到它并切到已画可栏
// ?demo=1&deep=miss&pr=9999：验折号找不到时**真的出提示**——pendingNotice 曾经只写不读
// （声明了、赋值了、全文件没有第三处），深链失败一路静默。UI 胶水没测试就是会这样烂掉。
const DEEP = new URLSearchParams(location.search).get('deep');
if (DEEP === '1' || DEEP === 'miss') {
  setTimeout(() => {
    let pass = 0, fail = 0;
    const chk = (n, c, d = '') => { c ? pass++ : fail++; console.log(`[smoke] ${c ? 'PASS' : 'FAIL'} ${n}${d ? ` — ${d}` : ''}`); };
    if (DEEP === 'miss') {
      const notice = document.querySelector('.notice')?.textContent || '';
      chk('deep-miss-notice-shown', notice.includes('9999'), `notice=${notice.slice(0, 60) || '(空)'}`);
    } else {
      const crumb = document.querySelector('.crumb')?.textContent || '';
      chk('deep-opened-target', crumb.includes('已画可') || crumb.includes('归档'), `crumb=${crumb.slice(0, 40)}`);
      const doneTab = [...document.querySelectorAll('.list-tab')].find((b) => b.textContent.includes('已画可'));
      chk('deep-switched-tab', doneTab?.classList.contains('active'));
      chk('deep-readonly', !document.querySelector('.btn-qinci'));
    }
    console.log(`[smoke] RESULT pass=${pass} fail=${fail}`);
  }, 1500);
}

// 自动演示：用真实的 Selection + mouseup + 按钮点击走完「划句 → 存批」两轮
export async function autoAnnotate(docEl) {
  try { await runSmoke(docEl); } catch (err) {
    // 冒烟里任何一处抛错原本会让 RESULT 整个丢失（脚本静默结束）——兜住并自曝
    console.log(`[smoke] FAIL harness-exception — ${err && err.message}`);
    console.log('[smoke] RESULT pass=0 fail=1');
  }
}

async function runSmoke(docEl) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rangeFor = (text) => {
    const block = [...docEl.querySelectorAll('[data-line]')].find((b) => b.textContent.includes(text));
    if (!block) return null;
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
    return r;
  };
  const pick = async (text, note, save) => {
    const r = rangeFor(text);
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

  // 触屏路径（iPad 实测：接触控板能批、手指不能）。iOS Safari 把长按选字与拖手柄整段手势
  // 交给原生选择 UI，不派发合成 mouse 事件——只挂 mouseup 时手指选中后浮钮永远不出。
  // 两条钉死两侧：手指要能出钮；鼠标按下拖选途中不许出钮（桌面零回归的闸门——selectionchange
  // 在拖选期间连续派发，误让它对鼠标生效的话浮钮会在松手前就冒出来跟着选区跳）。
  const tRange = rangeFor('迁移到 Preact 之后');
  chk('touch-probe-range-built', Boolean(tRange)); // 防靶文失配导致下面两条空转假绿
  if (tRange) {
    document.dispatchEvent(new Event('touchstart', { bubbles: true })); // 早于长按被系统接管
    getSelection().removeAllRanges();
    getSelection().addRange(tRange);
    await sleep(450); // 过 250ms 防抖
    chk('touch-selection-shows-float', Boolean(document.querySelector('.zhupi-float')));

    getSelection().removeAllRanges();
    await sleep(400); // 让上一轮防抖落地收钮，再验鼠标侧
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    getSelection().addRange(tRange); // 模拟按住拖选：选区在变，但还没 mouseup
    await sleep(450);
    chk('mouse-drag-holds-float-until-mouseup', !document.querySelector('.zhupi-float'));
    getSelection().removeAllRanges();
    await sleep(50);
  }

  await pick('镜片随时可以摘掉', '这句放结尾太谦虚了，提到开头', true);
  await pick('const DEBOUNCE_MS = 300;', '300ms 的依据补个注释', false);

  // 长文档必须可滚（#root 高度链断裂那类雷靠这条抓；demo 文档特意长过一屏）。
  // 滚动主体跟着布局模型走：桌面内滚在 .work，窄屏（≤900px）整页滚在 document——
  // 谁在窄窗口跑冒烟，这条不该假红。
  const work = document.querySelector('.work');
  const narrow = matchMedia('(max-width: 900px)').matches;
  const sEl = narrow ? document.scrollingElement : work;
  const sMax = narrow ? innerHeight : (work?.clientHeight ?? 0);
  chk('long-doc-scrollable', Boolean(sEl && sEl.scrollHeight > sMax),
    `narrow=${narrow} scrollH=${sEl?.scrollHeight} viewH=${sMax}`);

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

  // 展读浮窗：把串从 300px 眉批栏捞出来铺宽。三条退路（掩卷钮 / Esc / 点幕布）各守一条——
  // 关不掉的模态窗是这类功能唯一致命的坏法，所以三条都试，且每条都要真的把 DOM 清干净。
  const expBtn = document.querySelector('#margin-col .anno-shown .anno-expand');
  const expStyle = expBtn && getComputedStyle(expBtn);
  chk('thread-expand-btn-actually-clickable',
    Boolean(expBtn) && expStyle.pointerEvents !== 'none' && expStyle.visibility === 'visible'
    && expBtn.offsetHeight > 0,
    `btn=${Boolean(expBtn)} pe=${expStyle?.pointerEvents} h=${expBtn?.offsetHeight}`);
  const expCardW = expBtn?.closest('.anno-card')?.getBoundingClientRect().width || 0;
  expBtn?.click();
  await sleep(200);
  const tvPanel = document.querySelector('.thread-view');
  chk('thread-view-opens-on-expand', Boolean(tvPanel));
  // 这条是整个功能的判据：浮窗若还是眉批栏那点宽度，等于什么都没做。
  const tvW = tvPanel?.getBoundingClientRect().width || 0;
  chk('thread-view-wider-than-margin-card', tvW > expCardW * 2,
    `panel=${Math.round(tvW)} card=${Math.round(expCardW)}`);
  chk('thread-view-body-rendered',
    (document.querySelector('.thread-view .anno-shown-body')?.textContent || '').trim().length > 0);
  document.querySelector('.thread-view-close')?.click();
  await sleep(200);
  chk('thread-view-close-btn-closes', !document.querySelector('.thread-view'));

  expBtn?.click();
  await sleep(200);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(200);
  chk('thread-view-esc-closes', !document.querySelector('.thread-view'));

  expBtn?.click();
  await sleep(200);
  const tvBack = document.querySelector('.thread-view-backdrop');
  tvBack?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await sleep(200);
  chk('thread-view-backdrop-closes', !document.querySelector('.thread-view'));

  // issue #13：折子说明（PR body 五段）。这折的 body 有「待你拍板」→ 必须默认摊开，
  // 不点任何东西就能读到拍板点。这是本 issue 的全部要害：该被看见的东西不许静默消失。
  const fbToggle = document.querySelector('.folder-body-toggle');
  const fbLabel = (fbToggle?.textContent || '').replace(/\s+/g, ' ').trim();
  chk('body-expanded-by-default-with-decisions',
    Boolean(fbToggle) && fbToggle.getAttribute('aria-expanded') === 'true'
    && Boolean(document.querySelector('.folder-body-text')),
    `label=${fbLabel} aria=${fbToggle?.getAttribute('aria-expanded')}`);
  chk('body-decisions-visible-without-click',
    (document.querySelector('.folder-body-text')?.textContent || '').includes('折首折叠块（B）还是独立 tab（A）'),
    `label=${fbLabel}`);
  // 「回奏对」标记是 HTML 注释，而 markdown-it 在 html:false 下把它**转义成可见文本**，
  // 不剥就是每折正文尾巴上挂一行 `<!-- happy-session: … -->` 给读者看。
  chk('body-session-marker-not-visible',
    !(document.querySelector('.folder-body')?.textContent || '').includes('happy-session'),
    `tail=${(document.querySelector('.folder-body-text')?.textContent || '').slice(-40)}`);
  // 真走 markdown 渲染（与评论正文同一条路），不是 pre-wrap 把 ## 和表格裸露给读者
  chk('body-markdown-rendered',
    Boolean(document.querySelector('.folder-body-text h2')) &&
    Boolean(document.querySelector('.folder-body-text table')),
    `h2=${document.querySelectorAll('.folder-body-text h2').length}`);
  const fbBox = document.querySelector('.folder-body');
  chk('body-block-in-flow-above-doc',
    getComputedStyle(fbBox).position === 'static'
    && fbBox.getBoundingClientRect().bottom <= document.getElementById('doc').getBoundingClientRect().top + 1,
    `pos=${getComputedStyle(fbBox).position}`);
  // 收得回去：折叠钮不是装饰，aria-expanded 要跟着状态走（#5 补的那条无障碍规矩）
  fbToggle?.click();
  await sleep(200);
  chk('body-toggle-collapses',
    !document.querySelector('.folder-body-text')
    && document.querySelector('.folder-body-toggle')?.getAttribute('aria-expanded') === 'false');
  document.querySelector('.folder-body-toggle')?.click();  // 复原，别影响后面的断言
  await sleep(200);

  // F1（摘要卡）：TLDR 那句在折首常显——收起态也在，不必展开就看得见「这折说了什么」。
  chk('folder-body-tldr-always-visible',
    (document.querySelector('.folder-body-tldr')?.textContent || '').includes('PR body 的五段结构化正文此前在门下不可见'),
    `tldr=${(document.querySelector('.folder-body-tldr')?.textContent || 'NONE').slice(0, 30)}`);

  // issue #1：已呈判默认折叠。这块坐在正文之上，全展开就把文档推出首屏，
  // 读者滚不到文档自己的 TL;DR（PR #30 实测 9 条 / 8,132 字 ≈ 2–3 屏）。
  const zpToggle = document.querySelector('.zongpi-shown-toggle');
  const zpLabel = (zpToggle?.textContent || '').replace(/\s+/g, ' ').trim();
  chk('zongpi-collapsed-by-default',
    Boolean(zpToggle) && document.querySelectorAll('.zongpi-shown-item').length === 0,
    `items=${document.querySelectorAll('.zongpi-shown-item').length}`);
  chk('zongpi-toggle-shows-count-and-gist',
    zpLabel.includes('已呈判 · 5') && zpLabel.includes('最新：v4 定稿'), `label=${zpLabel}`);
  // 正文起点必须紧贴总批折叠块。量两个盒子之间的距离，而非 viewport 坐标——与当前滚动位置无关。
  // 阈值不用 window.innerHeight：拿视口高当尺子等于白送 80–130px 松弛；也不用 clientHeight
  // （那是「勉强够一屏」，松 700+px，「默认展开最新一条」这种半吊子回归照样能钻过去）——
  // 验收标准是「折叠块只占一行」，钉死 320。
  //
  // **起点从 .work 顶改成总批块底（issue #13）**：折子说明块进来之后坐在总批之上，且按设计
  // 有拍板点就默认展开，量到 .work 顶会把它的高度算进来，这条断言就变成在管别的事了。
  // 这条要守的一直是「总批块不许默认摊开挡住正文」，量它自己的底到正文顶最贴题。
  const workEl = document.querySelector('.work');
  const docBox = document.getElementById('doc');
  const foldBox = document.querySelector('.zongpi-shown');
  const docOffset = foldBox && docBox
    ? docBox.getBoundingClientRect().top - foldBox.getBoundingClientRect().bottom
    : -1;
  chk('doc-starts-right-below-fold', docOffset >= 0 && docOffset < 320,
    `offset=${Math.round(docOffset)} limit=320 workH=${workEl?.clientHeight} vh=${window.innerHeight}`);
  // ↑ 那条改窄之后，「上面所有块加起来不许把正文顶下去」这个**累计预算**就没人守了 —— 而
  // 折子说明块恰恰默认展开、长度由写折方决定。所以把累计那条单独补回来（复审补）：
  // 量 .work 顶到正文顶，语义是「最多趟过一屏就够到正文」。阈值用视口高而不是钉死 320：
  // 说明块按设计要占地方（CSS 封顶 42vh），钉 320 会把合法设计判红；而一屏是 issue #1
  // 那句抱怨（「读者滚不到文档自己的 TL;DR」）的字面含义，超了就是真的又犯了。
  const stackOffset = workEl && docBox
    ? docBox.getBoundingClientRect().top - workEl.getBoundingClientRect().top + workEl.scrollTop
    : -1;
  chk('doc-within-one-screen-of-top', stackOffset >= 0 && stackOffset < window.innerHeight,
    `stack=${Math.round(stackOffset)} limit=${window.innerHeight}`);
  // F13：正文里的【需核实】被渲染成可见标记（虚线 + 角标），且顶栏出「需核实 N」计数。
  // 纯文本层做的——标记里就是 token 本体，没引入任何原始 HTML。
  const vMark = document.querySelector('#doc .verify-marker');
  chk('verify-marker-rendered', Boolean(vMark) && vMark.textContent.includes('需核实'),
    `text=${vMark?.textContent}`);
  chk('verify-count-in-topbar', (document.querySelector('.verify-count')?.textContent || '').includes('需核实'),
    `count=${document.querySelector('.verify-count')?.textContent}`);
  // 封顶必须真的生效：展开态的说明块正文不许超过 42vh（+2px 取整余量）。没有这条，
  // 上面那条累计预算能被一个「刚好这次 fixture 不长」蒙混过去，长 body 上线才炸。
  const fbText = document.querySelector('.folder-body .folder-body-text');
  const fbH = fbText ? fbText.getBoundingClientRect().height : -1;
  chk('folder-body-height-capped', fbText !== null && fbH <= window.innerHeight * 0.42 + 2,
    `h=${Math.round(fbH)} cap=${Math.round(window.innerHeight * 0.42)}`);
  // 总批块不许脱离文档流去「假装」不占位（绝对定位/负 margin 能骗过上面那条，但会盖住正文）
  // 判块不许脱离文档流去「假装」不占位（绝对定位/负 margin 能骗过上面那条，但会盖住正文）
  const zpBox = document.querySelector('.zongpi-shown');
  chk('zongpi-in-flow-above-doc',
    getComputedStyle(zpBox).position === 'static' &&
    zpBox.getBoundingClientRect().bottom <= docBox.getBoundingClientRect().top + 1,
    `pos=${getComputedStyle(zpBox).position}`);
  // 程序化 .click() 不做命中测试：按钮可以被 pointer-events:none / 遮挡 / 零高度弄成真人点不开
  const tStyle = getComputedStyle(zpToggle);
  chk('zongpi-toggle-actually-clickable',
    tStyle.pointerEvents !== 'none' && tStyle.visibility === 'visible' && zpToggle.offsetHeight > 0,
    `pe=${tStyle.pointerEvents} vis=${tStyle.visibility} h=${zpToggle.offsetHeight}`);

  // 展开：最新的在最上面 + markdown 真渲染（此前 pre-wrap 把 ## / ** / 表格裸露给读者）
  zpToggle?.click();
  await sleep(200);
  const zpItems = [...document.querySelectorAll('.zongpi-shown-item')];
  chk('zongpi-expands-all', zpItems.length === ZONGPIS.length, `items=${zpItems.length}/${ZONGPIS.length}`);
  chk('zongpi-newest-first', (zpItems[0]?.textContent || '').includes('v4 定稿'),
    `first=${(zpItems[0]?.textContent || '').replace(/\s+/g, ' ').slice(0, 30)}`);
  chk('zongpi-markdown-rendered',
    Boolean(document.querySelector('.zongpi-shown-body h2')) &&
    Boolean(document.querySelector('.zongpi-shown-body table')),
    `h2=${document.querySelectorAll('.zongpi-shown-body h2').length}`);
  // #5：评论正文里的相对路径图片要换成 blob/data URL；没接 hydrate 的话 src 还是 assets/... 必 404
  const zpImg = document.querySelector('.zongpi-shown-body img');
  chk('comment-relative-image-hydrated',
    Boolean(zpImg) && /^(data:|blob:)/.test(zpImg.getAttribute('src') || ''),
    `src=${(zpImg?.getAttribute('src') || 'NO-IMG').slice(0, 24)}`);
  zpToggle?.click();
  await sleep(200);
  chk('zongpi-recollapses', document.querySelectorAll('.zongpi-shown-item').length === 0,
    `items=${document.querySelectorAll('.zongpi-shown-item').length}`);

  // 卡片排序：右缘卡必须按锚点行号递增（草稿与已呈串合并排序，否则串卡被压到天边）
  const tops = [...document.querySelectorAll('#margin-col .anno-card')]
    .map((el) => ({ line: +el.dataset.blockLine || 0, top: parseFloat(el.style.top) || 0 }))
    .filter((x) => x.line);
  chk('margin-cards-present', tops.length >= 4, `n=${tops.length}`); // 防空集假绿：属性没了 every() 恒真
  const sortedByLine = [...tops].sort((a, b) => a.line - b.line);
  chk('margin-cards-ordered', sortedByLine.every((x, i, arr) => i === 0 || x.top >= arr[i - 1].top),
    JSON.stringify(sortedByLine));

  // ⌘Enter 在批注框里只该「存批」，绝不能把整批呈出去（历史阻断级 bug：事件冒泡到全局监听器）
  const editingTa = document.querySelector('.anno-input');
  if (editingTa) {
    editingTa.focus();
    editingTa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    await sleep(200);
  }
  chk('cmd-enter-in-draft-card-not-submit', !window.__lastReview);

  // 真暴露面：判输入框没有自己的 keydown 处理，⌘Enter 从这里直冲全局监听器
  // （写判写到一半把攒着的 inline 草稿全发出去——第二轮评审点名的第二触发面）
  [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent.includes('判'))?.click();
  await sleep(200);
  const zongpiTa = document.querySelector('.zongpi-card .anno-input');
  chk('zongpi-card-open', Boolean(zongpiTa));
  if (zongpiTa) {
    zongpiTa.focus();
    zongpiTa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    await sleep(250);
  }
  chk('cmd-enter-in-zongpi-not-submit', !window.__lastReview);
  // 真呈一条判（此前只点「作罢」，createIssueComment 在整套冒烟里一次都没被调用过）：
  // 折叠组默认收起之后，自己刚呈的那条必须自动冒出来——否则就退回「判只能发不能看」的老缺口，
  // 而 ui.js 里那句「重拉：让刚呈的判立刻显示在折首」原本正是为它写的。
  const zpBefore = document.querySelectorAll('.zongpi-shown-item').length;
  if (zongpiTa) {
    zongpiTa.value = '刚呈的这条判必须自己冒出来';
    document.querySelector('.zongpi-card .anno-save')?.click();
    await sleep(500);
  }
  const zpAfter = [...document.querySelectorAll('.zongpi-shown-item')];
  chk('zongpi-auto-opens-after-send', zpBefore === 0 && zpAfter.length === ZONGPIS.length,
    `before=${zpBefore} after=${zpAfter.length} total=${ZONGPIS.length}`);
  chk('zongpi-just-sent-on-top', (zpAfter[0]?.textContent || '').includes('刚呈的这条判'),
    `first=${(zpAfter[0]?.textContent || '').replace(/\s+/g, ' ').slice(0, 24)}`);
  await sleep(150);
  const savedNotes = (JSON.parse(localStorage.getItem('zhupi.drafts.999') || '{}')?.items || [])
    .filter((d) => d.note && d.note.trim()).length;
  chk('cmd-enter-saves-draft', savedNotes >= 2, `notes=${savedNotes}`);

  // rev 切换器（3 个 rev）
  // 搜索：标题filter + 全文命中 + 点击直达段落（跳转闪一下）
  const si = document.querySelector('.search-input');
  chk('search-input-exists', Boolean(si));
  if (si) {
    const setVal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setVal.call(si, '镜片');
    si.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(150);
    si.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(500);
  }
  const groups = document.querySelectorAll('.search-group');
  chk('search-hits-found', groups.length >= 1, `groups=${groups.length}`);
  // 点当前折（#999）的正文命中 → 应跳到那一段并闪一下
  const g999 = [...groups].find((g) => g.textContent.includes('#999'));
  const hitBtn = g999 && [...g999.querySelectorAll('.search-hit')].find((b) => b.textContent.includes('第'));
  if (hitBtn) { hitBtn.click(); await sleep(1000); }
  chk('search-jump-flash', Boolean(document.querySelector('#doc .search-flash')));
  // 清掉搜索回到清单
  document.querySelector('.search-clear')?.click();
  await sleep(200);
  chk('search-clear-restores', Boolean(document.querySelector('.list-tabs')));

  // F8 语言切页：双语折出中/EN chip，切换只换语言不离开折；tab 里成对的只列一个
  const tabsNow = [...document.querySelectorAll('.doc-tab')].map((b) => b.textContent.trim());
  // 成对的只出一个 tab，且标签不带语言后缀（语言由 chip 表达）
  chk('lang-tabs-collapsed', tabsNow.length === 2 && !tabsNow.some((t) => t.includes('zh-CN')),
    `tabs=${tabsNow.join('|')}`);
  const guideTab = [...document.querySelectorAll('.doc-tab')].find((b) => b.textContent.includes('guide'));
  if (guideTab) { guideTab.click(); await sleep(600); }
  const chip = document.querySelector('.lang-switch');
  chk('lang-chip-on-bilingual', Boolean(chip));
  chk('lang-default-zh', (document.querySelector('#doc h1')?.textContent || '').includes('指南'),
    `h1=${document.querySelector('#doc h1')?.textContent}`);
  const enBtn = [...document.querySelectorAll('.lang-opt')].find((b) => b.textContent.trim() === 'EN');
  if (enBtn) { enBtn.click(); await sleep(600); }
  chk('lang-switch-to-en', (document.querySelector('#doc h1')?.textContent || '').includes('Guide'),
    `h1=${document.querySelector('#doc h1')?.textContent}`);
  // 切回中文并回到主文档，别影响后面的断言
  [...document.querySelectorAll('.lang-opt')].find((b) => b.textContent.trim() === '中')?.click();
  await sleep(400);
  [...document.querySelectorAll('.doc-tab')].find((b) => b.textContent.includes('demo'))?.click();
  // #2：换文档那一拍——卡片已按新文档重建，正文岛屿还没取回来。此刻卡片必须已经有定位，
  // 否则就是「全塌到容器顶端叠成一坨、等一个网络往返才归位」。取样点必须在 sleep 之前，
  // 等下去就看不见了（demo 的 api 零延迟，真 GitHub 上这个窗口是一整个往返）。
  await Promise.resolve();
  const midTops = [...document.querySelectorAll('#margin-col .anno-card')].map((el) => el.style.top);
  chk('cards-positioned-during-doc-switch',
    midTops.length > 0 && midTops.every((t) => t && t !== 'auto'),
    `n=${midTops.length} tops=${midTops.map((t) => t || 'UNSET').join('|') || 'NONE'}`);
  await sleep(600);

  // 折间链接：本仓链接被拦成 app 内跳转；外链放行不拦
  const links = [...document.querySelectorAll('#doc a[href]')];
  const inner = links.find((a) => a.getAttribute('href').includes('/blob/main/docs/demo.md#L20'));
  const outer = links.find((a) => a.getAttribute('href').includes('slopus/happy'));
  chk('link-samples-rendered', Boolean(inner && outer));
  if (inner) {
    inner.click();
    await sleep(150); // 虚拟时间下 1600ms 的移除定时器会跑到长 sleep 前面——在闪现窗口内断言
    const flashed = document.querySelectorAll('.search-flash').length;
    chk('link-jump-flash', flashed >= 1,
      `flash=${flashed} href=${inner.getAttribute('href')} tab=${document.querySelector('.doc-tab.active')?.textContent || '-'}`);
  }
  if (outer) {
    // 外链必须放行——但真放行就会导航走、页面死掉。做法：在 document 上挂一次性监听器，
    // 它跑在 app 的 .read-row 处理器之后：先读 defaultPrevented（即 app 的决定），再拦下导航。
    let appPrevented = null;
    document.addEventListener('click', function once(e) {
      appPrevented = e.defaultPrevented;
      e.preventDefault();
      document.removeEventListener('click', once);
    });
    outer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(150);
    chk('external-link-not-hijacked', appPrevented === false, `appPrevented=${appPrevented}`);
  }
  // 引用此处：拷出的 markdown 能被自己解析回来
  const refBtn = [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent.includes('引用此处'));
  chk('copy-ref-btn-exists', Boolean(refBtn));

  // 归档视图：已画可的折子有地方看，且点进去是只读
  const doneTab = [...document.querySelectorAll('.list-tab')].find((b) => b.textContent.includes('已画可'));
  chk('archive-tab-exists', Boolean(doneTab), doneTab?.textContent?.trim());
  if (doneTab) {
    doneTab.click(); await sleep(200);
    chk('archive-has-items', document.querySelectorAll('#pr-list .pr-item').length >= 1);
    document.querySelector('#pr-list .pr-item')?.click();
    await sleep(800);
    chk('archive-readonly-no-qinci', !document.querySelector('.btn-qinci'));
    chk('archive-readonly-notice', (document.querySelector('.rev-notice')?.textContent || '').includes('归档'));
    // issue #13 的条件展开另一半：归档折的 body 是手开的散文（无五段），认不出拍板点 ⇒ 默认收起。
    // 逐折重算的证据也在这条里——上一折是展开态，切过来必须自己变回收起。
    const fbArc = document.querySelector('.folder-body-toggle');
    chk('archive-body-collapsed-without-decisions',
      Boolean(fbArc) && fbArc.getAttribute('aria-expanded') === 'false'
      && !document.querySelector('.folder-body-text'),
      `aria=${fbArc?.getAttribute('aria-expanded')}`);
    // 归档折上划句不该出浮批钮
    const blk = [...document.querySelectorAll('#doc [data-line]')]
      .find((x) => x.textContent.trim().length > 4);
    if (blk) {
      const r = document.createRange(); r.selectNodeContents(blk);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.getElementById('doc').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await sleep(200);
    }
    chk('archive-float-suppressed', !document.querySelector('.zhupi-float'));
    // 切回待审继续后面的断言。
    // 用 data-tab 不用文字：这行原来是 textContent.includes('待批')，2026-08-02 把词表漏网的
    // 「待批」改成定稿词「待审」时，find 静默返回 undefined —— 没点、没报错，后面 6 条断言
    //（摘要卡 + 整条 submit 管线）连锁塌掉，看起来像提交管线坏了。裸字符串当跨层契约就是这样：
    // 改了不报错，只是什么都不做。选择器一律锚在不上屏的属性上。
    const openTab = document.querySelector('.list-tab[data-tab="open"]');
    if (!openTab) chk('list-tab-open-selector', false, '找不到 [data-tab="open"]——选择器与渲染脱钩了');
    openTab?.click();
    await sleep(200);
    // F1（摘要卡）：待批清单里，带五段 body 的折要出摘要行——一句 TLDR gist + 拍板角标，
    // 不点进去就看得出「这折干了什么、要不要你拍板」。归档折（BODY_FREEFORM 无 TLDR）不出摘要行。
    const openSummary = document.querySelector('#pr-list .pr-item .pr-summary');
    chk('list-summary-tldr-and-decisions',
      Boolean(openSummary)
      && (openSummary.querySelector('.pr-tldr')?.textContent || '').includes('本折把它渲染到折首')
      && (openSummary.querySelector('.pr-decisions')?.textContent || '').includes('待你拍板'),
      `summary=${(openSummary?.textContent || 'NONE').replace(/\s+/g, ' ').slice(0, 40)}`);
    document.querySelector('#pr-list .pr-item')?.click();
    await sleep(900);
  }

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

  // 旧版下走键盘路径也必须被挡（按钮 disabled 挡不住 ⌘Enter 直呼 submitAll）
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
  await sleep(200);
  chk('old-rev-cmd-enter-blocked', !window.__lastReview);

  // 切回 head 后真点一次「提交涂归」——覆盖提交管线最后一公里：
  // hunk gate 装配 / commit_id / 行号集合 / 成功后清草稿
  const opts = [...document.querySelectorAll('.rev-opt')];
  opts[opts.length - 1]?.click();
  await sleep(600);
  document.querySelector('.btn-submit')?.click();
  await sleep(500);
  const sent = window.__lastReview;
  chk('submit-fired', Boolean(sent));
  const lines = (sent?.payload?.comments || []).map((c) => c.line).sort((a, b) => a - b);
  chk('submit-line-set', JSON.stringify(lines) === '[16,20]', `lines=${JSON.stringify(lines)}`);
  chk('submit-commit-id', sent?.payload?.commitId === 'demo0000', `commitId=${sent?.payload?.commitId}`);
  chk('submit-body-nonempty', Boolean(sent?.payload?.body));
  const leftover = JSON.parse(localStorage.getItem('zhupi.drafts.999') || '{}')?.items?.length ?? -1;
  chk('drafts-cleared-after-submit', leftover === 0, `leftover=${leftover}`);

  // ── 空草稿死锁（2026-08-05 报障，放在提交之后跑：那时草稿已清空，是干净起点）──
  // 原话：「第二个的那个评论我没加东西，不让我提交。然后我想过去加东西，结果点不开那个评论栏了」。
  // 划句建了草稿却没写字就去划下一句 ⇒ 空草稿留在原地 ⇒ 它退出编辑态后画的 `.anno-note` 内容为空
  // ⇒ 高 0px ⇒ 点不着；作罢钮只在编辑态里 ⇒ 删不掉；呈回闸门拦「空批注不呈」 ⇒ 交不上。三头堵死。
  // 两层各钉一条：① 焦点切走时空草稿自己收掉；② 存量空草稿仍留得住手（占位撑起可点的靶子）。
  await pick('镜片随时可以摘掉', '', false);                 // 建了不写
  chk('empty-draft-starts-editing', Boolean(document.querySelector('.anno-input')));
  await pick('const DEBOUNCE_MS = 300;', '改去写这句', true);  // 焦点切到新草稿
  const afterSwitch = JSON.parse(localStorage.getItem('zhupi.drafts.999') || '{}')?.items || [];
  chk('empty-draft-dropped-on-switch',
    afterSwitch.length === 1 && afterSwitch[0].note === '改去写这句',
    `left=${JSON.stringify(afterSwitch.map((d) => d.note))}`);

  // 存量退路：把一条空草稿塞回 storage 再开折（模拟修复前已经卡在那儿的），它必须仍是实体靶子。
  // 判据用 offsetHeight 而不是「元素在不在」——病根正是元素在、但高度为 0。
  if (afterSwitch.length) {
    localStorage.setItem('zhupi.drafts.999',
      JSON.stringify({ items: [{ ...afterSwitch[0], id: 'stuck', note: '' }] }));
    document.querySelector('#pr-list .pr-item')?.click();
    await sleep(700);
    const stuck = document.querySelector('.anno-note-empty');
    chk('stale-empty-draft-still-clickable',
      Boolean(stuck) && stuck.offsetHeight > 0 && getComputedStyle(stuck).pointerEvents !== 'none',
      `el=${Boolean(stuck)} h=${stuck?.offsetHeight}`);
    stuck?.click();
    await sleep(200);
    chk('stale-empty-draft-opens-editor', Boolean(document.querySelector('.anno-input')));
  }

  // ── 页内锚点 + 顶底悬浮钮（PAIN 2026-08-05 #86：「？？？ 选项呢 原来在下面」）──
  // **必须放最后**：这一段会把版心滚到底，早跑会掀翻前面那批量位置的断言
  // （doc-starts-right-below-fold / cards-positioned-during-doc-switch 都读 scrollTop）。
  const dEl = document.getElementById('doc');
  const anchors = [...dEl.querySelectorAll('a[href^="#"]')];
  const head = [...dEl.querySelectorAll('h2[id]')].find((h) => h.id === '加长段冒烟用别删');
  chk('anchor-heading-has-github-slug', Boolean(head),
    `ids=${[...dEl.querySelectorAll('[id]')].map((h) => h.id).join('|') || 'NONE'}`);
  chk('anchor-links-rendered', anchors.length === 3, `n=${anchors.length}`);
  if (head && anchors.length === 3) {
    anchors[0].click();
    await sleep(150);   // 闪现只留 1600ms，虚拟时间下别用长 sleep（同 link-jump-flash）
    chk('anchor-click-flashes-heading', head.classList.contains('search-flash'));
    // 地址栏不许挂 hash：它是深链的载体，多一截就把「拷直达链」拷脏了
    chk('anchor-click-keeps-url-clean', !location.hash, `hash=${location.hash}`);

    head.classList.remove('search-flash');   // 不清就是假绿——上一条留下的 class 还挂着
    anchors[1].click();
    await sleep(150);
    chk('anchor-loose-frag-matches', head.classList.contains('search-flash'));

    anchors[2].click();
    await sleep(150);
    const notices = [...document.querySelectorAll('.notice')].map((n) => n.textContent);
    chk('anchor-miss-says-so-not-silent', notices.some((t) => t.includes('根本没有这一节')),
      `notices=${notices.join('|') || 'NONE'}`);

    // 折首说明里的锚也要拦（它在 .read-row **之外**）。不拦就走浏览器原生跳转：
    // 不闪、不过三级放宽，还往地址栏挂 hash 把「拷直达链」拷脏。
    head.classList.remove('search-flash');
    const bodyAnchor = document.querySelector('.folder-body a[href^="#"]')
      || [...document.querySelectorAll('a[href^="#"]')].find((x) => !dEl.contains(x));
    chk('folder-body-anchor-rendered', Boolean(bodyAnchor));
    if (bodyAnchor) {
      bodyAnchor.click();
      await sleep(150);
      chk('anchor-in-folder-body-intercepted',
        head.classList.contains('search-flash') && !location.hash, `hash=${location.hash}`);
    }
  }

  const ends = () => [...document.querySelectorAll('.scroll-end')];
  chk('scroll-ends-rendered', ends().length === 2, `n=${ends().length}`);
  if (ends().length === 2) {
    const host = document.querySelector('.work');
    ends()[1].click();                        // ↓ 到底
    await sleep(250);
    const max = host.scrollHeight - host.clientHeight;
    chk('scroll-end-jumps-to-bottom', host.scrollTop >= max - 8, `top=${host.scrollTop} max=${max}`);
    ends()[0].click();                        // ↑ 回顶
    await sleep(250);
    chk('scroll-end-jumps-to-top', host.scrollTop === 0, `top=${host.scrollTop}`);
  }

  console.log(`[smoke] RESULT pass=${pass} fail=${fail}`);
}
