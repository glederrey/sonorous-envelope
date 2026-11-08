# Auth emails

Supabase sends these: sign-up confirmation, password reset, magic link, email change and the re-authentication code. Their HTML lives in `emails/dist/`, built from `emails/build.mjs`.

## Install or update them in Supabase

Authentication -> Emails -> Templates. For each row, set the subject and paste the file:

| Supabase template | Subject | File |
|---|---|---|
| Confirm sign up | Confirm your email for Sonorous Envelope | `emails/dist/confirmation.html` |
| Reset password | Reset your Sonorous Envelope password | `emails/dist/recovery.html` |
| Magic link | Your Sonorous Envelope sign-in link | `emails/dist/magic_link.html` |
| Change email address | Confirm your new email address | `emails/dist/email_change.html` |
| Reauthentication | Your Sonorous Envelope code | `emails/dist/reauthentication.html` |

Not used: "Invite user" (nobody is invited).

Templates are not part of `supabase db push`, so a change here needs a manual paste.

## Change a template

Edit `emails/build.mjs`, run `pnpm emails`, commit the changed files in `emails/dist/`, then paste them into Supabase. A test (`emails/templates.test.ts`) fails if `dist/` is out of date or a template uses a variable Supabase does not provide.

## Notes

- The logo is `apps/web/public/email/mark.png`, loaded from `{{ .SiteURL }}/email/mark.png`. It shows once the Site URL is the live domain and a release has deployed the file.
- Layout is tables with inline styles, which email clients need. A dark variant applies where the client supports `prefers-color-scheme`.
- Sender and SMTP are set in Supabase (Authentication -> Emails -> SMTP Settings). See [hosting-and-auth.md](hosting-and-auth.md).
