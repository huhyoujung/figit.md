import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import { parseGitHubUrl, fetchFileContent, fetchDefaultBranch, isMarkdownFile } from './github';
import { Settings, RepoInfo } from './types';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

type View = 'main' | 'settings';

interface CurrentFile {
  repo: RepoInfo;
  path: string;
  name: string;
}

function App() {
  const [view, setView] = useState<View>('main');
  const [settings, setSettings] = useState<Settings>({ githubToken: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL input
  const [urlInput, setUrlInput] = useState('');

  // Current file being viewed
  const [currentFile, setCurrentFile] = useState<CurrentFile | null>(null);
  const [markdownContent, setMarkdownContent] = useState('');
  const [isInserted, setIsInserted] = useState(false);

  // For storing last successful URL
  const lastUrlRef = useRef<string>('');

  // Load settings on mount
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'load-settings' } }, '*');
  }, []);

  // Listen for messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'settings-loaded':
          if (msg.settings) {
            setSettings(msg.settings);
          }
          break;
        case 'init':
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const saveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    parent.postMessage({
      pluginMessage: { type: 'save-settings', settings: newSettings }
    }, '*');
  }, []);

  const notify = useCallback((message: string, isError = false) => {
    parent.postMessage({
      pluginMessage: { type: 'notify', message, error: isError }
    }, '*');
  }, []);

  const loadMarkdown = async (input: string, isRefresh = false) => {
    if (!input.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const parsed = parseGitHubUrl(input);
      if (!parsed) {
        throw new Error('Invalid GitHub URL or path format');
      }

      // Get default branch if not specified
      if (!input.includes('/blob/') && !input.includes('/tree/')) {
        parsed.branch = await fetchDefaultBranch(parsed.owner, parsed.repo, settings.githubToken);
      }

      // Extract file path and name
      const filePath = parsed.path;
      const fileName = filePath.split('/').pop() || 'README.md';

      if (!isMarkdownFile(fileName)) {
        throw new Error('Please enter a URL to a markdown file (.md)');
      }

      const content = await fetchFileContent(
        parsed.owner,
        parsed.repo,
        filePath,
        settings.githubToken,
        parsed.branch
      );

      setMarkdownContent(content);
      setCurrentFile({
        repo: parsed,
        path: filePath,
        name: fileName
      });
      lastUrlRef.current = input;

      if (isRefresh) {
        notify('Refreshed!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markdown');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMarkdown(urlInput.trim());
  };

  const handleRefresh = async () => {
    if (lastUrlRef.current) {
      await loadMarkdown(lastUrlRef.current, true);
      // If already inserted, update the canvas
      if (isInserted) {
        insertToCanvas();
      }
    }
  };

  const insertToCanvas = () => {
    if (!markdownContent || !currentFile) return;

    const htmlContent = marked(markdownContent) as string;

    // Send to Figma to create/update frame
    parent.postMessage({
      pluginMessage: {
        type: 'insert-markdown',
        html: htmlContent,
        fileName: currentFile.name,
        repoInfo: `${currentFile.repo.owner}/${currentFile.repo.repo}`
      }
    }, '*');

    setIsInserted(true);
    notify('Inserted to canvas!');
  };

  const renderSettings = () => (
    <div className="settings-view">
      <h2>Settings</h2>
      <div className="form-group">
        <label htmlFor="token">GitHub Personal Access Token</label>
        <input
          type="password"
          id="token"
          value={settings.githubToken}
          onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
          placeholder="ghp_xxxxxxxxxxxx"
        />
        <div className="hint">
          <p><strong>Required for private repositories.</strong></p>
          <p style={{ marginTop: '8px' }}>How to create a token:</p>
          <ol style={{ marginLeft: '16px', marginTop: '4px' }}>
            <li>Go to GitHub.com → Settings</li>
            <li>Developer settings → Personal access tokens → Tokens (classic)</li>
            <li>Generate new token (classic)</li>
            <li>Select scope: <code>repo</code> (for private repos)</li>
            <li>Copy and paste the token here</li>
          </ol>
        </div>
      </div>
      <div className="button-group">
        <button onClick={() => { saveSettings(settings); setView('main'); }} className="primary">
          Save Settings
        </button>
        <button onClick={() => setView('main')}>
          Back
        </button>
      </div>
    </div>
  );

  const renderMain = () => {
    const htmlContent = markdownContent ? marked(markdownContent) as string : '';

    return (
      <div className="main-view">
        <div className="header">
          <form onSubmit={handleSubmit} className="url-form">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="GitHub markdown file URL"
              className="url-input"
            />
            <button type="submit" disabled={loading} className="primary">
              {loading ? '...' : 'Load'}
            </button>
          </form>
          <div className="header-buttons">
            <button
              className="icon-button"
              onClick={handleRefresh}
              disabled={!currentFile || loading}
              title="Refresh"
            >
              🔄
            </button>
            <button
              className="icon-button"
              onClick={() => setView('settings')}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {currentFile && (
          <div className="file-info">
            <div className="file-details">
              <span className="file-name">📄 {currentFile.name}</span>
              <span className="file-repo">{currentFile.repo.owner}/{currentFile.repo.repo}</span>
            </div>
            <button
              className="insert-button"
              onClick={insertToCanvas}
              disabled={loading}
            >
              {isInserted ? '🔄 Update Canvas' : '📌 Insert to Canvas'}
            </button>
          </div>
        )}

        <div className="content-area">
          {markdownContent ? (
            <div
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div className="empty-state">
              <p>Enter a GitHub markdown file URL to view</p>
              <p className="example">Example: https://github.com/owner/repo/blob/main/README.md</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      {view === 'settings' ? renderSettings() : renderMain()}
      {loading && <div className="loading-overlay"><div className="spinner" /></div>}
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
