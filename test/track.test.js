// F16 折务追踪读侧的纯逻辑：标签解析 / 关系分析 / 分组。
// 与写入侧 `menxia-mcp/test/track.test.ts` 对镜——两边判定必须说同一件事。
import test from 'node:test';
import assert from 'node:assert';
import {
  analyze, groupByProject, isZombie, kindOf, parseRel, projsOf,
  waitClass, waitOf, waitRank, waitTally,
} from '../src/track.js';

const pr = (number, labels = [], body = null, extra = {}) => ({
  number, title: `折 ${number}`, body, labels: labels.map((name) => ({ name })), ...extra,
});

test('标签解析：认前缀，多项目取全，没有就是 null', () => {
  const p = pr(1, ['proj:menxia', 'proj:zhongshumenxia', 'kind:设计', 'wait:你拍', '别的标签']);
  assert.deepEqual(projsOf(p), ['menxia', 'zhongshumenxia']);
  assert.equal(kindOf(p), '设计');
  assert.equal(waitOf(p), '你拍');
  assert.equal(waitOf(pr(2)), null);
  // GitHub 的 labels 偶尔被别的调用方摊成字符串数组，两种都得吃得下
  assert.deepEqual(projsOf({ number: 3, labels: ['proj:niw'] }), ['niw']);
});

test('词表外的取值照常显示、排最后——绝不因为认不出就把折丢了', () => {
  assert.equal(waitRank('你拍') < waitRank('闲'), true);
  assert.equal(waitRank('新造的状态'), waitRank('闲') + 1);
  assert.equal(waitClass('新造的状态'), 'wait-other');
  assert.equal(waitClass('你拍'), 'wait-you-decide');
  const tally = waitTally([pr(1, ['wait:闲']), pr(2, ['wait:新造的']), pr(3, ['wait:你拍'])]);
  assert.deepEqual(tally.map((t) => t.wait), ['你拍', '闲', '新造的']);
});

test('关系标记：解析宽容，与 happy-session 共存', () => {
  const body = '正文\n\n<!-- menxia-rel: needs=#49; supersedes=#48,#50; unblocks=T1.2 租机链 -->\n<!-- happy-session: cmsdemo0000demo0000demo -->';
  assert.deepEqual(parseRel(body), { needs: [49], supersedes: [48, 50], unblocks: 'T1.2 租机链' });
  assert.deepEqual(parseRel(null), { needs: [], supersedes: [], unblocks: null });
  assert.deepEqual(parseRel('<!-- menxia-rel: foo=bar; needs=#7 -->').needs, [7]);
});

test('analyze：他那两个问题的正面答案', () => {
  const open = [
    pr(58, ['proj:zhongshumenxia']),                                     // 被已画可的 #59 盖掉
    pr(10, [], '<!-- menxia-rel: needs=#5,#11 -->'),                     // #5 已画可 / #11 还开着
    pr(11, [], '<!-- menxia-rel: supersedes=#12; unblocks=开 M2 -->'),
    pr(12, []),
  ];
  const merged = [pr(59, [], '<!-- menxia-rel: supersedes=#58 -->'), pr(5, [])];
  const rel = analyze(open, merged);

  // 「有没有被后来的盖了」
  assert.deepEqual(rel.get(58).coveredBy, [59]);
  assert.equal(isZombie(rel.get(58)), true);
  assert.equal(isZombie(rel.get(10)), false);

  // 「这个 block 哪个」：还开着的依赖 = 等它先定；已画可的依赖 = 可动手
  assert.deepEqual(rel.get(10).blockedBy, [11]);
  assert.deepEqual(rel.get(10).unlocked, [5]);

  // 覆盖关系两头都要看得见：#11 盖 #12，#12 上要显示「将被 #11 盖掉」
  assert.deepEqual(rel.get(11).covers, [12]);
  assert.deepEqual(rel.get(12).willCover, [11]);
  assert.equal(rel.get(11).unblocks, '开 M2');
});

test('分组：组内按急迫度、组间按最急的那折；未标注恒在最后且不隐藏', () => {
  const prs = [
    pr(1, ['proj:menxia', 'wait:闲']),
    pr(2, ['proj:menxia', 'wait:你拍']),
    pr(3, ['proj:guanzhi', 'wait:你读']),
    pr(4, []),                                   // 未标注：必须还在，只是排最后
  ];
  const groups = groupByProject(prs, { unlabeled: '未标注' });
  assert.deepEqual(groups.map((g) => g.proj), ['menxia', 'guanzhi', '未标注']);
  assert.deepEqual(groups[0].list.map((p) => p.number), [2, 1]);
  assert.equal(groups.at(-1).list.length, 1);
});
