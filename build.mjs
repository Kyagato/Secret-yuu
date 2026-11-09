import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});
const html=readFileSync('index.html','utf8');
const api=readFileSync('worker/api.js','utf8');
writeFileSync('dist/server/index.js','const HTML='+JSON.stringify(html)+';\n'+api);
