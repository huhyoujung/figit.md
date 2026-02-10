// Type definitions for Figit

export interface Settings {
  githubToken: string;
  defaultOwner?: string;
  defaultRepo?: string;
  pageWidth?: number; // Width of the page in pixels (default: 520)
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export interface PluginMessage {
  type: string;
  [key: string]: any;
}
