const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {createChainAdapter}=require('./squeek-chain.cjs');
const {createBakeryService}=require('./bakery-service.cjs');
const chain=createChainAdapter();
const production=process.env.NODE_ENV==='production';
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||(production?'0.0.0.0':'127.0.0.1');
const dataDir=path.resolve(process.env.DATA_DIR||path.join(__dirname,'.local'));
fs.mkdirSync(dataDir,{recursive:true});
const service=createBakeryService({filename:path.join(dataDir,'bakery.sqlite'),chain});
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const files = new Set(['/index.html','/style.css','/arena.css','/bakery.css','/recipe-box.css','/recipe-core.js','/recipe-ui.js','/game.js','/levels.js','/engine.js','/bakery-art.js','/bakery-render.js','/bakery-audio.js','/radio.js','/assets/bakery-background.png','/assets/bakery-sprites.png','/assets/burrow-radio.png']);
const server=http.createServer(async(req,res) => {
  const requestUrl=new URL(req.url,'http://localhost');
  const pathname=requestUrl.pathname;
  if(pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('ok');return;}
  if(pathname.startsWith('/api/')){
    const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.method==='POST'&&(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`))){json(403,{error:'Use the bakery on this site.'});return;}
    const cookie=String(req.headers.cookie||'').match(/(?:^|;\s*)hamster_bakery=([a-f0-9]{64})(?:;|$)/)?.[1];
    const id=service.session(cookie);
    if(id!==cookie)res.setHeader('Set-Cookie',`hamster_bakery=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${production||req.socket.encrypted?'; Secure':''}`);
    try{
      if(req.method==='GET'&&pathname==='/api/profile'){json(200,service.profile(id));return;}
      if(req.method==='GET'&&pathname==='/api/bakery'){json(200,await chain.snapshot());return;}
      if(req.method==='GET'&&pathname==='/api/leaderboards'){json(200,await service.leaderboard(requestUrl.searchParams.get('board')||'genesis',id));return;}
      if(req.method!=='POST'||!['/api/profile','/api/sell'].includes(pathname)){json(404,{error:'Unknown bakery endpoint.'});return;}
      if(!String(req.headers['content-type']||'').startsWith('application/json')){json(415,{error:'Send JSON bakery commands.'});return;}
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536){json(413,{error:'Bakery command is too large.'});return;}}
      const input=JSON.parse(body);
      const output=pathname==='/api/sell'?await service.sell(id,input):await service.command(id,input.action,input.args);
      json(200,output);
    }catch(error){console.error('Bakery request failed:',error.message);json(400,{error:'The bakery could not complete that request. Please try again.'});}
    return;
  }
  const file = pathname === '/' ? '/index.html' : pathname;
  const musicFile=/^\/assets\/music\/[a-zA-Z0-9_-]+\.(mp3|wav|ogg|m4a)$/.test(file);
  const soundFile=/^\/assets\/sfx\/asmr-(cookie|cracker|chocolate)\.mp3$/.test(file);
  if (!files.has(file)&&!musicFile&&!soundFile&&!['/bakery-client.js','/bakery-online.js','/special-batch.js','/leaderboard.js','/leaderboard.css'].includes(file)) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,file),(error,data) => {
    if(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('Could not read file');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(data);
  });
}).listen(port,host,() => console.log(`Hamster Crunch listening on ${host}:${server.address().port}`));
