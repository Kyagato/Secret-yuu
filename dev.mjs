import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import worker from './dist/server/index.js';
const sqlite=new DatabaseSync('local.sqlite');
if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE name='rooms'").get())sqlite.exec(readFileSync('drizzle/0000_rooms.sql','utf8'));
const DB={prepare(sql){const s=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this},async all(){return {results:s.all(...values)}},async first(){return s.get(...values)},async run(){return s.run(...values)}}}};
createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const url='http://localhost:3000'+req.url;const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Server error')}}).listen(3000,()=>console.log('R4hasiakuu: http://localhost:3000'));
