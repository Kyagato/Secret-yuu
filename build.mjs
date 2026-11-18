import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// The worker serves a single page. Embed the local styles and effects for deployment.
const html = readFileSync('index.html', 'utf8')
  .replace(/<link rel="stylesheet" href="\.\/(theme|motion)\.css">/g,
    (_, name) => '<style>\n' + readFileSync(name + '.css', 'utf8') + '\n</style>')
  .replace(/<script src="\.\/(motion|button)\.js"><\/script>/g,
    (_, name) => '<script>\n' + readFileSync(name + '.js', 'utf8') + '\n</script>');

const api = readFileSync('worker/api.js', 'utf8');
mkdirSync('dist/server', { recursive: true });
writeFileSync('dist/server/index.js', 'const HTML=' + JSON.stringify(html) + ';\n' + api);
