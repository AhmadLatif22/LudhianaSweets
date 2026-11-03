/* Reviews: public reads only approved entries; posting creates pending entries.
   Photo uploads are intentionally disabled until a secured upload endpoint is added. */
const reviewEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function starsMarkup(rating){return '★'.repeat(Math.max(0,Math.min(5,Math.round(Number(rating)||0))))+'☆'.repeat(Math.max(0,5-Math.round(Number(rating)||0)));}
function renderStarPickerHTML(id, initial=5){return `<div class="review-star-picker" id="${reviewEscape(id)}" role="group" aria-label="Rate from one to five stars">${[1,2,3,4,5].map(x=>`<button type="button" data-rating="${x}" aria-label="${x} stars" aria-pressed="${x===initial}">${x<=initial?'★':'☆'}</button>`).join('')}</div>`;}
function attachStarPicker(id,callback){const el=document.getElementById(id);if(!el)return;el.addEventListener('click',e=>{const btn=e.target.closest('[data-rating]');if(!btn)return;const rating=Number(btn.dataset.rating);el.querySelectorAll('[data-rating]').forEach(b=>{const n=Number(b.dataset.rating);b.textContent=n<=rating?'★':'☆';b.setAttribute('aria-pressed',String(n===rating));});callback(rating);});}
async function loadReviewsForProduct(productId){
  if(!isDatabaseConnected())return [];
  const {data,error}=await supabaseClient.from('reviews').select('id,name,rating,comment,photo_url,created_at').eq('product_id',productId).eq('approved',true).order('created_at',{ascending:false}).limit(50);
  if(error){console.error('Reviews unavailable',error.message);return [];}
  return data||[];
}
async function submitReview({productId,name,rating,comment,photoFile}){
  if(!isDatabaseConnected())return {ok:false,reason:'offline'};
  if(photoFile)return {ok:false,reason:'Photo uploads are temporarily unavailable'};
  if(typeof name!=='string'||name.trim().length<2||name.length>100||typeof comment!=='string'||comment.trim().length<10||comment.length>2000||!Number.isInteger(rating)||rating<1||rating>5)return {ok:false,reason:'Enter a name and a review of at least 10 characters'};
  const {error}=await supabaseClient.from('reviews').insert({product_id:productId,name:name.trim(),comment:comment.trim(),rating,approved:false,source:'customer'});
  return error?{ok:false,reason:error.message}:{ok:true};
}
async function adminLoadAllReviews(){if(!isDatabaseConnected())return [];const {data,error}=await supabaseClient.from('reviews').select('*').order('created_at',{ascending:false});if(error){console.error(error.message);return [];}return data||[];}
async function adminAddReview({productId,name,rating,comment,photoFile}){
  if(!isDatabaseConnected())return {ok:false,reason:'Database is not connected'};
  if(photoFile)return {ok:false,reason:'Photo uploads are temporarily unavailable'};
  const {error}=await supabaseClient.from('reviews').insert({product_id:productId,name:name.slice(0,100).trim(),comment:comment.slice(0,2000).trim(),rating,approved:true,source:'admin'});
  return error?{ok:false,reason:error.message}:{ok:true};
}
async function adminSetReviewApproval(id,approved){return supabaseClient.from('reviews').update({approved}).eq('id',id);}
async function adminDeleteReview(id){return supabaseClient.from('reviews').delete().eq('id',id);}
function subscribeToReviews(productId,callback){if(!isDatabaseConnected())return null;return supabaseClient.channel(`product-review-${productId}`).on('postgres_changes',{event:'*',schema:'public',table:'reviews',filter:`product_id=eq.${productId}`},callback).subscribe();}
