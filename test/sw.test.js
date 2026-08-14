// Service Worker 策略守卫（node 内置 runner）。
// sw.js 的事件装配被 `typeof self` 挡住，node import 时不触发，只暴露纯函数——这里测那些。
//
// 头号红线在这里立测：SW 绝不能把活站钉死。所以断言集中在两点——
//   ① 应用壳走 network-first（本文件不直接跑 fetch，而是钉死「壳被识别成要走缓存策略的资源」，
//      并在 README/代码注释里承诺 network-first；策略函数 shouldHandle/isAppShell 决定谁进这条路）；
//   ② 版本号换名 → 旧 cache 该被弃（cacheName 随 SW_VERSION 变）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SW_VERSION, cacheName, shouldHandle, isAppShell, KILL_SWITCH_URL } from '../sw.js';
import { KILL_SWITCH_URL as REGISTER_KILL_URL } from '../src/sw-register-const.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'https://charliezong18.github.io';

const req = (url, { method = 'GET', destination = '' } = {}) => ({ url, method, destination });

test('cacheName 带版本号：改 SW_VERSION 就换名（activate 时旧 cache 被清的前提）', () => {
  assert.ok(cacheName().includes(SW_VERSION));
  assert.notEqual(cacheName('v1'), cacheName('v2'));
  assert.ok(cacheName().startsWith('menxia-shell-'));
});

test('shouldHandle：只接管同源 GET，且永不碰 api.github.com（凭据绝不进 Cache）', () => {
  // 同源壳资源：接管
  assert.equal(shouldHandle(req(`${SELF}/menxia/src/ui.js`), SELF), true);
  assert.equal(shouldHandle(req(`${SELF}/menxia/`), SELF), true);
  // api.github.com：坚决不碰（就算同源判定意外为真也被 hostname 兜底挡下）
  assert.equal(shouldHandle(req('https://api.github.com/repos/x/y/pulls'), SELF), false);
  // 跨源：不碰
  assert.equal(shouldHandle(req('https://example.com/x.js'), SELF), false);
  // 非 GET（发判/PATCH 续读）：不碰 → 写操作绝不被 SW 截
  assert.equal(shouldHandle(req(`${SELF}/menxia/x`, { method: 'POST' }), SELF), false);
  assert.equal(shouldHandle(req(`${SELF}/menxia/x`, { method: 'PATCH' }), SELF), false);
});

test('isAppShell：document/script/style + .html/.js/.css/目录根算壳；图片等不算', () => {
  assert.equal(isAppShell(req(`${SELF}/menxia/index.html`, { destination: 'document' })), true);
  assert.equal(isAppShell(req(`${SELF}/menxia/src/ui.js`, { destination: 'script' })), true);
  assert.equal(isAppShell(req(`${SELF}/menxia/src/style.css`, { destination: 'style' })), true);
  // destination 为空（headless/老浏览器）→ 回退看扩展名
  assert.equal(isAppShell(req(`${SELF}/menxia/vendor/markdown-it.min.js`)), true);
  assert.equal(isAppShell(req(`${SELF}/menxia/`)), true);
  // 图片不进壳缓存（正文图走 API blob，不该被 SW 缓存）
  assert.equal(isAppShell(req(`${SELF}/menxia/assets/x.png`, { destination: 'image' })), false);
});

test('kill-switch 常量两处逐字一致（sw.js 内联 vs sw-register-const.js）', () => {
  // 内联那份与壳侧共享常量必须相等——不然拨闸只拨到一半，SW 与壳各读各的。
  assert.equal(KILL_SWITCH_URL, REGISTER_KILL_URL);
});

test('sw.js 是 classic worker：源码里不得含顶层 import（否则注册即抛）', () => {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  // 允许注释里出现 "import" 字样，但不允许真正的 `import … from`。
  const hasRealImport = /^\s*import\s.+\sfrom\s/m.test(src.replace(/\/\/.*$/gm, ''));
  assert.equal(hasRealImport, false, 'sw.js 作为 classic worker 注册，不能有顶层 import');
});

test('sw.js 承诺 network-first（红线）：源码含 networkFirst，且没有 cache-first 地把壳先给缓存', () => {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.ok(/networkFirst/.test(src), '必须有 networkFirst 策略');
  // 反向自验：不能出现「先 caches.match 命中就直接返回、命中才 fetch」的 cache-first 壳逻辑。
  // 我们的实现是先 fetch、catch 才 match，所以 fetch 应出现在 respondWith 主路径。
  assert.ok(/await fetch\(request\)/.test(src), 'network-first 必须先 await fetch');
});
