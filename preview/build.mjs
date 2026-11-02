// Gera a prévia do sistema que roda inteira no navegador (para publicar como página estática).
// Uso: node preview/build.mjs [pasta-de-saída] [--loja=vs-burger]
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fontHref, palette, themeColor, themeCss } from '../shared/theme.js';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] || '';
const loja = (opt('loja') || 'vs-burger').replace(/[^a-z0-9-]/g, '');
const lojaDir = join(root, 'lojas', loja);
const lojaCfg = JSON.parse(readFileSync(join(lojaDir, 'loja.json'), 'utf8'));
const out = resolve(args.find((a) => !a.startsWith('--')) || join(root, 'preview-dist'));
const tmp = join(out, '.build');
const shims = join(root, 'preview', 'shims');
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-asm.js';

rmSync(out, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// 1) servidor (rotas, regras e banco) empacotado para o navegador
await build({
  configFile: false,
  logLevel: 'warn',
  resolve: {
    alias: {
      'node:sqlite': join(shims, 'sqlite.js'),
      'node:fs': join(shims, 'node.js'),
      'node:path': join(shims, 'node.js'),
      'node:url': join(shims, 'node.js'),
      'node:os': join(shims, 'node.js'),
      'node:crypto': join(shims, 'node.js'),
      express: join(shims, 'express.js'),
      '@loja': lojaDir,
    },
  },
  define: {
    'process.env.LOJA': JSON.stringify(loja),
    'process.env.DB_PATH': JSON.stringify(':memory:'),
    'process.env.ADMIN_PASSWORD': JSON.stringify('demo1234'),
    'process.env.UPLOAD_DIR': JSON.stringify('/uploads'),
  },
  build: {
    outDir: join(tmp, 'backend'),
    emptyOutDir: true,
    minify: true,
    lib: { entry: join(root, 'preview', 'backend.js'), formats: ['iife'], name: 'LojaBackend', fileName: () => 'backend.js' },
    // só executa depois que o SQLite do navegador estiver pronto
    rollupOptions: { output: { banner: 'window.__startBackend = function () {', footer: '};' } },
  },
});

// 2) telas (cardápio, painel, entregador) com rotas em memória
await build({
  configFile: false,
  logLevel: 'warn',
  root: join(root, 'web'),
  plugins: [react(), tailwindcss()],
  define: { __PREVIEW__: 'true', __LOJA__: JSON.stringify(loja), 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: join(tmp, 'app'),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: join(root, 'web', 'src', 'preview', 'main.jsx'), formats: ['iife'], name: 'LojaApp', fileName: () => 'app.js', cssFileName: 'app' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const safe = (code, tag) => code.replaceAll(`</${tag}`, `<\\/${tag}`);
const backend = readFileSync(join(tmp, 'backend', 'backend.js'), 'utf8');
const app = readFileSync(join(tmp, 'app', 'app.js'), 'utf8');
const css = readFileSync(join(tmp, 'app', readdirSync(join(tmp, 'app')).find((f) => f.endsWith('.css'))), 'utf8');

const store = lojaCfg.store || {};
const theme = store.theme || {};
const corPadrao = theme.color === undefined || theme.color.toLowerCase() === '#973358';
const tone = corPadrao ? { 50: '#fdf2f5', 100: '#fbe4ea', 500: '#c24d6d', 700: '#7d2949' } : palette(theme.color);
const bg = theme.bg || (corPadrao ? '#fff9f6' : tone[50]);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const font = fontHref(theme);
const page = `<title>${esc(`Sistema ${store.name}`)}</title>
<meta name="description" content="${esc(`Prévia do sistema de gestão da ${[store.name, store.tagline].filter(Boolean).join(' – ')}`)}">
<meta name="theme-color" content="${themeColor(theme)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
${font ? `<link rel="stylesheet" href="${font}">` : ''}
<style>${safe(css, 'style')}
${themeCss(theme)}
body{font-family:var(--font-sans);font-size:16px;line-height:1.5;background:${bg}}
#boot{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:${bg};color:${tone[700]};font-family:Poppins,ui-sans-serif,system-ui,sans-serif}
#boot img{width:96px;height:96px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 4px ${tone[100]}}
#boot p{margin:0;font-size:15px}
#boot .mark{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;font-size:44px;background:linear-gradient(135deg,${tone[500]},${tone[700]});box-shadow:0 0 0 4px ${tone[100]}}
#boot .bar{width:160px;height:4px;border-radius:4px;background:${tone[100]};overflow:hidden}
#boot .bar i{display:block;width:40%;height:100%;background:${tone[500]};border-radius:4px;animation:boot 1.1s ease-in-out infinite}
@keyframes boot{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
@media (prefers-reduced-motion: reduce){#boot .bar i{animation:none;width:100%}}
</style>
<div id="root"><div id="boot">${!store.logo ? '<div class="mark">🍔</div>' : `<img src="${esc(store.logo.replace(/^\//, ''))}" alt="">`}<p>Preparando a demonstração…</p><div class="bar"><i></i></div></div></div>
<script src="${SQLJS}"></script>
<script>${safe(backend, 'script')}</script>
<script>${safe(app, 'script')}</script>
`;
writeFileSync(join(out, 'index.html'), page);

// fotos dos produtos, logo e ícones da loja
mkdirSync(join(out, 'img', 'produtos'), { recursive: true });
cpSync(join(lojaDir, 'public', 'img'), join(out, 'img'), { recursive: true });
rmSync(tmp, { recursive: true, force: true });

console.log(`Prévia (${store.name}) gerada em ${out} (${(page.length / 1024).toFixed(0)} KB + ${readdirSync(join(out, 'img', 'produtos')).length} fotos)`);
