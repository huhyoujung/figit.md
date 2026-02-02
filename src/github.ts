// GitHub API utilities

import { GitHubFile, RepoInfo } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

export function parseGitHubUrl(url: string): RepoInfo | null {
  // Patterns to match:
  // https://github.com/owner/repo/blob/branch/path/to/file.md
  // https://github.com/owner/repo/tree/branch/path
  // https://github.com/owner/repo
  // owner/repo/path/to/file.md

  try {
    let cleanUrl = url.trim();

    // Handle full GitHub URLs
    if (cleanUrl.includes('github.com')) {
      const urlObj = new URL(cleanUrl);
      const parts = urlObj.pathname.split('/').filter(Boolean);

      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1];
      let branch = 'main';
      let path = '';

      if (parts.length > 3 && (parts[2] === 'blob' || parts[2] === 'tree')) {
        branch = parts[3];
        path = parts.slice(4).join('/');
      }

      return { owner, repo, branch, path };
    }

    // Handle short format: owner/repo/path
    const parts = cleanUrl.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1],
        branch: 'main',
        path: parts.slice(2).join('/')
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchRepoContents(
  owner: string,
  repo: string,
  path: string = '',
  token?: string,
  branch: string = 'main'
): Promise<GitHubFile[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Repository or path not found');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication required or rate limit exceeded');
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  // If single file, wrap in array
  if (!Array.isArray(data)) {
    return [data];
  }

  return data;
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string,
  branch: string = 'main'
): Promise<string> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('File not found');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication required or rate limit exceeded');
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  // Decode base64 content
  if (data.content && data.encoding === 'base64') {
    // Remove newlines from base64 string and decode
    const base64Content = data.content.replace(/\n/g, '');
    return decodeURIComponent(escape(atob(base64Content)));
  }

  throw new Error('Unable to decode file content');
}

export async function fetchDefaultBranch(
  owner: string,
  repo: string,
  token?: string
): Promise<string> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return 'main'; // Default fallback
  }

  const data = await response.json();
  return data.default_branch || 'main';
}

export function isMarkdownFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'md' || ext === 'markdown' || ext === 'mdx';
}
