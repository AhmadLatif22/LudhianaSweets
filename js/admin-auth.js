/* Supabase login is not authorization. Only user IDs in store_admins may enter. */
const adminLoginPage = window.location.pathname.endsWith('/login.html');
async function isAuthorizedAdmin() {
  if (!isDatabaseConnected()) return false;
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session)return false;
  const {data,error}=await supabaseClient.rpc('is_store_admin');
  return !error&&data===true;
}
async function requireAdminAuth() {
  const allowed=await isAuthorizedAdmin();
  if(!allowed&&!adminLoginPage) window.location.replace('login.html');
  return allowed;
}
if(!adminLoginPage)requireAdminAuth();
document.addEventListener('DOMContentLoaded',()=>{
  const username=document.getElementById('username');
  if(username){username.type='email';const label=document.querySelector('label[for="username"]');if(label)label.textContent='Email';}
  const hint=document.getElementById('demoCredentialsHint');if(hint)hint.remove();
  const subtitle=document.getElementById('loginSubtitle');if(subtitle)subtitle.textContent='Sign in using your allowlisted Supabase administrator account.';
  document.getElementById('loginForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.target.querySelector('[type=submit]'),error=document.getElementById('loginError');
    btn.disabled=true;error.textContent='';
    try {
      if(!isDatabaseConnected())throw Error('Database not configured');
      const {error:loginError}=await supabaseClient.auth.signInWithPassword({email:username.value,password:document.getElementById('password').value});
      if(loginError)throw Error('Invalid email or password');
      if(!await isAuthorizedAdmin()) {await supabaseClient.auth.signOut();throw Error('This user is not authorized as a store administrator');}
      window.location.replace('dashboard.html');
    }catch(err){error.textContent=err.message;btn.disabled=false;}
  });
  document.getElementById('logoutBtn')?.addEventListener('click',async()=>{await supabaseClient?.auth.signOut();window.location.replace('login.html');});
});
