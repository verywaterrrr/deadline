# Deadline

A personal deadline dashboard with a calendar, schedule, overdue and completed lists, and manually added assignments. The site is a static Vite app; assignments and preferences are stored in Supabase behind owner-only row-level security.

## Current source coverage

- Manual assignments and checklist changes are stored in Supabase.
- The WeBWorK importer is deployed and manual refresh has been verified. It reads the public schedule for MATH1013 and only sees sets currently listed as open. Previously imported entries are retained.
- Canvas imports dated assignments from the private calendar feed. Some feed entries supply only a date; their exact due time is unavailable. The feed has a limited historical range and does not include undated assignments.
- The installed Zinc connector in `extension/` reads COMP1023 jobs through an existing signed-in Chrome session and sends normalized deadlines to the signed-in dashboard. A live manual refresh has been verified. The connector needs Chrome and the Mac to be running; a missed alarm during sleep runs when the Mac wakes. An expired Zinc or dashboard session requires signing in again. It does not upload Zinc cookies or university credentials.
- Supabase Cron schedules Canvas and WeBWorK refresh at 02:00 UTC (10:00 HKT) daily. Manually triggered runs were verified to return HTTP 200; the first automatic 10:00 runs have not yet been observed. The scheduler reads its key from Supabase Vault. If the project key is rotated, update the Vault entry as well.

## Development

Install dependencies with `npm ci`, then copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's public browser configuration. Run `npm run dev` for the app, `npm test` for domain and parser tests, and `npm run build` for a production build.

The Supabase migration in `supabase/migrations/` defines owner-only policies. Authentication, the owner record, and server-side source functions must be configured separately; a publishable key alone does not provide access to assignment data. Keep service-role keys, OAuth client secrets, and source credentials out of the repository and browser bundle.

GitHub Actions builds and deploys the site to Pages on pushes to `main`. The repository variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` supply public build configuration.

### Zinc connector setup

After applying `supabase/migrations/202611160002_zinc_import.sql`, load the local `extension` directory as an unpacked extension in Chrome. Refresh the Zinc and Deadline tabs after installation, sign in to both if prompted, and use the dashboard refresh button. The connector reads only the COMP1023 assessment and job endpoints; it does not copy browser credentials. The dashboard validates and imports normalized job records under the signed-in owner's identity. Zinc checks cannot run while Chrome is closed or the computer is powered off.
