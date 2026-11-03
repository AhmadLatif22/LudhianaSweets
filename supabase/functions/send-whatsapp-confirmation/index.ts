// Retired insecure public endpoint. WhatsApp is now initiated only by /api/orders
// after a server-validated order is committed. Keep this deployed as a denial
// response or delete the function from your Supabase project.
Deno.serve(() => new Response(JSON.stringify({error:"Endpoint retired. Use website checkout."}),{
  status:410,headers:{"Content-Type":"application/json"}
}));
