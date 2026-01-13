// --------------------------------------
// Login / Signup Page Logic
// --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const SESSION_STORAGE_KEY = "habitdash_session_v1";

  function _sessionToStorable(session) {
    if (!session) return null;
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user ? { id: session.user.id, email: session.user.email } : null,
    };
  }

  function saveSessionToLocalStorage(session) {
    try {
      const payload = _sessionToStorable(session);
      if (!payload) return;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("⚠️ Could not save session to localStorage", e);
    }
  }

  function loadSessionFromLocalStorage() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("⚠️ Could not read session from localStorage", e);
      return null;
    }
  }

  // ✅ If already logged in (or restorable), bypass login page
  (async () => {
    const { data: existing } = await supabaseClient.auth.getSession();
    if (existing?.session) {
      saveSessionToLocalStorage(existing.session);
      window.location.href = "index.html";
      return;
    }

    const saved = loadSessionFromLocalStorage();
    if (saved?.access_token && saved?.refresh_token) {
      const { data: restored, error } = await supabaseClient.auth.setSession({
        access_token: saved.access_token,
        refresh_token: saved.refresh_token,
      });

      if (!error && restored?.session) {
        saveSessionToLocalStorage(restored.session);
        window.location.href = "index.html";
      }
    }
  })();

  const form = document.getElementById("loginForm");
  const status = document.getElementById("loginStatus");

  const showSignupBtn = document.getElementById("showSignup");
  const showSigninBtn = document.getElementById("showSignin");

  const signupOnlyEls = document.querySelectorAll(".signup-only");
  const signinOnlyEls = document.querySelectorAll(".signin-only");

  function setMode(mode) {
    form.dataset.mode = mode;
    form.reset();
    status.textContent = "";

    if (mode === "signup") {
      signupOnlyEls.forEach(el => el.style.display = "block");
      signinOnlyEls.forEach(el => el.style.display = "none");
      form.querySelector(".auth-submit").textContent = "Create Account";
    } else {
      signupOnlyEls.forEach(el => el.style.display = "none");
      signinOnlyEls.forEach(el => el.style.display = "inline");
      form.querySelector(".auth-submit").textContent = "Sign In";
    }
  }

  // Default
  setMode("signin");

  // Toggle buttons
  showSignupBtn?.addEventListener("click", () => setMode("signup"));
  showSigninBtn?.addEventListener("click", () => setMode("signin"));

  // Submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const mode = form.dataset.mode;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword")?.value;

    status.textContent = "Working...";

    try {
      if (!email || !password) {
        status.textContent = "Email and password are required.";
        return;
      }

      // -------------------------
      // SIGN UP
      // -------------------------
      if (mode === "signup") {
        if (password.length < 6) {
          status.textContent = "Password must be at least 6 characters.";
          return;
        }

        if (password !== confirmPassword) {
          status.textContent = "Passwords do not match.";
          return;
        }

        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password
        });

        if (error) {
          status.textContent = error.message;
          return;
        }

        // If a session is returned immediately, persist it
        if (data?.session) saveSessionToLocalStorage(data.session);

        status.textContent = "Account created! Redirecting...";
        setTimeout(() => {
          window.location.href = "index.html";
        }, 800);

        return;
      }

      // -------------------------
      // SIGN IN
      // -------------------------
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        status.textContent = error.message;
        return;
      }

      // ✅ Persist session snapshot after successful login
      if (data?.session) saveSessionToLocalStorage(data.session);

      status.textContent = "Signed in successfully!";
      window.location.href = "index.html";

    } catch (err) {
      console.error(err);
      status.textContent = "Unexpected error occurred.";
    }
  });
});
