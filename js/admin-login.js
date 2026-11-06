/* Admin sign-in. Supabase login alone is not authorization: the account must
   also be in the store_admins allowlist (is_store_admin RPC). */
(async () => {
  const { $, icon } = A, err = $("#loginError"), btn = $("#loginBtn"), pw = $("#password"), tg = $("#pwToggle");
  $("#perks").innerHTML = [["bag", "Confirm, pack and dispatch orders"], ["layers", "Keep stock accurate in real time"], ["star", "Moderate customer reviews"]].map(([i, t]) => `<li>${icon(i)}${t}</li>`).join("");
  tg.innerHTML = icon("eye");
  tg.onclick = () => { const show = pw.type === "password"; pw.type = show ? "text" : "password"; tg.innerHTML = icon(show ? "eyeoff" : "eye"); tg.setAttribute("aria-label", show ? "Hide password" : "Show password"); };
  const show = (m) => { err.textContent = m; err.hidden = !m; };
  const q = new URLSearchParams(location.search);
  if (q.get("expired")) show("Your session has ended. Please sign in again.");
  if (q.get("denied")) show("That account is not authorised as a store administrator.");
  if (typeof isDatabaseConnected !== "function" || !isDatabaseConnected()) show("The database connection is not configured.");
  else if (!q.get("denied") && (await A.guard()).ok) return location.replace("dashboard.html");
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); show("");
    const email = $("#email").value.trim(), pass = pw.value;
    if (!email || !pass) return show("Enter your email and password.");
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (error) throw Error("Incorrect email or password.");
      const g = await A.guard();
      if (!g.ok) { await supabaseClient.auth.signOut(); throw Error("That account is not authorised as a store administrator."); }
      location.replace("dashboard.html");
    } catch (ex) { show(ex.message); btn.disabled = false; btn.textContent = "Sign in"; }
  });
})();
