// --------------------------------------
// Login / Signup Page Logic
// --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
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

        const { error } = await supabaseClient.auth.signUp({
          email,
          password
        });

        if (error) {
          status.textContent = error.message;
          return;
        }

        status.textContent = "Account created! Redirecting...";
        setTimeout(() => {
          window.location.href = "index.html";
        }, 800);

        return;
      }

      // -------------------------
      // SIGN IN
      // -------------------------
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        status.textContent = error.message;
        return;
      }

      status.textContent = "Signed in successfully!";
      window.location.href = "index.html";

    } catch (err) {
      console.error(err);
      status.textContent = "Unexpected error occurred.";
    }
  });
});
