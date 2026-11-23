# AssignmentHub

Initial source package for the AssignmentHub customer website and single-admin panel.

## Current state
This is a starter implementation, **not yet a live production website**. Do not accept real orders until Supabase is configured and all flows are tested.

## Files
- `index.html` customer storefront
- `admin.html` single-admin login and order manager
- `app.js`, `admin.js` frontend behavior
- `styles.css` responsive styling; prices are dark and bold
- `config.js` Supabase URL and anon key placeholders
- `supabase-schema.sql` initial orders schema and database functions

## Setup still required
1. Create a Supabase free-tier project.
2. Create the one admin user manually in Supabase Authentication; disable public sign-ups.
3. Copy the admin user's Auth UID and replace `REPLACE_WITH_ADMIN_USER_UUID` in the SQL policies.
4. Run the SQL in Supabase SQL Editor.
5. Add Supabase Project URL and anon/public key to `config.js`. Never use the service_role key in browser code.
6. Deploy to GitHub Pages or Cloudflare Pages.
7. Test customer orders, tracking, admin login and status updates.

## Not yet implemented
Secure reference-file upload/storage, writing-request persistence, rate limiting/abuse protection, payment gateway and WhatsApp notifications. The writing request form intentionally does not submit or pretend to upload files until those systems are added and tested. Free tiers have quotas and may pause or restrict usage.
