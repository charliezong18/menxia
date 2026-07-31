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
// 桩必须和生产一样严：markdown-it 对非字符串是直接抛（Input data should be a String），
// 桩要是更宽容（返回 '<p>null</p>'），就会系统性掩盖「传了 null 进去整个 app 白屏」那一类 bug。
globalThis.window = {
  markdownit: () => ({
    renderer: { rules: {} },
    render: (t) => {
      if (typeof t !== 'string') throw new TypeError('Input data should be a String');
      return `<p>${t}</p>`;
    },
  }),
};
const { ZongpiShown, summarize } = await import('../src/components/zongpi-shown.js');
const { OtherThreads } = await import('../src/components/other-threads.js');

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
    q: '涂归', hits: null, searching: '', prs: [], donePrs: [], tab: 'open', cur: null,
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

test('顶栏：旧版下提交按钮禁用；归档折不出画可但保留判', () => {
  const base = {
    cur: { pr: { number: 1, title: 'x' } }, busy: false, draftCount: 2,
    happyUrl: null, stale: false, notice: '',
    onRefresh: () => {}, onCopyRef: () => {}, onZongpi: () => {}, onSubmit: () => {}, onQinci: () => {},
  };
  const onOld = Topbar({ ...base, archived: false, onHead: false });
  assert.equal(find(onOld, byClass('btn-submit')).props.disabled, true, '旧版必须禁提交');

  const archived = Topbar({ ...base, archived: true, onHead: true });
  assert.equal(find(archived, byClass('btn-qinci')), null, '归档折不该出画可');
  const zongpi = find(archived, (v) => v.props?.children === '判');
  assert.ok(zongpi, '归档折仍要能留判（GitHub 允许在 merged PR 上评论）');
});

// issue #1：已呈判全展开挡在正文前（PR #30 实测 9 条 / 8,132 字 ≈ 2–3 屏）
const ZS = [
  { id: 1, created_at: '2026-07-20T00:00:00Z', user: { login: 'a' }, body: '最旧的一条' },
  { id: 2, created_at: '2026-07-28T00:00:00Z', user: { login: 'b' }, body: '## v8 定稿 —— 锁定租客版\n\n正文。' },
  { id: 3, created_at: '2026-07-24T00:00:00Z', user: { login: 'c' }, body: '中间那条' },
];

test('已呈判：默认折叠，头上带条数 + 最新一条摘要', () => {
  const collapsed = ZongpiShown({ zongpis: ZS, open: false, onToggle: () => {} });
  assert.equal(find(collapsed, byClass('zongpi-shown-item')), null, '收起态不得渲染任何条目');
  const label = find(collapsed, byClass('zongpi-shown-toggle')).props.children.flat(9).join('');
  assert.match(label, /▸/);
  assert.match(label, /已呈判 · 3/);
  assert.match(label, /最新：v8 定稿 —— 锁定租客版/, '摘要取最新一条并剥掉 markdown 装饰');
});

test('已呈判：展开后按时间倒序，最新的在最上面（GitHub 返的是正序）', () => {
  const open = ZongpiShown({ zongpis: ZS, open: true, onToggle: () => {} });
  const list = find(open, byClass('zongpi-shown-list'));
  assert.deepEqual(list.props.children.map((v) => v.key), ['z2', 'z3', 'z1']);
});

test('已呈判：零条不占位；点击头走 onToggle', () => {
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

// 以下四条全是评审用真实输入打出来的洞——良构输入的用例一条都盖不住
test('摘要：围栏没闭合也不能空手而归（空摘要 = 折叠头没信息量 = 回到 issue #1）', () => {
  assert.equal(summarize('```js\nconst a = 1;\nmore code'), 'const a = 1;', '未闭合围栏');
  assert.equal(summarize('````\ntext\n```\n````\n\n真首句'), 'text', '嵌套围栏配对错乱');
  assert.equal(summarize('```\nx\n```'), 'x', '通篇只有代码');
});

test('摘要：按 code point 截断，不把 emoji 劈成半个', () => {
  // 关键是垫奇数个 BMP 字符——纯 emoji 每个占 2 code unit，30 是偶数正好切齐，自测不出问题
  const out = summarize('a' + '😀'.repeat(40));
  assert.ok(out.isWellFormed(), `切出了孤立代理对：${JSON.stringify(out)}`);
  assert.equal([...out].length, 31, '30 个 code point + 省略号');
});

test('摘要：剥掉控制符 / bidi 覆写（U+202E 能把整行显示方向翻过来）', () => {
  assert.equal(summarize('正常‮被翻转'), '正常被翻转');
  assert.equal(summarize('\x00\x07'), '');
});

test('已呈判：body 为 null 不能把整个 app 渲染炸掉', () => {
  // 改动前这里是 Preact 文本节点（null 渲染成空，无害）；改成 dangerouslySetInnerHTML 之后，
  // markdown-it 对非字符串直接抛，抛在组件里没有 error boundary 就是整个 #root 卸空。
  const bad = [{ id: 1, created_at: '2026-07-20T00:00:00Z', user: { login: 'a' }, body: null }];
  assert.doesNotThrow(() => ZongpiShown({ zongpis: bad, open: true, onToggle: () => {} }));
});

// 两个折叠组是同一个交互模式的两份实现，最容易一个改了另一个忘（#1 就是这么弄出不一致的）。
// 这条把它们钉在一起测：只补一个、或将来又拆出第三个折叠组时，都要在这里现形。
test('折叠组：两个 toggle 都要有 aria-expanded，且随展开态变化（#5）', () => {
  const cases = [
    ['已呈判', (open) => ZongpiShown({ zongpis: ZS, open, onToggle: () => {} }), 'zongpi-shown-toggle'],
    ['其他 N 串', (open) => OtherThreads({
      threads: [{ root: { id: 9, body: '正文', user: { login: 'a' }, path: 'docs/x.md' }, replies: [] }],
      open,
      onToggle: () => {},
    }), 'other-threads-toggle'],
  ];
  for (const [label, build, cls] of cases) {
    for (const open of [true, false]) {
      const btn = find(build(open), byClass(cls));
      assert.ok(btn, `${label}：应渲染出折叠钮`);
      assert.equal(btn.props['aria-expanded'], open, `${label}（open=${open}）的 aria-expanded 要跟着变`);
    }
  }
});

test('已呈判：带时区偏移 / 毫秒的时间戳也要排对（字符串序会静默排反）', () => {
  const mixed = [
    { id: 1, created_at: '2026-07-28T23:00:00Z', user: {}, body: '早' },
    { id: 2, created_at: '2026-07-29T07:30:00+09:00', user: {}, body: '更早' }, // = 22:30Z
  ];
  const list = find(ZongpiShown({ zongpis: mixed, open: true, onToggle: () => {} }), byClass('zongpi-shown-list'));
  assert.deepEqual(list.props.children.map((v) => v.key), ['z1', 'z2'], '23:00Z 晚于 22:30Z');
});

// ── 体例检查角标（2026-07-31 加）──
//
// 角标要**只在有话说的时候出现**。老折（CI 装上之前的）没有检查，
// 一排灰点是噪音；`unreadable` 更不能逐折画 —— 那是钥匙配置问题，
// 出一条通知就够了，19 张卡同时打问号会把真信号淹掉。
test('折卡角标：只有 fail / running / pass 画，none 与 unreadable 不画', () => {
  const base = {
    q: '', hits: null, searching: '', tab: 'open', cur: null, demo: false,
    donePrs: [], timeAgo: () => '刚刚',
    onQuery: () => {}, onSearch: () => {}, onClearSearch: () => {}, onJumpToHit: () => {},
    onTab: () => {}, onOpenPR: () => {}, onSettings: () => {},
  };
  const pr = (n) => ({ number: n, title: 't' + n, updated_at: '2026-07-31T00:00:00Z' });
  const tree = Sidebar({
    ...base,
    prs: [pr(1), pr(2), pr(3), pr(4), pr(5)],
    checks: {
      1: { state: 'fail', name: '九条规则' },
      2: { state: 'running' },
      3: { state: 'pass' },
      4: { state: 'none' },
      5: { state: 'unreadable' },
    },
  });
  const all = [];
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v.props?.class === 'string' && v.props.class.startsWith('chk')) all.push(v.props.class);
    walk(v.props?.children);
  })(tree);
  assert.deepEqual(all.sort(), ['chk chk-bad', 'chk chk-ok', 'chk chk-run'],
    'none 与 unreadable 不该画出角标');
});

test('折卡角标：已画可的折不画（CI 只在 open 折上跑）', () => {
  const tree = Sidebar({
    q: '', hits: null, searching: '', tab: 'done', cur: null, demo: false, prs: [],
    donePrs: [{ number: 9, title: 'merged', merged_at: '2026-07-30T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' }],
    timeAgo: () => '昨天', checks: { 9: { state: 'fail' } },
    onQuery: () => {}, onSearch: () => {}, onClearSearch: () => {}, onJumpToHit: () => {},
    onTab: () => {}, onOpenPR: () => {}, onSettings: () => {},
  });
  let found = false;
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v.props?.class === 'string' && v.props.class.startsWith('chk')) found = true;
    walk(v.props?.children);
  })(tree);
  assert.equal(found, false, '已画可的折不该有体例角标');
});

test('折卡角标：没传 checks 也不炸（老调用点 / demo 模式）', () => {
  assert.doesNotThrow(() => Sidebar({
    q: '', hits: null, searching: '', tab: 'open', cur: null, demo: true,
    prs: [{ number: 1, title: 't', updated_at: '2026-07-31T00:00:00Z' }], donePrs: [],
    timeAgo: () => '', onQuery: () => {}, onSearch: () => {}, onClearSearch: () => {},
    onJumpToHit: () => {}, onTab: () => {}, onOpenPR: () => {}, onSettings: () => {},
  }));
});
