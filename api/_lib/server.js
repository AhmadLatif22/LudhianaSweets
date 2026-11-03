import { createClient } from '@supabase/supabase-js';

export function response(res, code, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(code).json(body);
}
export function allowMethod(req, res, method = 'POST') {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  response(res, 405, {error: 'Method not allowed'});
  return false;
}
export function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server database is not configured');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
}
export async function requireAdmin(req) {
  const jwt = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!jwt) return null;
  const supabase = db();
  const {data:{user},error} = await supabase.auth.getUser(jwt);
  if (error || !user) return null;
  const {data:admin,error:adminError} = await supabase.from('store_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if (adminError || !admin) return null;
  return {user,supabase};
}

export {validUUID,cleanCustomer,cleanItems} from './validation.js';
