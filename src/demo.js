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

折间链接测试：见 [另一折](https://github.com/demo/repo/pull/998) 与 [本折某行](https://github.com/demo/repo/blob/main/docs/demo.md#L20)；外链 [GitHub](https://github.com/slopus/happy) 不该被拦。

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
  body: '演示折。\n\n<!-- happy-session: cmsdemo0000demo0000demo -->',
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

// 已呈总批（会话区）。真实评审历史长这样：agent 一轮一轮追加 changelog，用户偶尔插一句短的。
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
  { id: 201, user: { login: 'charlie' }, created_at: new Date(Date.now() - 40e5).toISOString(), body: '图好像有问题' },
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
  listOpenPRs: async () => { if (FAIL) throw failErr(); return [PR]; },
  listMergedPRs: async () => [{
    ...PR, number: 998, title: '朱批 demo 折 · 已钦此（归档样例）',
    merged_at: new Date(Date.now() - 864e5).toISOString(),
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
  getFileBlobUrl: async () => { throw new Error('demo 无图'); },
  listPRComments: async () => COMMENTS,
  listIssueComments: async () => ZONGPIS,
  listPRCommits: async () => COMMITS,
  submitReview: async (num, payload) => { window.__lastReview = { num, payload }; console.log('[demo] submitReview', num, payload); return {}; },
  // 真往 ZONGPIS 里追加，否则「发完总批能不能立刻看见」这条路径在测试基建上不可达
  createIssueComment: async (num, body) => {
    console.log('[demo] 总批', num, body);
    ZONGPIS.push({ id: 900 + ZONGPIS.length, user: { login: 'charlie' }, created_at: new Date().toISOString(), body });
    return {};
  },
  mergePR: async (num, sha) => { console.log('[demo] 钦此', num, sha); return {}; },
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

// ?demo=1&deep=1：验直达进场——URL 带 ?pr=998（归档折）应直接开到它并切到已钦此栏
if (new URLSearchParams(location.search).get('deep') === '1') {
  setTimeout(() => {
    let pass = 0, fail = 0;
    const chk = (n, c, d = '') => { c ? pass++ : fail++; console.log(`[smoke] ${c ? 'PASS' : 'FAIL'} ${n}${d ? ` — ${d}` : ''}`); };
    const crumb = document.querySelector('.crumb')?.textContent || '';
    chk('deep-opened-target', crumb.includes('已钦此') || crumb.includes('归档'), `crumb=${crumb.slice(0, 40)}`);
    const doneTab = [...document.querySelectorAll('.list-tab')].find((b) => b.textContent.includes('已钦此'));
    chk('deep-switched-tab', doneTab?.classList.contains('active'));
    chk('deep-readonly', !document.querySelector('.btn-qinci'));
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

  // issue #1：已呈总批默认折叠。这块坐在正文之上，全展开就把文档推出首屏，
  // 读者滚不到文档自己的 TL;DR（PR #30 实测 9 条 / 8,132 字 ≈ 2–3 屏）。
  const zpToggle = document.querySelector('.zongpi-shown-toggle');
  const zpLabel = (zpToggle?.textContent || '').replace(/\s+/g, ' ').trim();
  chk('zongpi-collapsed-by-default',
    Boolean(zpToggle) && document.querySelectorAll('.zongpi-shown-item').length === 0,
    `items=${document.querySelectorAll('.zongpi-shown-item').length}`);
  chk('zongpi-toggle-shows-count-and-gist',
    zpLabel.includes('已呈总批 · 5') && zpLabel.includes('最新：v4 定稿'), `label=${zpLabel}`);
  // 正文起点必须紧贴折首。量滚动容器内的偏移量而非 viewport 坐标——与当前滚动位置无关。
  // 阈值不用 window.innerHeight：滚动容器是 .work，它上面还有 mainbar/notice 吃掉 80–130px，
  // 拿视口高当尺子等于白送这么多松弛。也不用 clientHeight（那是「勉强够一屏」，松 700+px，
  // 「默认展开最新一条」这种半吊子回归照样能钻过去）——验收标准是「折叠块只占一行」，钉死 320。
  const workEl = document.querySelector('.work');
  const docBox = document.getElementById('doc');
  const docOffset = workEl && docBox
    ? docBox.getBoundingClientRect().top - workEl.getBoundingClientRect().top + workEl.scrollTop
    : -1;
  chk('doc-starts-right-below-fold', docOffset >= 0 && docOffset < 320,
    `offset=${Math.round(docOffset)} limit=320 workH=${workEl?.clientHeight} vh=${window.innerHeight}`);
  // 总批块不许脱离文档流去「假装」不占位（绝对定位/负 margin 能骗过上面那条，但会盖住正文）
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

  // 真暴露面：总批输入框没有自己的 keydown 处理，⌘Enter 从这里直冲全局监听器
  // （写总批写到一半把攒着的 inline 草稿全发出去——第二轮评审点名的第二触发面）
  [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent.includes('总批'))?.click();
  await sleep(200);
  const zongpiTa = document.querySelector('.zongpi-card .anno-input');
  chk('zongpi-card-open', Boolean(zongpiTa));
  if (zongpiTa) {
    zongpiTa.focus();
    zongpiTa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    await sleep(250);
  }
  chk('cmd-enter-in-zongpi-not-submit', !window.__lastReview);
  // 真呈一条总批（此前只点「作罢」，createIssueComment 在整套冒烟里一次都没被调用过）：
  // 折叠组默认收起之后，自己刚呈的那条必须自动冒出来——否则就退回「总批只能发不能看」的老缺口，
  // 而 ui.js 里那句「重拉：让刚呈的总批立刻显示在折首」原本正是为它写的。
  const zpBefore = document.querySelectorAll('.zongpi-shown-item').length;
  if (zongpiTa) {
    zongpiTa.value = '刚呈的这条总批必须自己冒出来';
    document.querySelector('.zongpi-card .anno-save')?.click();
    await sleep(500);
  }
  const zpAfter = [...document.querySelectorAll('.zongpi-shown-item')];
  chk('zongpi-auto-opens-after-send', zpBefore === 0 && zpAfter.length === ZONGPIS.length,
    `before=${zpBefore} after=${zpAfter.length} total=${ZONGPIS.length}`);
  chk('zongpi-just-sent-on-top', (zpAfter[0]?.textContent || '').includes('刚呈的这条总批'),
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

  // 归档视图：已钦此的折子有地方看，且点进去是只读
  const doneTab = [...document.querySelectorAll('.list-tab')].find((b) => b.textContent.includes('已钦此'));
  chk('archive-tab-exists', Boolean(doneTab), doneTab?.textContent?.trim());
  if (doneTab) {
    doneTab.click(); await sleep(200);
    chk('archive-has-items', document.querySelectorAll('#pr-list .pr-item').length >= 1);
    document.querySelector('#pr-list .pr-item')?.click();
    await sleep(800);
    chk('archive-readonly-no-qinci', !document.querySelector('.btn-qinci'));
    chk('archive-readonly-notice', (document.querySelector('.rev-notice')?.textContent || '').includes('归档'));
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
    // 切回待批继续后面的断言
    [...document.querySelectorAll('.list-tab')].find((b) => b.textContent.includes('待批'))?.click();
    await sleep(200);
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

  // 切回 head 后真点一次「提交朱批」——覆盖提交管线最后一公里：
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

  console.log(`[smoke] RESULT pass=${pass} fail=${fail}`);
}
