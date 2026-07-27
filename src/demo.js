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
`;

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

export const demoApi = {
  verifyToken: async () => ({ repo: {}, canWrite: true, prAccess: true }),
  listOpenPRs: async () => [PR],
  listPRFiles: async () => [{ filename: 'docs/demo.md', status: 'added', patch: PATCH }],
  getFileText: async () => DOC,
  getFileBlobUrl: async () => { throw new Error('demo 无图'); },
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
  await sleep(300);
  await pick('镜片随时可以摘掉', '这句放结尾太谦虚了，提到开头', true);
  await pick('const DEBOUNCE_MS = 300;', '300ms 的依据补个注释', false);
}
