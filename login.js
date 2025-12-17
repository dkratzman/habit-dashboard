// --------------------------------------
// Supabase Setup (same as other files)
// --------------------------------------
const SUPABASE_URL = "https://jqbtpdtvsgmpedddnerp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxYnRwZHR2c2dtcGVkZGRuZXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTMwNTAsImV4cCI6MjA4MDg2OTA1MH0.z9qLJ2zJZSwq3NPC98fEQDm3vPY8YKgG6Z43cfn28vs";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// --------------------------------------
// Check existing session
// --------------------------------------
async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    console.log("Already logged in:", data.session.user);
    window.location.href = "index.html";
  }
}

checkSession();

// --------------------------------------
// Login Logic
// --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const status = document.getElementById("loginStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    status.textContent = "Signing in...";

    // Try logging in first
    let { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    // If login fails, try signing up
    if (error) {
      const signupResult = await supabaseClient.auth.signUp({
        email,
        password
      });

      if (signupResult.error) {
        status.textContent = signupResult.error.message;
        console.error(signupResult.error);
        return;
      }

      status.textContent = "Account created! You can now log in.";
      return;
    }

// Login success
status.textContent = "Logged in successfully!";
console.log("User session:", data);

// Redirect to dashboard
window.location.href = "index.html";

  });
});
