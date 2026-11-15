# Deadline

A personal deadline dashboard with a calendar, schedule, overdue and completed lists, and manually added assignments. The site is a static Vite app; assignments and preferences are stored in Supabase behind owner-only row-level security.

## Current source coverage

- Manual assignments and checklist changes are stored in Supabase.
- The WeBWorK importer is deployed and manual refresh has been verified. It reads the public schedule for MATH1013 and only sees sets currently listed as open. Previously imported entries are retained.
- Canvas imports dated assignments from the private calendar feed. Some feed entries supply only a date; their exact due time is unavailable. The feed has a limited historical range and does not include undated assignments.
- Zinc is not configured yet.
- Supabase Cron schedules Canvas and WeBWorK refresh at 02:00 UTC (10:00 HKT) daily. Manually triggered runs were verified to return HTTP 200; the first automatic 10:00 runs have not yet been observed. The scheduler reads its key from Supabase Vault. If the project key is rotated, update the Vault entry as well.

## Development

Install dependencies with `npm ci`, then copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's public browser configuration. Run `npm run dev` for the app, `npm test` for domain and parser tests, and `npm run build` for a production build.

The Supabase migration in `supabase/migrations/` defines owner-only policies. Authentication, the owner record, and server-side source functions must be configured separately; a publishable key alone does not provide access to assignment data. Keep service-role keys, OAuth client secrets, and source credentials out of the repository and browser bundle.

GitHub Actions builds and deploys the site to Pages on pushes to `main`. The repository variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` supply public build configuration.
