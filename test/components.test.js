// 组件级测试 —— 拆出子组件后才可能做的一层。
// 由来：第七轮评审在 sidebar 的 Escape 分支抓到一个「字符串替换漏网」的 ReferenceError，
// 三层测试全绿照样放行（test/ 里 Escape 零命中）。拆分让「直接 import 组件、取出
// 事件处理器喂事件」变得可行，这就是那一刀换来的能力。
import { test } from 'node:test';
import assert from 'node:assert/strict';

// 组件模块会 import vendored preact；node 里没有 DOM，但 preact 本身 import 期不碰 document。
const { Sidebar } = await import('../src/components/sidebar.js');
const { Topbar } = await import('../src/components/topbar.js');
// zongpi-shown 走 render.js，那个模块 import 期就要 window.markdownit——node 里补个桩即可，
// 本组件测试只关心「折不折 / 排序 / 摘要」，不验 markdown 引擎本身（那由冒烟层的真浏览器覆盖）。
globalThis.window = { markdownit: () => ({ renderer: { rules: {} }, render: (t) => `<p>${t}</p>` }) };
const { ZongpiShown, summarize } = await import('../src/components/zongpi-shown.js');

// 在 vnode 树里按谓词找第一个节点
function find(vnode, pred) {
  if (!vnode || typeof vnode !== 'object') return null;
  if (Array.isArray(vnode)) {
    for (const v of vnode) { const hit = find(v, pred); if (hit) return hit; }
    return null;
  }
  if (pred(vnode)) return vnode;
  return find(vnode.props?.children, pred);
}
const byClass = (cls) => (v) => typeof v.props?.class === 'string' && v.props.class.split(' ').includes(cls);

test('搜索框：Enter 触发搜索、Escape 清空——两个分支都不能悬空引用', () => {
  const calls = [];
  const tree = Sidebar({
    q: '朱批', hits: null, searching: '', prs: [], donePrs: [], tab: 'open', cur: null,
    demo: false, timeAgo: () => '刚刚',
    onQuery: () => calls.push('query'), onSearch: () => calls.push('search'),
    onClearSearch: () => calls.push('clear'), onJumpToHit: () => {}, onTab: () => {},
    onOpenPR: () => {}, onSettings: () => {},
  });
  const input = find(tree, byClass('search-input'));
  assert.ok(input, '应渲染出搜索框');
  assert.doesNotThrow(() => input.props.onKeyDown({ key: 'Enter' }), 'Enter 分支不得抛错');
  assert.doesNotThrow(() => input.props.onKeyDown({ key: 'Escape' }), 'Escape 分支不得抛错（曾是 ReferenceError）');
  assert.deepEqual(calls, ['search', 'clear']);
});

test('侧栏：demo 模式隐藏「设置 · 钥匙」（否则会清掉真钥匙）', () => {
  const base = {
    q: '', hits: null, searching: '', prs: [], donePrs: [], tab: 'open', cur: null,
    timeAgo: () => '', onQuery: () => {}, onSearch: () => {}, onClearSearch: () => {},
    onJumpToHit: () => {}, onTab: () => {}, onOpenPR: () => {}, onSettings: () => {},
  };
  assert.equal(find(Sidebar({ ...base, demo: true }), byClass('settings')), null);
  assert.ok(find(Sidebar({ ...base, demo: false }), byClass('settings')));
});

test('顶栏：旧版下提交按钮禁用；归档折不出钦此但保留总批', () => {
  const base = {
    cur: { pr: { number: 1, title: 'x' } }, busy: false, draftCount: 2,
    happyUrl: null, stale: false, notice: '',
    onRefresh: () => {}, onCopyRef: () => {}, onZongpi: () => {}, onSubmit: () => {}, onQinci: () => {},
  };
  const onOld = Topbar({ ...base, archived: false, onHead: false });
  assert.equal(find(onOld, byClass('btn-submit')).props.disabled, true, '旧版必须禁提交');

  const archived = Topbar({ ...base, archived: true, onHead: true });
  assert.equal(find(archived, byClass('btn-qinci')), null, '归档折不该出钦此');
  const zongpi = find(archived, (v) => v.props?.children === '总批');
  assert.ok(zongpi, '归档折仍要能留总批（GitHub 允许在 merged PR 上评论）');
});

// issue #1：已呈总批全展开挡在正文前（PR #30 实测 9 条 / 8,132 字 ≈ 2–3 屏）
const ZS = [
  { id: 1, created_at: '2026-07-20T00:00:00Z', user: { login: 'a' }, body: '最旧的一条' },
  { id: 2, created_at: '2026-07-28T00:00:00Z', user: { login: 'b' }, body: '## v8 定稿 —— 锁定租客版\n\n正文。' },
  { id: 3, created_at: '2026-07-24T00:00:00Z', user: { login: 'c' }, body: '中间那条' },
];

test('已呈总批：默认折叠，头上带条数 + 最新一条摘要', () => {
  const collapsed = ZongpiShown({ zongpis: ZS, open: false, onToggle: () => {} });
  assert.equal(find(collapsed, byClass('zongpi-shown-item')), null, '收起态不得渲染任何条目');
  const label = find(collapsed, byClass('zongpi-shown-toggle')).props.children.flat(9).join('');
  assert.match(label, /▸/);
  assert.match(label, /已呈总批 · 3/);
  assert.match(label, /最新：v8 定稿 —— 锁定租客版/, '摘要取最新一条并剥掉 markdown 装饰');
});

test('已呈总批：展开后按时间倒序，最新的在最上面（GitHub 返的是正序）', () => {
  const open = ZongpiShown({ zongpis: ZS, open: true, onToggle: () => {} });
  const list = find(open, byClass('zongpi-shown-list'));
  assert.deepEqual(list.props.children.map((v) => v.key), ['z2', 'z3', 'z1']);
});

test('已呈总批：零条不占位；点击头走 onToggle', () => {
  assert.equal(ZongpiShown({ zongpis: [], open: false, onToggle: () => {} }), null);
  let toggled = 0;
  const tree = ZongpiShown({ zongpis: ZS, open: false, onToggle: () => { toggled++; } });
  find(tree, byClass('zongpi-shown-toggle')).props.onClick();
  assert.equal(toggled, 1);
});

test('摘要：跳过 fence / 分隔线 / 表格行，超长截断', () => {
  assert.equal(summarize('```js\nconst a = 1;\n```\n\n真正的首句'), '真正的首句');
  assert.equal(summarize('---\n\n> 引用起头的一句'), '引用起头的一句');
  assert.equal(summarize('1. 列表起头'), '列表起头');
  assert.equal(summarize('**加粗** 的开头'), '加粗 的开头');
  assert.equal(summarize('啊'.repeat(40)), '啊'.repeat(30) + '…');
  assert.equal(summarize(''), '');
});
