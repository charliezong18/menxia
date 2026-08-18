// 存储 driver 门面（SPEC §8.3 V3；review #129→#145 D3 拍定提前做，2026-08-18）。
//
// 消费方（ui.js / components）一律从这里拿数据面——「GitHub 是数据源」从各处
// 硬编码降级为**本门面的默认 driver**。将来 V4 加自有 infra，是往这里再插一个
// adapter，不是重写消费方。
//
// 边界（SPEC §8.3 附则 1，别越）：只抽象托管/身份/权限所在的传输边界；
// **接口词汇仍然是 PR / comment / merge**——第 2/3 层（git 存储、PR/comment 模型）
// 不抽象，为大概率不来的那天付抽象税不值。
//
// 错误契约：adapter 抛出的错误须带 { status, tokenDead, rateLimited, message }
// ——消费层是鸭子类型分流（ui.js:323），demo.js 的 ?fail= 也按这个形状伪造。
//
// 测试从 setAdapter() 整体喂假数据（比 fetch 打桩高一层，不用伪造 GitHub 报文）；
// 转发清单会不会随 github.js 增长而烂掉，由 test/store.test.js 的出口对账兜底
// ——清单式配置必须自己对账，这是 BUILD_FILES 用血换来的仓规。
import * as github from './github.js';

let adapter = github;
export const setAdapter = (a) => { adapter = a; };
export const getAdapter = () => adapter;

const fwd = (name) => (...args) => adapter[name](...args);

// ── 身份 / 配置（第 4 层）──
export const getRepoSlug = fwd('getRepoSlug');
export const setRepoSlug = fwd('setRepoSlug');
export const repoSlug = fwd('repoSlug');
export const parseRepoSlug = fwd('parseRepoSlug');
export const getToken = fwd('getToken');
export const setToken = fwd('setToken');
export const clearToken = fwd('clearToken');
export const verifyToken = fwd('verifyToken');

// ── 读面 ──
export const listOpenPRs = fwd('listOpenPRs');
export const listMergedPRs = fwd('listMergedPRs');
export const listPRFiles = fwd('listPRFiles');
export const listPRComments = fwd('listPRComments');
export const listPRCommits = fwd('listPRCommits');
export const listIssueComments = fwd('listIssueComments');
export const getFileText = fwd('getFileText');
export const getFileBlobUrl = fwd('getFileBlobUrl');
export const checkVerdict = fwd('checkVerdict');
export const getReadState = fwd('getReadState');

// ── 写面 ──
export const mergePR = fwd('mergePR');
export const markReady = fwd('markReady');
export const submitReview = fwd('submitReview');
export const createIssueComment = fwd('createIssueComment');
export const updateIssueComment = fwd('updateIssueComment');
export const putReadState = fwd('putReadState');

// 错误类型静态直通：消费层不做 instanceof，只认形状（见上错误契约）
export { ApiError } from './github.js';
