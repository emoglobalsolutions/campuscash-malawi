
/*
 CAMPUSCASH MALAWI
 Student registration, loan applications and dashboard.

 IMPORTANT:
 - Use your existing Supabase Project URL.
 - Use your existing Supabase publishable/anon key.
 - NEVER put a Supabase service_role key in this file.
 - Database RPC functions will be provided in schema.sql.
*/

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";

let supabaseClient = null;
let currentUser = null;

const LOAN_RATES = {
  1: 0.20,
  2: 0.30,
  3: 0.40,
  4: 0.50
};

const money = value =>
  "MWK " + Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });

const getElement = id => document.getElementById(id);

const valueOf = (form, name) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : value;
};

function toast(message) {
  const el = getElement("toast");
  if (!el) {
    alert(message);
    return;
  }

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3800);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function setupSupabase() {
  if (
    !window.supabase ||
    SUPABASE_URL.startsWith("YOUR_") ||
    SUPABASE_ANON_KEY.startsWith("YOUR_")
  ) {
    toast("Connect your existing Supabase Project URL and publishable key in app.js.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    updateSessionUI();

    if (currentUser) {
      setTimeout(() => {
        loadStudentDashboard();
        fillApplicationContactDetails();
      }, 0);
    } else {
      const list = getElement("applicationList");
      if (list) list.innerHTML = "";
    }
  });

  restoreSession();
}

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    toast(error.message);
    return;
  }

  currentUser = data.session?.user || null;
  updateSessionUI();

  if (currentUser) {
    await loadStudentDashboard();
    fillApplicationContactDetails();
  }
}

function updateSessionUI() {
  const box = getElement("sessionBox");
  const logout = getElement("logoutBtn");

  if (currentUser) {
    box?.classList.remove("hidden");
    logout?.classList.remove("hidden");

    if (box) {
      box.textContent = `Signed in as ${currentUser.email}. You can now apply and track your application.`;
    }
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

  if (name && !name.value) {
    name.value = profile.full_name || "";
  }

  if (phone && !phone.value) {
    phone.value = profile.phone || "";
  }

  if (email && !email.value) {
    email.value = currentUser.email || "";
  }
}

/* STUDENT REGISTRATION */

getElement("registerForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabaseClient) {
    return toast("Supabase is not connected.");
  }

  const form = new FormData(event.currentTarget);

  const full_name = valueOf(form, "full_name");
  const phone = valueOf(form, "phone");
  const email = valueOf(form, "email");
  const password = valueOf(form, "password");

  if (password.length < 8) {
    return toast("Your password must contain at least 8 characters.");
  }

  const button = event.currentTarget.querySelector("button[type=submit]");
  if (button) button.disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone
        }
      }
    });

    if (error) throw error;

    event.currentTarget.reset();

    if (data.session) {
      currentUser = data.user;
      updateSessionUI();
      fillApplicationContactDetails();
      toast("Your student account has been created.");
      await loadStudentDashboard();
    } else {
      toast("Registration received. Check your email to confirm your account before signing in.");
    }
  } catch (error) {
    toast(error.message || "Registration failed.");
  } finally {
    if (button) button.disabled = false;
  }
});

/* STUDENT LOGIN */

getElement("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabaseClient) {
    return toast("Supabase is not connected.");
  }

  const form = new FormData(event.currentTarget);

  const button = event.currentTarget.querySelector("button[type=submit]");
  if (button) button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: valueOf(form, "email"),
      password: valueOf(form, "password")
    });

    if (error) throw error;

    event.currentTarget.reset();
    toast("Welcome back to CampusCash Malawi.");
  } catch (error) {
    toast(error.message || "Login failed.");
  } finally {
    if (button) button.disabled = false;
  }
});

/* STUDENT LOGOUT */

getElement("logoutBtn")?.addEventListener("click", async () => {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    toast(error.message);
    return;
  }

  currentUser = null;
  updateSessionUI();
  toast("You have signed out.");
});

/* LOAN REPAYMENT ESTIMATE */

function updateLoanEstimate() {
  const amountInput = getElement("loanAmount");
  const termInput = getElement("loanTerm");

  if (!amountInput || !termInput) return;

  const amount = Number(amountInput.value);
  const term = Number(termInput.value);
  const rate = LOAN_RATES[term];

  const validAmount =
    Number.isFinite(amount) &&
    amount >= 20000 &&
    amount <= 2000000;

  const validTerm = Boolean(rate);

  const principal = validAmount ? amount : 0;
  const interest = validAmount && validTerm ? principal * rate : 0;
  const total = principal + interest;

  getElement("estimatePrincipal").textContent = money(principal);

  getElement("estimateRate").textContent =
    validTerm ? `${rate * 100}%` : "—";

  getElement("estimateInterest").textContent = money(interest);
  getElement("estimateTotal").textContent = money(total);

  let dueDate = "—";

  if (validAmount && validTerm) {
    const date = new Date();
    date.setDate(date.getDate() + term * 7);

    dueDate = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  getElement("estimateDueDate").textContent = dueDate;
}

getElement("loanAmount")?.addEventListener("input", updateLoanEstimate);
getElement("loanTerm")?.addEventListener("change", updateLoanEstimate);

/* STUDENT LOAN APPLICATION */

getElement("applicationForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabaseClient) {
    return toast("Connect Supabase before applying.");
  }

  if (!currentUser) {
    return toast("Please create an account or sign in first.");
  }

  const formElement = event.currentTarget;
  const form = new FormData(formElement);

  const amount = Number(valueOf(form, "amount_requested"));
  const term = Number(valueOf(form, "loan_term"));
  const rate = LOAN_RATES[term];

  if (!Number.isFinite(amount) || amount < 20000 || amount > 2000000) {
    return toast("Loan amount must be between MWK 20,000 and MWK 2,000,000.");
  }

  if (!rate) {
    return toast("Select a valid repayment period.");
  }

  if (valueOf(form, "collateral_confirmation") !== "yes") {
    return toast("Please confirm that your collateral is available for physical verification.");
  }

  if (valueOf(form, "information_confirmation") !== "yes") {
    return toast("Please confirm your application information.");
  }

  if (valueOf(form, "terms_confirmation") !== "yes") {
    return toast("Please confirm that you have reviewed the repayment estimate.");
  }

  const applicationData = {
    full_name: valueOf(form, "full_name"),
    date_of_birth: valueOf(form, "date_of_birth"),
    phone: valueOf(form, "phone"),
    email: valueOf(form, "email"),
    residential_address: valueOf(form, "residential_address"),

    institution: valueOf(form, "institution"),
    programme: valueOf(form, "programme"),
    study_year: valueOf(form, "study_year"),
    student_id: valueOf(form, "student_id"),

    amount_requested: amount,
    loan_term_weeks: term,
    interest_rate: rate,
    interest_amount: Number((amount * rate).toFixed(2)),
    total_repayment: Number((amount * (1 + rate)).toFixed(2)),
    purpose: valueOf(form, "purpose"),

    collateral_type: valueOf(form, "collateral_type"),
    collateral_estimated_value: Number(
      valueOf(form, "collateral_estimated_value")
    ),
    collateral_description: valueOf(form, "collateral_description"),
    collateral_available_for_verification: true,

    emergency_contact_name: valueOf(form, "emergency_contact_name"),
    emergency_contact_phone: valueOf(form, "emergency_contact_phone"),
    emergency_contact_relationship: valueOf(
      form,
      "emergency_contact_relationship"
    )
  };

  if (
    !Number.isFinite(applicationData.collateral_estimated_value) ||
    applicationData.collateral_estimated_value <= 0
  ) {
    return toast("Enter a valid estimated collateral value.");
  }

  const button = formElement.querySelector("button[type=submit]");
  if (button) {
    button.disabled = true;
    button.textContent = "Submitting application...";
  }

  try {
    /*
      This RPC will be created in the matching schema.sql.
      It must insert the application and collateral atomically
      and derive the applicant ID from auth.uid() on the server.
    */
    const { data, error } = await supabaseClient.rpc(
      "submit_loan_application",
      {
        p_application: applicationData
      }
    );

    if (error) throw error;

    const message = getElement("applicationMessage");

    if (message) {
      message.textContent =
        "Your application has been received. Your collateral is still pending physical verification. CampusCash staff will contact you to arrange an inspection. Keep your application reference safe.";
      message.classList.remove("hidden");
    }

    formElement.reset();
    updateLoanEstimate();

    toast("Loan application submitted successfully.");
    await loadStudentDashboard();
  } catch (error) {
    console.error("Application submission:", error);

    toast(
      error.message ||
      "Application could not be submitted. Check the database setup."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Submit Loan Application";
    }
  }
});

/* STUDENT DASHBOARD */

async function loadStudentDashboard() {
  const dashboard = getElement("studentDashboard");
  const list = getElement("applicationList");

  if (!dashboard || !list) return;

  if (!currentUser || !supabaseClient) {
    dashboard.innerHTML =
      '<p class="muted">Please sign in to view your student dashboard.</p>';
    list.innerHTML = "";
    return;
  }

  dashboard.innerHTML =
    '<p class="muted">Loading your applications...</p>';

  const { data, error } = await supabaseClient
    .from("loan_applications")
    .select(
      "id, amount_requested, loan_term_weeks, status, created_at, total_repayment"
    )
    .order("created_at", { ascending: false });

  if (error) {
    dashboard.textContent =
      "Your dashboard could not be loaded. " + error.message;
    return;
  }

  const applications = data || [];

  if (!applications.length) {
    dashboard.innerHTML =
      '<p class="muted">You have not submitted any loan applications yet. Use the application form to get started.</p>';
    list.innerHTML = "";
    return;
  }

  dashboard.innerHTML = `
    <div class="dashboard-summary">
      <p><strong>Total applications:</strong> ${applications.length}</p>
    </div>
  `;

  list.innerHTML = applications.map(application => `
    <article class="application-item">
      <h4>Application ${escapeHTML(application.id.slice(0, 8).toUpperCase())}</h4>
      <p><strong>Requested:</strong> ${money(application.amount_requested)}</p>
      <p><strong>Estimated repayment:</strong> ${money(application.total_repayment)}</p>
      <p><strong>Repayment period:</strong> ${escapeHTML(application.loan_term_weeks || "—")} week(s)</p>
      <p><strong>Status:</strong> ${escapeHTML(application.status)}</p>
      <p><strong>Submitted:</strong> ${new Date(application.created_at).toLocaleDateString("en-GB")}</p>
      <p><strong>Collateral:</strong> Physical verification is required. Check with CampusCash staff for your verification appointment.</p>
    </article>
  `).join("");
}

/* PAGE INITIALIZATION */

const yearElement = getElement("year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

setupSupabase();
