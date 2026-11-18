import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import app from '../dist/server/index.js';

const output = 'dist/public';
await mkdir(output + '/panduan', { recursive: true });
const publisher = process.env.ADSENSE_CLIENT?.trim() || '';
const slot = process.env.ADSENSE_SLOT?.trim() || '';
if (publisher && !/^ca-pub-\d{16}$/.test(publisher)) throw new Error('ADSENSE_CLIENT harus berupa ca-pub- diikuti 16 digit.');
if (slot && (!publisher || !/^\d{10}$/.test(slot))) throw new Error('ADSENSE_SLOT memerlukan ID penerbit dan 10 digit nomor unit iklan.');
const verify = publisher ? '<meta name="google-adsense-account" content="' + publisher + '">' : '';
const response = await app.fetch(new Request('https://build.invalid/'), {});
const homepage = (await response.text())
  .replace('</head>', verify + '</head>')
  .replace('<footer>', '<footer><a href="/panduan/">Panduan dan privasi</a>');
await writeFile(output + '/index.html', homepage);
await copyFile('theme.css', output + '/theme.css');
let guide = await readFile('netlify/panduan.html', 'utf8');
guide = guide.replace('</head>', verify + '</head>');
const unit = slot ? `<aside aria-label="Iklan"><small>Iklan</small>
<ins class="adsbygoogle" style="display:block" data-ad-client="${publisher}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>
<script async crossorigin="anonymous" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}"></script>
<script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script>` : '';
await writeFile(output + '/panduan/index.html', guide.replace('<!-- manual ad unit -->', unit));
if (publisher) await writeFile(output + '/ads.txt', 'google.com, ' + publisher.slice(3) + ', DIRECT, f08c47fec0942fa0\n');
else await rm(output + '/ads.txt', { force: true });
