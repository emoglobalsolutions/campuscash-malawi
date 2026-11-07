/*
 * CAMPUSCASH MALAWI
 * Supabase Auth, student loan application, dashboard, navigation and form helpers.
 * Configure only the public Supabase URL and anon/publishable key below.
 * Never place a service_role key in browser code.
 */
const SUPABASE_URL = "https://ebrkvcoittwhhmyimcnn.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";

let supabaseClient = null;
let currentUser = null;
let authReady = false;

const LOAN_RATES = { 1: 0.20, 2: 0.30, 3: 0.40, 4: 0.50 };
const getElement = id => document.getElementById(id);
const money = value => "MWK " + Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

function loadInterfaceStyles() {
  if (document.querySelector('link[data-campuscash-interface]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("interface.css", document.baseURI).toString();
  link.dataset.campuscashInterface = "true";
  document.head.append(link);
}

function setupDropdownNavigation() {
  const header = document.querySelector(".topbar");
  const nav = header?.querySelector(".nav-links");
  if (!header || !nav || header.querySelector(".menu-toggle")) return;

  const button = document.createElement("button");
  const navId = nav.id || "campuscash-navigation";
  nav.id = navId;
  button.type = "button";
  button.className = "menu-toggle";
  button.setAttribute("aria-label", "Open navigation menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", navId);
  button.innerHTML = '<span class="menu-toggle-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  header.insertBefore(button, nav);

  const closeMenu = () => {
    nav.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");
  };
  button.addEventListener("click", () => {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isOpen));
    button.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
    nav.classList.toggle("is-open", !isOpen);
  });
  nav.addEventListener("click", event => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("click", event => {
    if (!header.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      button.focus();
    }
  });
}

function setupPasswordVisibility() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.closest(".password-field")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      toggle.textContent = reveal ? "Hide" : "Show";
      toggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(reveal));
      input.focus();
    });
    wrapper.append(toggle);
  });
}

function toast(message) {
  const el = getElement("toast");
  if (!el) {
    window.alert(message);
    return;
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function pageUrl(filename) {
  return new URL(filename, window.location.href).toString();
}

function currentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function getSafeNextPage(fallback = "dashboard.html") {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested) return fallback;
  try {
    const url = new URL(requested, window.location.href);
    if (url.origin !== window.location.origin) return fallback;
    const allowed = ["index.html", "about.html", "apply.html", "dashboard.html", "login.html", "register.html"];
    return allowed.includes(url.pathname.split("/").pop()) ? url.toString() : pageUrl(fallback);
  } catch {
    return pageUrl(fallback);
  }
}

function updateSessionUI() {
  const box = getElement("sessionBox");
  const logout = getElement("logoutBtn");
  if (currentUser) {
    box?.classList.remove("hidden");
    logout?.classList.remove("hidden");
    if (box) box.textContent = `Signed in as ${currentUser.email || "student"}.`;
  } else {
    box?.classList.add("hidden");
    logout?.classList.add("hidden");
  }
}

function fillApplicationContactDetails() {
  if (!currentUser) return;
  const form = getElement("applicationForm");
  if (!form) return;
  const profile = currentUser.user_metadata || {};
  const name = form.elements.namedItem("full_name");
  const phone = form.elements.namedItem("phone");
  const email = form.elements.namedItem("email");
  if (name && !name.value) name.value = profile.full_name || "";
  if (phone && !phone.value) phone.value = profile.phone || "";
  if (email && !email.value) email.value = currentUser.email || "";
}

async function handleAuthState(session) {
  currentUser = session?.user || null;
  authReady = true;
  updateSessionUI();
  fillApplicationContactDetails();

  const dashboard = getElement("studentDashboard");
  if (dashboard) {
    if (currentUser) {
      await loadStudentDashboard();
    } else {
      window.location.replace(pageUrl(`login.html?next=${encodeURIComponent("dashboard.html")}`));
    }
  }
}

function setupSupabase() {
  const configured = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes("YOUR_");

  if (!window.supabase?.createClient) {
    toast("Supabase could not load. Check your internet connection and reload.");
    return;
  }
  if (!configured) {
    toast("Add your Supabase project URL and anon/publishable key in app.js to enable accounts.");
    const dashboard = getElement("studentDashboard");
    if (dashboard) dashboard.textContent = "Supabase is not configured yet. Add the project URL and anon/publishable key to app.js.";
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => handleAuthState(session), 0);
  });
  restoreSession();
}

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    toast(error.message || "Could not restore your sign-in session.");
    return;
  }
  await handleAuthState(data.session);
  if (currentUser && ["login.html", "register.html"].includes(currentPage())) {
    window.location.replace(pageUrl("dashboard.html"));
  }
}

/* STUDENT REGISTRATION */
getElement("registerForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) return toast("Supabase is not connected. Add the project URL and anon/publishable key in app.js.");
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const full_name = String(form.get("full_name") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (password.length < 8) return toast("Your password must contain at least 8 characters.");

  const button = formElement.querySelector("button[type=submit]");
  if (button) { button.disabled = true; button.textContent = "Creating account..."; }
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone }, emailRedirectTo: pageUrl("dashboard.html") }
    });
    if (error) throw error;
    formElement.reset();
    if (data.session) {
      currentUser = data.user;
      updateSessionUI();
      toast("Your student account has been created.");
      window.location.assign(pageUrl("dashboard.html"));
    } else {
      toast("Registration received. Check your email to confirm your account, then sign in.");
      window.setTimeout(() => window.location.assign(pageUrl("login.html")), 1600);
    }
  } catch (error) {
    toast(error.message || "Registration failed.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Create Account"; }
  }
});

/* STUDENT LOGIN */
getElement("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) return toast("Supabase is not connected. Add the project URL and anon/publishable key in app.js.");
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector("button[type=submit]");
  if (button) { button.disabled = true; button.textContent = "Signing in..."; }
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || "")
    });
    if (error) throw error;
    formElement.reset();
    toast("Welcome back to CampusCash Malawi.");
    window.location.assign(getSafeNextPage());
  } catch (error) {
    toast(error.message || "Login failed.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Login"; }
  }
});

/* STUDENT LOGOUT */
getElement("logoutBtn")?.addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) return toast(error.message || "Could not sign out.");
  currentUser = null;
  updateSessionUI();
  window.location.assign(pageUrl("login.html"));
});

/* LOAN REPAYMENT ESTIMATE */
function updateLoanEstimate() {
  const amountInput = getElement("loanAmount");
  const termInput = getElement("loanTerm");
  if (!amountInput || !termInput) return;
  const amount = Number(amountInput.value);
  const term = Number(termInput.value);
  const rate = LOAN_RATES[term];
  const validAmount = Number.isFinite(amount) && amount >= 20000 && amount <= 2000000;
  const validTerm = Boolean(rate);
  const principal = validAmount ? amount : 0;
  const interest = validAmount && validTerm ? principal * rate : 0;
  getElement("estimatePrincipal").textContent = money(principal);
  getElement("estimateRate").textContent = validTerm ? `${rate * 100}%` : "—";
  getElement("estimateInterest").textContent = money(interest);
  getElement("estimateTotal").textContent = money(principal + interest);
  let dueDate = "—";
  if (validAmount && validTerm) {
    const date = new Date();
    date.setDate(date.getDate() + term * 7);
    dueDate = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  getElement("estimateDueDate").textContent = dueDate;
}
getElement("loanAmount")?.addEventListener("input", updateLoanEstimate);
getElement("loanTerm")?.addEventListener("change", updateLoanEstimate);

/* STUDENT LOAN APPLICATION */
getElement("applicationForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) return toast("Supabase is not connected. Add the project URL and anon/publishable key in app.js.");
  if (!currentUser) {
    window.location.assign(pageUrl(`login.html?next=${encodeURIComponent("apply.html")}`));
    return;
  }

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const value = name => {
    const item = form.get(name);
    return typeof item === "string" ? item.trim() : item;
  };
  const amount = Number(value("amount_requested"));
  const term = Number(value("loan_term"));
  const rate = LOAN_RATES[term];
  if (!Number.isFinite(amount) || amount < 20000 || amount > 2000000) return toast("Loan amount must be between MWK 20,000 and MWK 2,000,000.");
  if (!rate) return toast("Select a valid repayment period.");
  for (const field of ["collateral_confirmation", "information_confirmation", "terms_confirmation"]) {
    if (value(field) !== "yes") return toast("Please confirm all required statements before submitting.");
  }
  const collateralValue = Number(value("collateral_estimated_value"));
  if (!Number.isFinite(collateralValue) || collateralValue <= 0) return toast("Enter a valid estimated collateral value.");

  const applicationData = {
    full_name: value("full_name"), date_of_birth: value("date_of_birth"), phone: value("phone"), email: value("email"),
    residential_address: value("residential_address"), institution: value("institution"), programme: value("programme"),
    study_year: value("study_year"), student_id: value("student_id"), amount_requested: amount, loan_term_weeks: term,
    purpose: value("purpose"), collateral_type: value("collateral_type"), collateral_estimated_value: collateralValue,
    collateral_description: value("collateral_description"), collateral_confirmation: true,
    emergency_contact_name: value("emergency_contact_name"), emergency_contact_phone: value("emergency_contact_phone"),
    emergency_contact_relationship: value("emergency_contact_relationship")
  };

  const button = formElement.querySelector("button[type=submit]");
  if (button) { button.disabled = true; button.textContent = "Submitting application..."; }
  try {
    const { data, error } = await supabaseClient.rpc("submit_loan_application", { p_application: applicationData });
    if (error) throw error;
    const reference = typeof data === "string" ? data.slice(0, 8).toUpperCase() : "received";
    const message = getElement("applicationMessage");
    if (message) {
      message.textContent = `Application received (reference ${reference}). Your collateral is pending physical verification. CampusCash staff will contact you about the next steps.`;
      message.classList.remove("hidden");
    }
    formElement.reset();
    updateLoanEstimate();
    toast("Loan application submitted successfully.");
    await loadStudentDashboard();
  } catch (error) {
    console.error("Application submission:", error);
    toast(error.message || "Application could not be submitted. Check the Supabase schema setup.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Submit Loan Application"; }
  }
});

/* STUDENT DASHBOARD */
async function loadStudentDashboard() {
  const dashboard = getElement("studentDashboard");
  const list = getElement("applicationList");
  if (!dashboard || !list || !currentUser || !supabaseClient) return;
  dashboard.textContent = "Loading your applications...";
  list.replaceChildren();
  const { data, error } = await supabaseClient
    .from("loan_applications")
    .select("id, amount_requested, loan_term_weeks, status, created_at, total_repayment")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    dashboard.textContent = `Your dashboard could not be loaded: ${error.message}`;
    return;
  }
  const applications = data || [];
  if (!applications.length) {
    dashboard.innerHTML = '<p class="muted">You have not submitted any loan applications yet.</p><a class="btn btn-primary" href="apply.html">Start an application</a>';
    return;
  }
  dashboard.innerHTML = `<p><strong>Total applications:</strong> ${applications.length}</p>`;
  list.innerHTML = applications.map(application => `
    <article class="application-item">
      <h4>Application ${escapeHTML(String(application.id).slice(0, 8).toUpperCase())}</h4>
      <p><strong>Requested:</strong> ${money(application.amount_requested)}</p>
      <p><strong>Estimated repayment:</strong> ${money(application.total_repayment)}</p>
      <p><strong>Repayment period:</strong> ${escapeHTML(application.loan_term_weeks || "—")} week(s)</p>
      <p><strong>Status:</strong> ${escapeHTML(application.status)}</p>
      <p><strong>Submitted:</strong> ${application.created_at ? new Date(application.created_at).toLocaleDateString("en-GB") : "—"}</p>
      <p><strong>Collateral:</strong> Physical verification is required. Check with CampusCash staff for your verification appointment.</p>
    </article>
  `).join("");
}

const yearElement = getElement("year");
if (yearElement) yearElement.textContent = new Date().getFullYear();
loadInterfaceStyles();
setupDropdownNavigation();
setupPasswordVisibility();
setupSupabase();
