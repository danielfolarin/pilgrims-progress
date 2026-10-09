import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Besides the normal build, write dist/play.html: the whole game in one file
// (script and styles inlined, no modules), so it runs by double-clicking it —
// no server and no Node needed to play.
function singleFile(): Plugin {
  return {
    name: 'single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      let js = '', css = '';
      for (const f of Object.values(bundle)) {
        if (f.type === 'chunk') js += f.code;
        else if (f.fileName.endsWith('.css')) css += String(f.source);
      }
      const html = readFileSync('index.html', 'utf8')
        .replace('<script type="module" src="/src/main.ts"></script>', () => `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`)
        .replace('</head>', () => `<style>${css}</style>\n  </head>`);
      this.emitFile({ type: 'asset', fileName: 'play.html', source: html });
    },
  };
}

// Relative base so the built game can be served from any folder (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [singleFile()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
