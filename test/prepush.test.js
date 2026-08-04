// pre-push 闸门的分类逻辑：这次 push 到底带了哪些文件，决定跑不跑那 90 秒的浏览器层。
//
// 为什么值得单独测：这个仓 push 即部署，hook 是唯一的闸门（CI 与部署并行，只算告警）。
// 2026-08-02 实伤——先推 fix/touch-annotate、再 `git push origin HEAD:main`，闸门拿当前
// 分支名去猜基准，比的是「我的分支 vs 一秒前刚推上去的同名副本」= 空 diff → 判成纯文档
// → 浏览器层整个跳过，一次改 src/ui.js 的提交直奔生产没过闸。
//
// 下面钉死两侧：该严的必须严（三条 fail-closed），该快的仍然快（纯文档不许被误伤成全跑）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const ZERO = '0'.repeat(40);
const sha = (rev) => execFileSync('git', ['rev-parse', rev], { cwd: ROOT, encoding: 'utf8' }).trim();
// 喂 git 真实的 pre-push stdin 格式：<本地ref> <本地sha> <远端ref> <远端sha>
const verdict = (stdin) => execFileSync('.githooks/pre-push', ['origin'], {
  cwd: ROOT, input: stdin, encoding: 'utf8',
  env: { ...process.env, PREPUSH_DRYRUN: '1' },
}).trim();

test('推 HEAD:main 时基准取远端 main —— 回归：曾比出空 diff 把 ui.js 放行上线', () => {
  // 复刻现场：人站在 feature 分支上，把同一个提交推去 main，而远端 main 还停在上一个提交
  const line = `refs/heads/fix/touch-annotate ${sha('HEAD')} refs/heads/main ${sha('HEAD~1')}\n`;
  assert.equal(verdict(line), 'DRYRUN code');
});

test('纯文档 push 仍走快速通道 —— 别把闸门修成永远全跑', () => {
  // ff5837c..952eedb 是历史上一对纯 .md 提交（两者都是 main 的祖先）
  // 注意：这两个是写死的 SHA，重写历史（filter-repo 之类）会让它们失效 —— 2026-08-04
  // 修作者邮箱时就断过一次，靠这条测试当场拦下。届时用 .git/filter-repo/commit-map 重映射。
  const line = `refs/heads/main ${sha('952eedb')} refs/heads/main ${sha('ff5837c')}\n`;
  assert.equal(verdict(line), 'DRYRUN docs-only');
});

test('stdin 空 → 当全改了（判不出改了什么就往严的倒）', () => {
  assert.equal(verdict(''), 'DRYRUN code');
});

test('新建远端分支（远端 sha 全零）→ 当全改了', () => {
  assert.equal(verdict(`refs/heads/new ${sha('HEAD')} refs/heads/new ${ZERO}\n`), 'DRYRUN code');
});

test('删远端分支（本地 sha 全零）→ 不崩，也不误判成纯文档', () => {
  assert.equal(verdict(`(delete) ${ZERO} refs/heads/gone ${sha('HEAD~1')}\n`), 'DRYRUN code');
});
