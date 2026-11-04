# CampusCash Malawi

A mobile-friendly starter website for student registration and loan applications.

## Files
- `index.html` — page structure and forms
- `style.css` — responsive design
- `app.js` — Supabase registration, login and loan application submission
- `supabase/schema.sql` — database table and Row Level Security policies

## 1. Publish with GitHub Pages
1. Upload all files and the `supabase` folder to the root of your GitHub repository.
2. Open repository **Settings → Pages**.
3. Under Build and deployment, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish the site.

## 2. Connect Supabase
1. Create a Supabase project.
2. Open **Project Settings → API** (or the Connect panel).
3. Copy the Project URL and the anon/publishable key.
4. In `app.js`, replace:
   - `YOUR_SUPABASE_PROJECT_URL`
   - `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`
5. Never use a `service_role` key in website JavaScript.
6. In Supabase **SQL Editor**, run the complete contents of `supabase/schema.sql`.
7. In **Authentication → URL Configuration**, add your published GitHub Pages URL to the Site URL and Redirect URLs.
8. Configure email confirmation according to your testing and production requirements.

## 3. Important security and launch notes
- The browser uses Supabase Auth; passwords are not stored in this website's database.
- Row Level Security policies restrict students to their own application records.
- Do not create an admin dashboard by exposing a service-role key in JavaScript. Admin access must be implemented with trusted server-side logic or carefully controlled database roles.
- This starter does not approve loans, disburse money, verify collateral, or calculate repayments.
- Before accepting real applications, publish verified eligibility rules, fees, interest rates, repayment terms, privacy policy, complaints process and official contact details.
- Test with dummy information before inviting students to use the system.