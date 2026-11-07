# CampusCash Malawi

A mobile-friendly student registration and loan application website with separate Home, About, Apply, Dashboard, Login, and Register pages.

## Pages and files
- `index.html` — Home
- `about.html` — About CampusCash
- `apply.html` — loan application
- `dashboard.html` — signed-in student's applications
- `login.html` — student login
- `register.html` — student registration
- `style.css` — shared responsive design
- `app.js` — Supabase Auth, page redirects, loan application submission and dashboard loading
- `supabase/schema.sql` — database schema, RPC submission function, and Row Level Security policies

All page navigation uses the repository's relative `.html` paths, which work both locally and under a GitHub Pages repository subpath.

## Publish with GitHub Pages
1. Upload all files and the `supabase` folder to the repository root.
2. Open repository **Settings → Pages**.
3. Under Build and deployment, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish the site.

## Connect Supabase Auth and the database
1. Create or open your Supabase project.
2. In **Project Settings → API** (or the Connect panel), copy the **Project URL** and **anon/publishable key**.
3. In `app.js`, replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` with those two public values.
4. Never put a `service_role` key in browser JavaScript.
5. Run the complete `supabase/schema.sql` file in the Supabase **SQL Editor**.
6. In Supabase **Authentication → URL Configuration**, set the Site URL to your published GitHub Pages site and add the published site URL (including the repository path) to the Redirect URLs. Also add the local development URL if you test locally.
7. Configure email confirmation to suit your testing and production needs. When confirmation is enabled, registration asks the student to confirm by email; the confirmation link returns them to `dashboard.html`. Students can sign in from `login.html` afterward.
8. Test registration, email confirmation, login, dashboard loading, logout, and loan application submission using a test account and dummy data.

Login routes to the dashboard by default. If a student tries to apply before signing in, login redirects them back to the application page after successful authentication. Dashboard records are filtered to the signed-in student's user ID and are also protected by the database's Row Level Security policies.

## Important security and launch notes
- Supabase Auth handles passwords; this website does not store passwords in its database.
- The browser uses only the public anon/publishable key. Row Level Security must remain enabled.
- Do not expose a `service_role` key or build admin access into browser-only code.
- This starter does not approve loans, disburse money, verify collateral, or guarantee a repayment outcome.
- Before accepting real applications, publish verified eligibility rules, fees, interest rates, repayment terms, privacy policy, complaints process, and official contact details.
- Test with dummy information before inviting students to use the system.
