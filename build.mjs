import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if ((url || key) && (!/^https:\/\/[a-zA-Z0-9.-]+\/?$/.test(url) || !/^sb_publishable_[\w-]+$/.test(key))) {
  throw new Error('Gunakan HTTPS project URL dan publishable key Supabase (sb_publishable_…).');
}
const accountBundle = await build({
  entryPoints: ['account.js'], bundle: true, platform: 'browser', format: 'iife',
  minify: true, write: false,
  define: {
    AUTH_URL: JSON.stringify(url), AUTH_PUBLIC_KEY: JSON.stringify(key),
    LOCAL_DEMO: JSON.stringify(!url && process.argv.includes('--local-demo'))
  }
});

// The worker serves a single page. Embed the local styles and effects for deployment.
const html = readFileSync('index.html', 'utf8')
  .replace('<script src="./account.js"></script>', () => '<script>' + accountBundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace(/<link rel="stylesheet" href="\.\/(theme|motion)\.css">/g,
    (_, name) => '<style>\n' + readFileSync(name + '.css', 'utf8') + '\n</style>')
  .replace(/<script src="\.\/(motion|button|input|toggle|toast)\.js"><\/script>/g,
    (_, name) => '<script>\n' + readFileSync(name + '.js', 'utf8') + '\n</script>');

const api = readFileSync('worker/api.js', 'utf8');
mkdirSync('dist/server', { recursive: true });
writeFileSync('dist/server/index.js', 'const HTML=' + JSON.stringify(html) + ';\n' + api);
