import UniversalProvider from '@walletconnect/universal-provider';
import QRCode from 'qrcode';

// Only the QR connector is bundled. No payments, swaps or account abstraction.
window.HamsterWalletConnect={async create({projectId,onUri,onController}){
  const provider=await UniversalProvider.init({projectId,metadata:{name:'Hamster Crunch',description:'Save your bakery',url:window.location.origin,icons:[window.location.origin+'/assets/hamster-256.png']}});
  onController({cancel:()=>provider.abortPairingAttempt()});
  provider.on('display_uri',async uri=>onUri(await QRCode.toDataURL(uri,{width:256,margin:2,color:{dark:'#654530',light:'#fff8eb'}}),uri));
  const session=provider.session||await provider.connect({namespaces:{eip155:{chains:['eip155:1'],methods:['personal_sign'],events:['accountsChanged','chainChanged']}}});
  const account=session?.namespaces?.eip155?.accounts?.[0];
  if(!account)throw new Error('No wallet selected.');
  const [,chain,address]=account.split(':');
  return {async request(args){if(args.method==='eth_requestAccounts')return [address];if(args.method==='eth_chainId')return '0x'+Number(chain).toString(16);return provider.request(args,`eip155:${chain}`);},cancel(){provider.abortPairingAttempt();}};
}};
