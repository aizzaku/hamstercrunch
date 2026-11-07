/* Wallet connection is optional. Only a verified message can restore a bakery. */
const WalletUI=(()=>{
  const dialog=document.querySelector('#wallet-panel'),status=document.querySelector('#wallet-status');
  const browserButton=document.querySelector('#wallet-browser'),qrButton=document.querySelector('#wallet-qr'),logoutButton=document.querySelector('#wallet-logout');
  const restore=document.querySelector('#wallet-restore'),headerButton=document.querySelector('#save-bakery');
  let auth=null,busy=false,resume=false,restoreToken=null,connector=null,flow=0;
  const short=address=>`${address.slice(0,6)}…${address.slice(-4)}`;
  async function request(url,body){const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'Sign-in unavailable. Try again.');return data;}
  function render(){
    headerButton.textContent=auth?.connected?'Saved ♡':'Save bakery';
    document.querySelector('#wallet-title').textContent=auth?.connected?'Bakery saved':'Save your bakery';
    document.querySelector('#wallet-copy').textContent=auth?.connected?`Linked to ${short(auth.address)}. Sign in on another device to return.`:'Keep your recipes, treats and records across devices.';
    browserButton.hidden=!!auth?.connected;browserButton.disabled=busy||!auth?.enabled;
    qrButton.hidden=!!auth?.connected||!auth?.walletConnectProjectId;qrButton.disabled=busy;
    logoutButton.hidden=!auth?.connected;logoutButton.disabled=busy;
    document.querySelector('#wallet-footnote').hidden=!!auth?.connected;
  }
  async function refresh(){auth=await request('/api/auth');render();if(!auth.enabled)status.textContent='Wallet sign-in is being set up. Guest play is ready.';}
  async function open(){resume=state==='playing';if(resume)pause();keys.clear();restore.hidden=true;restoreToken=null;status.textContent='';dialog.showModal();try{await RecipeProfile.settle();await refresh();}catch(error){status.textContent=error.message;}}
  async function loadConnector(){if(window.HamsterWalletConnect)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/walletconnect-provider.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('WalletConnect could not load. Try again.'));};document.head.append(script);});}
  function messageHex(message){return '0x'+[...new TextEncoder().encode(message)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
  async function connect(kind){
    if(busy)return;busy=true;const attempt=++flow;render();status.textContent='Choose your wallet…';restore.hidden=true;
    try{
      await RecipeProfile.settle();
      let provider;
      if(kind==='qr'){
        await loadConnector();
        connector=await window.HamsterWalletConnect.create({projectId:auth.walletConnectProjectId,onController:value=>{connector=value;if(attempt!==flow)value.cancel();},onUri:(image,uri)=>{if(attempt!==flow)return;document.querySelector('#wallet-qr-code').hidden=false;document.querySelector('#wallet-qr-image').src=image;document.querySelector('#wallet-qr-link').href=uri;status.textContent='Scan with your wallet.';}});
        provider=connector;
      }else{
        provider=window.ethereum?.providers?.find(item=>item.isMetaMask)||window.ethereum;
        if(!provider)throw new Error('Open in your wallet browser, or use WalletConnect.');
      }
      const accounts=await provider.request({method:'eth_requestAccounts'});
      const address=accounts[0],chainId=Number(await provider.request({method:'eth_chainId'}));
      if(attempt!==flow)return;
      if(!/^0x[a-fA-F0-9]{40}$/.test(address)||!Number.isSafeInteger(chainId)||chainId<=0)throw new Error('Choose a valid Ethereum wallet.');
      const challenge=await request('/api/auth/nonce',{address,chainId});
      if(attempt!==flow)return;status.textContent='Sign the login message. No gas.';document.querySelector('#wallet-qr-code').hidden=true;
      const signature=await provider.request({method:'personal_sign',params:[messageHex(challenge.message),address]});
      if(attempt!==flow)return;
      status.textContent='Saving…';const result=await request('/api/auth/verify',{message:challenge.message,signature});
      if(result.restoreRequired){
        restoreToken=result.restoreToken;document.querySelector('#wallet-restore-copy').textContent=`Open ${result.savedName}’s saved bakery? This guest bakery stays separate.`;restore.hidden=false;status.textContent='Saved bakery found.';
      }else if(result.connected){window.location.reload();}
      else throw new Error(result.message||'Sign-in could not finish.');
    }catch(error){if(attempt===flow)status.textContent=error.code===4001?'Sign-in canceled. Keep playing.':error.message;}
    finally{if(attempt===flow){busy=false;render();}}
  }
  browserButton.addEventListener('click',()=>connect('browser'));qrButton.addEventListener('click',()=>connect('qr'));
  headerButton.addEventListener('click',open);document.querySelector('#close-wallet').addEventListener('click',()=>dialog.close());
  document.querySelector('#wallet-open-saved').addEventListener('click',async()=>{if(busy||!restoreToken)return;busy=true;render();try{await RecipeProfile.settle();await request('/api/auth/restore',{token:restoreToken});window.location.reload();}catch(error){status.textContent=error.message;}finally{busy=false;render();}});
  document.querySelector('#wallet-keep-guest').addEventListener('click',()=>{restoreToken=null;restore.hidden=true;status.textContent='Guest bakery kept.';});
  logoutButton.addEventListener('click',async()=>{if(busy)return;busy=true;render();try{await RecipeProfile.settle();await request('/api/auth/logout',{});window.location.reload();}catch(error){status.textContent=error.message;}finally{busy=false;render();}});
  dialog.addEventListener('close',()=>{flow++;busy=false;restoreToken=null;connector?.cancel?.();connector=null;document.querySelector('#wallet-qr-code').hidden=true;keys.clear();if(resume&&state==='paused')action();resume=false;canvas.focus();});
  RecipeProfile.settle().then(refresh).catch(()=>{status.textContent='Sign-in unavailable. Guest play is ready.';});
  return {open,isOpen:()=>dialog.open};
})();
