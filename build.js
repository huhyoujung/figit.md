const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function buildUI() {
  // Build ui.tsx
  const uiResult = await esbuild.build({
    entryPoints: ['src/ui.tsx'],
    bundle: true,
    write: false,
    minify: process.env.NODE_ENV === 'production',
  });

  let uiJs = uiResult.outputFiles[0].text;

  // Escape </script> tags inside the JS to prevent breaking HTML
  uiJs = uiJs.replace(/<\/script>/gi, '<\\/script>');

  // Read the HTML template
  const htmlTemplate = fs.readFileSync('src/ui.html', 'utf-8');

  // Inject the JS into HTML
  const finalHtml = htmlTemplate.replace(
    '<!-- SCRIPT_PLACEHOLDER -->',
    `<script>${uiJs}</script>`
  );

  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  // Write the final HTML
  fs.writeFileSync('dist/ui.html', finalHtml);
  console.log('[ui] Build complete');
}

async function build() {
  // Build code.ts
  if (isWatch) {
    const codeCtx = await esbuild.context({
      entryPoints: ['src/code.ts'],
      bundle: true,
      outfile: 'dist/code.js',
    });
    await codeCtx.watch();
    console.log('[code] Watching for changes...');

    // Initial UI build
    await buildUI();

    // Watch ui.tsx and ui.html for changes
    const chokidar = await import('chokidar').catch(() => null);
    if (chokidar) {
      chokidar.watch(['src/ui.tsx', 'src/ui.html']).on('change', async () => {
        try {
          await buildUI();
        } catch (err) {
          console.error('[ui] Build error:', err.message);
        }
      });
      console.log('[ui] Watching for changes...');
    } else {
      // Fallback: use fs.watch
      fs.watch('src', { recursive: true }, async (eventType, filename) => {
        if (filename && (filename.endsWith('.tsx') || filename.endsWith('.html'))) {
          try {
            await buildUI();
          } catch (err) {
            console.error('[ui] Build error:', err.message);
          }
        }
      });
      console.log('[ui] Watching for changes...');
    }
  } else {
    // One-time build
    await esbuild.build({
      entryPoints: ['src/code.ts'],
      bundle: true,
      outfile: 'dist/code.js',
    });
    console.log('[code] Build complete');

    await buildUI();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
