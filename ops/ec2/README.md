# EC2 host

The small EC2 host serves the Vite build through Caddy and runs the Deadline browser connector as an unprivileged service. Its browser profile contains private sessions, stays on encrypted storage, and must not be committed or copied into logs. The graphical desktop listens only on loopback; temporary SSH tunnels are used for interactive sign-in.

`deadline-update.timer` fetches the public repository every 15 minutes and runs `update.sh` for fast-forward changes. The script rebuilds the static site and restarts the connector only when extension files change. `/etc/deadline/build.env` contains only the Supabase URL and publishable key. Calendar and WeBWorK additionally retain their existing Supabase cron as a fallback. Zinc and the ChatGPT report depend on their browser sessions remaining signed in; check for expiry rather than assuming a scheduled run succeeded.

The HTTPS hostname is currently based on the instance's public IPv4 address. Stopping and starting the instance can change that address and requires updating Caddy and the Supabase redirect URL. Keep SSH restricted and do not expose VNC publicly.
