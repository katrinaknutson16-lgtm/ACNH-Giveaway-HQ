# ACNH Giveaway HQ — cloud edition

A mobile-friendly installable web app with private accounts, cloud sync, multiple groups, calendars, giveaway tracking, winner statuses and calendar alert exports. Supports iPhone, Android and desktop browsers.

## Free-tier deployment

1. Create a Supabase project at https://supabase.com. Open **SQL Editor**, paste `schema.sql`, and run it. The SQL enables row-level security for both tables.
2. Under **Authentication > Providers**, enable Email. Google login is optional: to enable it, configure Google's OAuth client in Supabase, following Supabase's Google provider instructions. Until configured, the Google button will not work.
3. Under **Authentication > URL Configuration**, set the published site URL as Site URL and add it to allowed redirect URLs. For email confirmation and password reset, configure the email delivery settings appropriate to your use; free-tier default email delivery is rate-limited.
4. In Supabase **Project Settings > API**, copy the project URL and public **publishable / anon key** into `config.js`. NEVER paste a service-role key or secret key.
5. Publish this folder using a static host (for example, Netlify's free tier or GitHub Pages). The root file must be `index.html`. Use HTTPS. The site owner's setup screen disappears after config is filled.
6. Sign up and confirm email if required. Use **Load my starter groups** for the owner's blue and purple groups. Every other account starts with no groups and its own private calendar.
7. On iPhone, open the published URL in Safari and use Share > Add to Home Screen. On Android, open in Chrome and choose Install app / Add to Home screen.

## Important limits

- The site does **not** come with a Supabase project or published URL; you must complete the above steps for cloud sync to work.
- Users' data is stored in Supabase with row-level security, not shared with other accounts. Users must keep passwords private.
- Cloud sync needs an internet connection; offline editing is not implemented. A cached shell is not a guarantee of offline use.
- The app does not send push notifications. **Export alerts** creates an ICS file for manual import into a phone calendar. Imports do not automatically update after edits.
- The current version does not include recurring-event generation or automatic imports from ChatGPT. Enter or update real giveaway closing times.
- Hosting, Supabase and email delivery have free-tier limits and can change.
- This starter project has not been tested against a live Supabase deployment. Test signup, Google OAuth (if enabled), cross-device sync, and data isolation before sharing publicly.
