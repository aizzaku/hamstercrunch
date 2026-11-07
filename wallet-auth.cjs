const {randomBytes,createHash}=require('node:crypto');
const {SiweMessage}=require('siwe');
const {getAddress}=require('ethers');
const LIFETIME=5*60*1000;
const statement='Save and recover your Hamster Crunch bakery. No transaction or payment.';
function authError(message,status=400){const error=new Error(message);error.status=status;return error;}
function createWalletAuth({service,now=Date.now}){
  const db=service.db;
  db.exec('CREATE TABLE IF NOT EXISTS wallet_accounts (address TEXT PRIMARY KEY, player_id TEXT NOT NULL UNIQUE)');
  db.exec('CREATE TABLE IF NOT EXISTS wallet_challenges (session_token TEXT PRIMARY KEY, message TEXT NOT NULL, address TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL, window_at INTEGER NOT NULL, requests INTEGER NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS wallet_restores (token_hash TEXT PRIMARY KEY, session_token TEXT NOT NULL, address TEXT NOT NULL, target_player TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0)');
  const hash=token=>createHash('sha256').update(token).digest('hex');
  const playerFor=token=>{const player=service.resolveSession(token);if(!player)throw authError('Session expired. Reload to try again.',401);return player;};
  const walletFor=player=>db.prepare('SELECT address FROM wallet_accounts WHERE player_id=?').get(player)?.address||null;
  function finishImport(player){
    const row=db.prepare('SELECT meta FROM players WHERE id=?').get(player);
    const meta=JSON.parse(row.meta);meta.initialized=true;
    db.prepare('UPDATE players SET meta=? WHERE id=?').run(JSON.stringify(meta),player);
  }
  function state(token){const address=walletFor(playerFor(token));return {connected:!!address,address};}
  function rotate(token,player){
    const fresh=randomBytes(32).toString('hex');
    db.prepare('UPDATE sessions SET revoked=1 WHERE token=?').run(token);
    db.prepare('INSERT INTO sessions (token,player_id,expires_at) VALUES (?,?,?)').run(fresh,player,now()+31536000000);
    return fresh;
  }
  function issue(token,{address,chainId},origin){
    const player=playerFor(token);
    let checksum;try{checksum=getAddress(address);}catch(error){throw authError('Choose a valid Ethereum wallet.');}
    const linked=walletFor(player);
    if(linked&&linked!==checksum.toLowerCase())throw authError('This bakery is already linked. Sign out before using another wallet.',409);
    if(!Number.isSafeInteger(chainId)||chainId<=0)throw authError('Choose a valid Ethereum network.');
    const url=new URL(origin),previous=db.prepare('SELECT * FROM wallet_challenges WHERE session_token=?').get(token);
    const sameWindow=previous&&now()-previous.window_at<60000;
    const requests=sameWindow?previous.requests+1:1;
    if(requests>6)throw authError('Too many sign-in attempts. Try again in a minute.',429);
    const issuedAt=new Date(now()).toISOString(),expiresAt=new Date(now()+LIFETIME).toISOString();
    const message=new SiweMessage({domain:url.host,address:checksum,statement,uri:url.origin,version:'1',chainId,nonce:randomBytes(16).toString('hex'),issuedAt,expirationTime:expiresAt}).prepareMessage();
    db.prepare('INSERT INTO wallet_challenges VALUES (?,?,?,?,0,?,?) ON CONFLICT(session_token) DO UPDATE SET message=excluded.message,address=excluded.address,expires_at=excluded.expires_at,consumed=0,window_at=excluded.window_at,requests=excluded.requests').run(token,message,checksum,now()+LIFETIME,sameWindow?previous.window_at:now(),requests);
    return {message,nonce:new SiweMessage(message).nonce,expiresAt};
  }
  async function verify(token,{message,signature},origin){
    const player=playerFor(token);
    if(typeof message!=='string'||message.length>4096||typeof signature!=='string'||signature.length>2048)throw authError('Invalid sign-in request.');
    const challenge=db.prepare('SELECT * FROM wallet_challenges WHERE session_token=?').get(token);
    if(!challenge||challenge.consumed||challenge.expires_at<=now())throw authError('Sign-in expired. Connect again.');
    // A failed attempt consumes the challenge too. Exact server-generated text
    // binds every SIWE field, including address, URI, network and expiry.
    db.prepare('UPDATE wallet_challenges SET consumed=1 WHERE session_token=?').run(token);
    if(message!==challenge.message)throw authError('Sign-in message changed. Connect again.');
    const parsed=new SiweMessage(message),url=new URL(origin);
    if(parsed.domain!==url.host||parsed.uri!==url.origin||parsed.address!==challenge.address||parsed.statement!==statement)throw authError('Sign-in belongs to another site.');
    try{
      const result=await parsed.verify({signature,domain:url.host,nonce:parsed.nonce,time:new Date(now()).toISOString()});
      if(!result.success)throw authError('Signature did not match this wallet.');
    }catch(error){throw authError('Signature did not match this wallet.');}
    // Signature verification is asynchronous; ensure logout/rotation could not
    // invalidate the initiating session while verification was in flight.
    if(service.resolveSession(token)!==player)throw authError('Session changed. Connect again.',401);
    const address=parsed.address.toLowerCase();
    const linked=walletFor(player);
    if(linked&&linked!==address)throw authError('This bakery is already linked. Sign out before using another wallet.',409);
    const account=db.prepare('SELECT player_id FROM wallet_accounts WHERE address=?').get(address);
    if(account&&account.player_id!==player){
      const restoreToken=randomBytes(32).toString('hex');
      db.prepare('INSERT INTO wallet_restores (token_hash,session_token,address,target_player,expires_at) VALUES (?,?,?,?,?)').run(hash(restoreToken),token,address,account.player_id,now()+LIFETIME);
      const saved=service.profile(account.player_id).profile;
      return {ok:true,restoreRequired:true,restoreToken,address,savedName:saved.name};
    }
    // No await inside this transaction: unique constraints protect one wallet
    // per bakery and one bakery per wallet without overwriting either save.
    db.exec('BEGIN IMMEDIATE');
    let next;
    try{
      if(!account)db.prepare('INSERT INTO wallet_accounts VALUES (?,?)').run(address,player);
      finishImport(player);
      next=rotate(token,player);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return {ok:true,connected:true,address,profile:service.profile(player).profile,sessionToken:next};
  }
  function restore(token,{token:restoreToken}){
    playerFor(token);
    if(typeof restoreToken!=='string'||!/^[a-f0-9]{64}$/.test(restoreToken))throw authError('Invalid bakery restore.');
    db.exec('BEGIN IMMEDIATE');
    let pending,next;
    try{
      pending=db.prepare('SELECT * FROM wallet_restores WHERE token_hash=? AND session_token=? AND consumed=0 AND expires_at>?').get(hash(restoreToken),token,now());
      if(!pending)throw authError('Bakery restore expired. Connect again.');
      if(walletFor(pending.target_player)!==pending.address)throw authError('Saved wallet changed. Connect again.');
      db.prepare('UPDATE wallet_restores SET consumed=1 WHERE token_hash=?').run(hash(restoreToken));
      next=rotate(token,pending.target_player);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return {ok:true,connected:true,address:pending.address,profile:service.profile(pending.target_player).profile,sessionToken:next};
  }
  function logout(token){
    playerFor(token);db.prepare('UPDATE sessions SET revoked=1 WHERE token=?').run(token);
    const next=service.session(null),player=service.resolveSession(next);
    finishImport(player);
    return {ok:true,connected:false,address:null,profile:service.profile(player).profile,sessionToken:next};
  }
  return {state,issue,verify,restore,logout};
}
module.exports={createWalletAuth};
