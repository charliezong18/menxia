// F13 verify.js 纯函数单元测试：钉死「什么算一处、什么不算」。
// 只测计数逻辑（countVerifyMarkers）——DOM 渲染（decorateVerifyMarkers）由 demo 冒烟覆盖。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countVerifyMarkers, VERIFY_RE } from '../src/verify.js';

test('正文命中：方括号本体算一处', () => {
  assert.equal(countVerifyMarkers('这句数据来源存疑【需核实】。'), 1);
});

test('冒号变体：需核实：说明 / 需核实:说明 都算一处', () => {
  assert.equal(countVerifyMarkers('结论如下 需核实：这条要复核。'), 1);
  assert.equal(countVerifyMarkers('结论如下 需核实:半角冒号也认。'), 1);
});

test('无标记：返回 0', () => {
  assert.equal(countVerifyMarkers('一段完全没有标记的正文。'), 0);
  assert.equal(countVerifyMarkers(''), 0);
  assert.equal(countVerifyMarkers(null), 0);
  assert.equal(countVerifyMarkers(undefined), 0);
});

test('不做模糊匹配：光是「需核实」二字（无冒号、无方括号）不算', () => {
  assert.equal(countVerifyMarkers('这个数字需核实吗？我不确定。'), 0);
  assert.equal(countVerifyMarkers('需核实 后面隔了空格不是冒号'), 0);
});

test('多标记：混合两种形式，逐一计数', () => {
  const t = '第一处【需核实】，第二处也存疑 需核实：见下，第三处【需核实】。';
  assert.equal(countVerifyMarkers(t), 3);
});

test('同一行多处：都数', () => {
  assert.equal(countVerifyMarkers('【需核实】【需核实】【需核实】'), 3);
});

test('围栏代码块里的 token 不算（是示例不是声明）', () => {
  const t = [
    '正文里一处【需核实】。',
    '```',
    '示例：往正文写【需核实】就会被标记',
    '需核实：这行在代码块里，不该算',
    '```',
    '代码块外又一处 需核实：算。',
  ].join('\n');
  assert.equal(countVerifyMarkers(t), 2);
});

test('~~~ 围栏与缩进都认', () => {
  const t = [
    '  ~~~',
    '  【需核实】块内不算',
    '  ~~~',
    '块外【需核实】算。',
  ].join('\n');
  assert.equal(countVerifyMarkers(t), 1);
});

test('行内代码里的 token 不算', () => {
  assert.equal(countVerifyMarkers('用 `【需核实】` 这个写法标注；这句本身【需核实】。'), 1);
  assert.equal(countVerifyMarkers('写 `需核实：` 会触发标记，但这只是讲解。'), 0);
});

test('落单反引号不吃掉后面的 token', () => {
  // 单个 ` 不成对，不当行内代码起手；后面的标记照常算
  assert.equal(countVerifyMarkers('价格约 `5 元【需核实】'), 1);
});

test('VERIFY_RE 是全局正则，复用前 lastIndex 由调用方负责重置', () => {
  assert.ok(VERIFY_RE.global);
});
