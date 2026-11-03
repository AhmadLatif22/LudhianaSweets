import {response} from './_lib/server.js';
export default function handler(req,res) {
  if (req.method !== 'GET') return response(res,405,{error:'Method not allowed'});
  // PayFast onboarding and a fully verified server-side payment flow are prerequisites.
  // Do NOT enable these options simply by setting a public flag or merchant credentials.
  return response(res,200,{cod:true,card:false,jazzcash:false,easypaisa:false,reason:'Online payments will be available after secure PayFast integration is approved and tested.'});
}
