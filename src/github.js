// GitHub API 封装 —— 浏览器直连 api.github.com，token 只存 localStorage
const API = 'https://api.github.com';
const TOKEN_KEY = 'zhupi.token';

export const REPO = { owner: 'charliezong18', name: 'review' };
export const repoSlug = () => `${REPO.owner}/${REPO.name}`;

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t.trim());
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function api(path, { raw = false, ...opts } = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
  }
  return raw ? res.text() : res.json();
}

// 校验钥匙能否读到这个仓库
export const verifyToken = () => api(`/repos/${repoSlug()}`);

export const listOpenPRs = () =>
  api(`/repos/${repoSlug()}/pulls?state=open&per_page=50&sort=updated&direction=desc`);

export const listPRFiles = (num) =>
  api(`/repos/${repoSlug()}/pulls/${num}/files?per_page=100`);

// 取某分支上的文件原文
export const getFileText = (path, ref) =>
  api(`/repos/${repoSlug()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`, { raw: true });
