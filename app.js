/*
 CampusCash Malawi starter application.
 1. Create a Supabase project.
 2. Paste the Project URL and anon/publishable key below.
 3. Run supabase/schema.sql in Supabase SQL Editor.
 Never put a service_role key in browser code.
*/
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";

let supabaseClient = null;
let currentUser = null;

const toast = (message) => {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
};

function setupSupabase() {
  if (!window.supabase || SUPABASE_URL.startsWith("YOUR_") || SUPABASE_ANON_KEY.startsWith("YOUR_")) {
    toast("Website preview mode: connect your Supabase project to enable accounts and applications.");
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  restoreSession();
}

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return toast(error.message);
  currentUser = data.session?.user || null;
  updateSessionUI();
}

function updateSessionUI() {
  const box = document.getElementById("sessionBox");
  const logout = document.getElementById("logoutBtn");
  if (currentUser) {
    box.classList.remove("hidden");
    logout.classList.remove("hidden");
    box.textContent = `Signed in as ${currentUser.email}. You can submit your application below.`;
  } else {
    box.classList.add("hidden");
    logout.classList.add("hidden");
  }
}

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return toast("Connect Supabase first. See README.md.");
  const form = new FormData(event.currentTarget);
  const full_name = form.get("full_name").trim();
  const phone = form.get("phone").trim();
  const email = form.get("email").trim();
  const password = form.get("password");
  const { data, error } = await supabaseClient.auth.signUp({
    email, password, options: { data: { full_name, phone } }
  });
  if (error) return toast(error.message);
  event.currentTarget.reset();
  toast(data.session ? "Account created. You are signed in." : "Registration received. Check your email to confirm your account.");
  if (data.session) { currentUser = data.user; updateSessionUI(); }
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return toast("Connect Supabase first. See README.md.");
  const form = new FormData(event.currentTarget);
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: form.get("email").trim(), password: form.get("password")
  });
  if (error) return toast(error.message);
  currentUser = data.user;
  updateSessionUI();
  toast("You are now signed in.");
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) return toast(error.message);
  currentUser = null;
  updateSessionUI();
  toast("You have signed out.");
});

document.getElementById("applicationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("applicationMessage");
  if (!supabaseClient) return toast("Connect Supabase first. See README.md.");
  if (!currentUser) return toast("Please create an account or sign in before applying.");
  const form = new FormData(event.currentTarget);
  const application = {
    user_id: currentUser.id,
    full_name: form.get("full_name").trim(),
    phone: form.get("phone").trim(),
    institution: form.get("institution").trim(),
    programme: form.get("programme").trim(),
    study_year: form.get("study_year"),
    amount_requested: Number(form.get("amount_requested")),
    purpose: form.get("purpose").trim()
  };
  if (!Number.isFinite(application.amount_requested) || application.amount_requested <= 0) {
    return toast("Enter a valid amount.");
  }
  const { error } = await supabaseClient.from("loan_applications").insert(application);
  if (error) return toast(error.message);
  event.currentTarget.reset();
  message.textContent = "Your application has been submitted. Keep your account details safe and sign in later to follow up with the CampusCash team.";
  message.classList.remove("hidden");
  toast("Application submitted successfully.");
});

document.getElementById("year").textContent = new Date().getFullYear();
setupSupabase();