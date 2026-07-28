// 组件级测试 —— 拆出子组件后才可能做的一层。
// 由来：第七轮评审在 sidebar 的 Escape 分支抓到一个「字符串替换漏网」的 ReferenceError，
// 三层测试全绿照样放行（test/ 里 Escape 零命中）。拆分让「直接 import 组件、取出
// 事件处理器喂事件」变得可行，这就是那一刀换来的能力。
import { test } from 'node:test';
import assert from 'node:assert/strict';

// 组件模块会 import vendored preact；node 里没有 DOM，但 preact 本身 import 期不碰 document。
const { Sidebar } = await import('../src/components/sidebar.js');
const { Topbar } = await import('../src/components/topbar.js');

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
