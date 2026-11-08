const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {createChainAdapter}=require('./squeek-chain.cjs');
const {createBakeryService}=require('./bakery-service.cjs');
const {createWalletAuth}=require('./wallet-auth.cjs');
const {createLiveMarketWorker}=require('./live-market-worker.cjs');
const siteConfig=require('./site-config.json');
const chain=createChainAdapter();
const production=process.env.NODE_ENV==='production';
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||(production?'0.0.0.0':'127.0.0.1');
const dataDir=path.resolve(process.env.DATA_DIR||path.join(__dirname,'.local'));
fs.mkdirSync(dataDir,{recursive:true});
const service=createBakeryService({filename:path.join(dataDir,'bakery.sqlite'),chain});
const walletAuth=createWalletAuth({service});
const liveMarketWorker=createLiveMarketWorker(service);
const publicOrigin=process.env.PUBLIC_ORIGIN||(production?siteConfig.origin:null);
const configuredOrigin=publicOrigin?new URL(publicOrigin):null;
const walletConnectProjectId=process.env.WALLETCONNECT_PROJECT_ID||siteConfig.walletConnectProjectId||'';
if(configuredOrigin&&(!['https:','http:'].includes(configuredOrigin.protocol)||configuredOrigin.pathname!=='/'||configuredOrigin.search||configuredOrigin.hash||configuredOrigin.username||configuredOrigin.password||(production&&configuredOrigin.protocol!=='https:')))throw new Error('PUBLIC_ORIGIN must be the site HTTPS origin without a path.');
function walletOrigin(req){
  if(configuredOrigin)return configuredOrigin.origin;
  if(production){const error=new Error('Wallet sign-in needs PUBLIC_ORIGIN configured.');error.status=503;throw error;}
  return `${req.socket.encrypted?'https':'http'}://${req.headers.host}`;
}
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const files = new Set(['/index.html','/style.css','/arena.css','/bakery.css','/recipe-box.css','/recipe-core.js','/recipe-ui.js','/game.js','/levels.js','/engine.js','/bakery-art.js','/bakery-render.js','/bakery-audio.js','/radio.js','/assets/bakery-background.png','/assets/bakery-sprites.png','/assets/burrow-radio.png']);
for(const size of [32,180,256])files.add(`/assets/hamster-${size}.png`);
const server=http.createServer(async(req,res) => {
  const requestUrl=new URL(req.url,'http://localhost');
  const pathname=requestUrl.pathname;
  if(pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('ok');return;}
  if(pathname.startsWith('/api/')){
    const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.method==='POST'&&(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`))){json(403,{error:'Use the bakery on this site.'});return;}
    const cookie=String(req.headers.cookie||'').match(/(?:^|;\s*)hamster_bakery=([a-f0-9]{64})(?:;|$)/)?.[1];
    const token=service.session(cookie),id=service.resolveSession(token);
    const setCookie=value=>res.setHeader('Set-Cookie',`hamster_bakery=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${production||req.socket.encrypted?'; Secure':''}`);
    if(token!==cookie)setCookie(token);
    try{
      if(req.method==='GET'&&pathname==='/api/auth'){json(200,{...walletAuth.state(token),enabled:!production||!!configuredOrigin,walletConnectProjectId});return;}
      if(req.method==='GET'&&pathname==='/api/client-config'){json(200,{walletConnectProjectId});return;}
      if(req.method==='GET'&&pathname==='/api/profile'){json(200,service.profile(id));return;}
      if(req.method==='GET'&&pathname==='/api/live-orders'){json(200,service.liveOrders(id));return;}
      if(req.method==='GET'&&pathname==='/api/bakery'){json(200,await chain.snapshot());return;}
      if(req.method==='GET'&&pathname==='/api/leaderboards'){json(200,await service.leaderboard(requestUrl.searchParams.get('board')||'genesis',id));return;}
      const authRoutes=['/api/auth/nonce','/api/auth/verify','/api/auth/restore','/api/auth/logout'];
      if(req.method!=='POST'||!['/api/profile','/api/sell',...authRoutes].includes(pathname)){json(404,{error:'Unknown bakery endpoint.'});return;}
      if(!String(req.headers['content-type']||'').startsWith('application/json')){json(415,{error:'Send JSON bakery commands.'});return;}
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536){json(413,{error:'Bakery command is too large.'});return;}}
      const input=JSON.parse(body);
      if(authRoutes.includes(pathname)){
        const origin=walletOrigin(req);
        if(req.headers.origin&&req.headers.origin!==origin){json(403,{error:'Use your bakery’s primary domain to sign in.'});return;}
        const output=pathname==='/api/auth/nonce'?walletAuth.issue(token,input,origin):pathname==='/api/auth/verify'?await walletAuth.verify(token,input,origin):pathname==='/api/auth/restore'?walletAuth.restore(token,input):walletAuth.logout(token);
        if(output.sessionToken){setCookie(output.sessionToken);delete output.sessionToken;}
        json(200,output);return;
      }
      const output=pathname==='/api/sell'?await service.sell(id,input):await service.command(id,input.action,input.args);
      json(200,output);
    }catch(error){console.error('Bakery request failed:',error.message);json(error.status||400,{error:error.status?error.message:'The bakery could not complete that request. Please try again.'});}
    return;
  }
  const file = pathname === '/' ? '/index.html' : pathname;
  const musicFile=/^\/assets\/music\/[a-zA-Z0-9_-]+\.(mp3|wav|ogg|m4a)$/.test(file);
  const soundFile=/^\/assets\/sfx\/asmr-(cookie|cracker|chocolate)\.mp3$/.test(file);
  if (!files.has(file)&&!musicFile&&!soundFile&&!['/bakery-client.js','/bakery-online.js','/special-batch.js','/leaderboard.js','/leaderboard.css','/radio.css','/wallet-ui.js','/onboarding.js','/onboarding.css','/walletconnect-provider.js'].includes(file)) {res.writeHead(404);res.end('Not found');return;}
  if(musicFile||soundFile){
    const filename=path.join(__dirname,file);
    fs.stat(filename,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end('Track unavailable');return;}
      const headers={'Content-Type':types[path.extname(file)],'Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400'};
      let start=0,end=stat.size-1,status=200;
      if(req.headers.range){
        const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(range&&(range[1]||range[2])){
          start=range[1]?Number(range[1]):Math.max(0,stat.size-Number(range[2]));
          end=range[1]&&range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;
        }else start=stat.size;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);
      if(req.method==='HEAD'){res.end();return;}
      const stream=fs.createReadStream(filename,{start,end});stream.on('error',error=>{console.error('Audio stream failed:',error.message);res.destroy();});res.on('close',()=>stream.destroy());stream.pipe(res);
    });return;
  }
  fs.readFile(path.join(__dirname,file),(error,data) => {
    if(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('Could not read file');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(data);
  });
}).listen(port,host,() => console.log(`Hamster Crunch listening on ${host}:${server.address().port}`));
