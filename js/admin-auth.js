/* ==========================================================================
   admin-auth.js
   Once SUPABASE_URL/SUPABASE_ANON_KEY are set in js/supabase-client.js, this
   uses real Supabase Auth (email + password) — required for the database's
   Row Level Security policies to allow product/price writes.

   TODO(you): create your admin user in Supabase → Authentication → Users →
   Add User. Use that email/password to sign in below.

   Until Supabase is configured, this falls back to the old demo gate
   (admin / ludhiana123) purely so the panel is still browsable — but demo
   mode can only READ data, since the database itself only accepts writes
   from a real authenticated session.
   ========================================================================== */

const ADMIN_SESSION_KEY = "ls_admin_session";
const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "ludhiana123";

function isAdminLoggedIn() {
  if (isDatabaseConnected()) {
    return Boolean(window._lsAdminSession);
  }
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

async function requireAdminAuth() {
  if (isDatabaseConnected()) {
    const { data } = await supabaseClient.auth.getSession();
    window._lsAdminSession = data.session;
    if (!data.session && !window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
    return;
  }
  if (!isAdminLoggedIn() && !window.location.pathname.endsWith("login.html")) {
    window.location.href = "login.html";
  }
}

if (!window.location.pathname.endsWith("login.html")) {
  requireAdminAuth();
}

document.addEventListener("DOMContentLoaded", () => {
  // Swap the label from "Username" to "Email" when running in real-database mode.
  const usernameLabel = document.querySelector('label[for="username"]');
  if (usernameLabel && isDatabaseConnected()) {
    usernameLabel.textContent = "Email";
    document.getElementById("username").type = "email";
  }

  const subtitle = document.getElementById("loginSubtitle");
  const demoHint = document.getElementById("demoCredentialsHint");
  if (isDatabaseConnected()) {
    if (subtitle) subtitle.textContent = "Sign in with your Supabase admin account.";
    if (demoHint) demoHint.style.display = "none";
  }

  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("loginError");
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (isDatabaseConnected()) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in...";
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: username,
        password,
      });
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
      if (error) {
        errorEl.textContent = "Invalid email or password.";
        return;
      }
      window._lsAdminSession = data.session;
      window.location.href = "dashboard.html";
      return;
    }

    // Demo fallback (no Supabase keys set yet)
    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      window.location.href = "dashboard.html";
    } else {
      errorEl.textContent = "Invalid username or password.";
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (isDatabaseConnected()) {
      await supabaseClient.auth.signOut();
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
    window.location.href = "login.html";
  });
});
