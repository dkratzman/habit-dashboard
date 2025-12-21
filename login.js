

// --------------------------------------
// Check existing session
// --------------------------------------
//async function checkSession() {
//  const { data } = await supabaseClient.auth.getSession();

//  if (data.session) {
//    console.log("Already logged in:", data.session.user);
//    window.location.href = "index.html";
//  }
//}


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
  status.textContent = error.message;
  console.error(error);
  return;
}


// Login success
status.textContent = "Logged in successfully!";
console.log("User session:", data);

// Redirect to dashboard
window.location.href = "index.html";

  });
});
