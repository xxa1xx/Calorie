# CalorieAI Security Notes

## Implemented controls

- Supabase authentication tokens are verified server-side before AI functions run.
- Anthropic and Supabase service-role keys remain server-side.
- User tables use Supabase row-level security.
- AI endpoints enforce per-user daily limits and strict request-size validation.
- AI responses are normalized before being returned to the browser.
- Food drafts expire after 24 hours and local caches are cleared on sign-out.
- Email HTML escapes user-entered content and app links require HTTPS.
- Production headers block framing, MIME sniffing, inline JavaScript, insecure requests, and unnecessary browser permissions.
- CI runs deterministic installs, a production build, and a high-severity production dependency audit.
- Dependabot checks npm and GitHub Actions dependencies weekly.

## Required Supabase migrations

Run these in order after the earlier schemas:

1. `supabase/schema-v9.sql`
2. `supabase/schema-v10.sql`
3. `supabase/schema-v11.sql`

`schema-v11.sql` restricts the AI usage RPC to authenticated users and enforces fixed server-side maximums.

## Manual deployment checks

These settings cannot be enforced from application source alone:

- Keep email confirmation enabled in Supabase Auth.
- Review Supabase password rules, CAPTCHA, redirect allowlist, and auth rate limits.
- Confirm the service-role key exists only in server-side Netlify environment variables.
- Enable GitHub secret scanning and push protection in repository settings when available.
- Set `PUBLIC_APP_URL` to the production HTTPS origin.
- Verify deployed response headers after each major Netlify configuration change.
- Rotate any credential that was ever committed to Git history or shared outside the intended secret store.
