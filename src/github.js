// GitHub API 封装 —— 浏览器直连 api.github.com，token 只存 localStorage
const API = 'https://api.github.com';
const TOKEN_KEY = 'zhupi.token';

export const REPO = { owner: 'charliezong18', name: 'review' };
export const repoSlug = () => `${REPO.owner}/${REPO.name}`;

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t.trim());
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// 带 status 的错误：401 才是钥匙失效，403 可能只是限流（清 token 会误杀）
export class ApiError extends Error {
  constructor(res, detail) {
    super(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    this.status = res.status;
    this.rateLimited = res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0';
    this.tokenDead = res.status === 401;
  }
}

async function request(path, { accept = 'application/vnd.github+json', ...opts } = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message || '';
    } catch { /* 非 JSON 错误体忽略 */ }
    throw new ApiError(res, detail);
  }
  return res;
}

const json = (path, opts) => request(path, opts).then((r) => r.json());

// 验钥：既确认能读到仓库，也确认有写 PR 的权限（否则 M2 提交朱批时才炸）
export async function verifyToken() {
  const repo = await json(`/repos/${repoSlug()}`);
  return { repo, canWrite: Boolean(repo.permissions?.push) };
}

export const listOpenPRs = () =>
  json(`/repos/${repoSlug()}/pulls?state=open&per_page=50&sort=updated&direction=desc`);

// 分页取全，避免 >100 文件的 PR 漏掉正文
export async function listPRFiles(num) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await json(`/repos/${repoSlug()}/pulls/${num}/files?per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

export const getFileText = (path, ref) =>
  request(`/repos/${repoSlug()}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    { accept: 'application/vnd.github.raw' }).then((r) => r.text());

// 一次性提交整批朱批（原子：任一行号非法整批 422，调用方需先本地校验）
export const submitReview = (num, { body = '', comments = [] }) =>
  request(`/repos/${repoSlug()}/pulls/${num}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'COMMENT', body, comments }),
  }).then((r) => r.json());

// 总批 = 会话区 conversation comment
export const createIssueComment = (num, body) =>
  request(`/repos/${repoSlug()}/issues/${num}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  }).then((r) => r.json());

// 私有仓的 raw.githubusercontent 不带凭证取不到（实测 404），图片必须走 API 拿 blob
export const getFileBlobUrl = (path, ref) =>
  request(`/repos/${repoSlug()}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    { accept: 'application/vnd.github.raw' })
    .then((r) => r.blob())
    .then((b) => URL.createObjectURL(b));
