// Builds the Supabase auth email templates into emails/dist/*.html.
// Run: pnpm emails. Paste each file into Supabase: Authentication -> Emails -> Templates.
// Variables ({{ .ConfirmationURL }} etc.) are Supabase's Go template syntax, left as is.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "dist");

const sans = "Roboto, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const mono = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

export const templates = {
  confirmation: {
    subject: "Confirm your email for Sonorous Envelope",
    preheader: "One tap to finish creating your account.",
    title: "Confirm your email",
    body: [
      "Welcome. Confirm <strong>{{ .Email }}</strong> to finish creating your account, then connect your AI app and start a session.",
    ],
    button: { label: "Confirm email", url: "{{ .ConfirmationURL }}" },
    note: "The link works for one hour. If you did not sign up, you can ignore this email.",
  },
  recovery: {
    subject: "Reset your Sonorous Envelope password",
    preheader: "Choose a new password.",
    title: "Choose a new password",
    body: ["Someone asked to reset the password for <strong>{{ .Email }}</strong>. If that was you, use the button below."],
    button: { label: "Reset password", url: "{{ .ConfirmationURL }}" },
    note: "The link works for one hour. If you did not ask for this, ignore this email: your password stays as it is.",
  },
  magic_link: {
    subject: "Your Sonorous Envelope sign-in link",
    preheader: "Sign in with one tap.",
    title: "Sign in",
    body: ["Use the button below to sign in as <strong>{{ .Email }}</strong>. No password needed."],
    button: { label: "Sign in", url: "{{ .ConfirmationURL }}" },
    note: "The link works for one hour and only once. If you did not ask for it, ignore this email.",
  },
  email_change: {
    subject: "Confirm your new email address",
    preheader: "Confirm the change to your Sonorous Envelope account.",
    title: "Confirm your new email",
    body: [
      "You asked to change the email on your account from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.",
    ],
    button: { label: "Confirm new email", url: "{{ .ConfirmationURL }}" },
    note: "If you did not ask for this change, ignore this email and consider changing your password.",
  },
  reauthentication: {
    subject: "Your Sonorous Envelope code",
    preheader: "Your one-time code.",
    title: "Your code",
    body: ["Enter this code to confirm it is you. It works for one hour."],
    code: "{{ .Token }}",
    note: "If you did not ask for a code, ignore this email.",
  },
};

function render(t) {
  const button = t.button
    ? `<tr><td style="padding:8px 0 24px;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${t.button.url}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="20%" stroke="f" fillcolor="#f4a940"><w:anchorlock/><center style="color:#1a1206;font-family:sans-serif;font-size:16px;font-weight:bold;">${t.button.label}</center></v:roundrect><![endif]-->
        <!--[if !mso]><!-- --><a href="${t.button.url}" style="display:inline-block;background:#f4a940;color:#1a1206;font-family:${sans};font-size:16px;font-weight:500;line-height:48px;height:48px;padding:0 28px;border-radius:10px;text-decoration:none;">${t.button.label}</a><!--<![endif]-->
      </td></tr>
      <tr><td class="muted" style="padding:0 0 24px;font-family:${sans};font-size:13px;line-height:20px;color:#586170;">
        Button not working? Paste this link into your browser:<br>
        <a class="link" href="${t.button.url}" style="color:#0b766b;font-family:${mono};font-size:12px;word-break:break-all;">${t.button.url}</a>
      </td></tr>`
    : "";
  const code = t.code
    ? `<tr><td style="padding:8px 0 24px;">
        <div class="codebox" style="display:inline-block;background:#e9ecef;color:#12151a;font-family:${mono};font-size:28px;letter-spacing:6px;padding:12px 20px;border-radius:10px;">${t.code}</div>
      </td></tr>`
    : "";
  const paragraphs = t.body
    .map(
      (p) =>
        `<tr><td class="txt" style="padding:0 0 16px;font-family:${sans};font-size:16px;line-height:24px;color:#12151a;">${p}</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${t.subject}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .outer { background: #0c0e12 !important; }
    .card { background: #14171d !important; }
    .txt { color: #eceff3 !important; }
    .muted { color: #9ba5b2 !important; }
    .rule { border-top-color: #272c35 !important; }
    .codebox { background: #08090c !important; color: #eceff3 !important; }
    a.link { color: #45c7b6 !important; }
  }
  @media (max-width: 480px) { .pad { padding-left: 20px !important; padding-right: 20px !important; } }
</style>
</head>
<body class="outer" style="margin:0;padding:0;background:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${t.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="outer" style="background:#f3f4f6;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td style="padding:0 0 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:12px;"><img src="{{ .SiteURL }}/email/mark.png" width="36" height="36" alt="" style="display:block;border-radius:8px;"></td>
        <td class="txt" style="font-family:${mono};font-size:17px;font-weight:500;color:#12151a;">sonorous envelope</td>
      </tr></table>
    </td></tr>
    <tr><td class="card pad" style="background:#ffffff;border-radius:14px;padding:36px 36px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="txt" style="padding:0 0 16px;font-family:${sans};font-size:26px;line-height:32px;font-weight:500;color:#12151a;">${t.title}</td></tr>
        ${paragraphs}
        ${button}${code}
        <tr><td class="muted rule" style="padding:16px 0 0;border-top:1px solid #dde1e6;font-family:${sans};font-size:13px;line-height:20px;color:#586170;">${t.note}</td></tr>
      </table>
    </td></tr>
    <tr><td class="muted" style="padding:20px 8px 0;font-family:${sans};font-size:12px;line-height:18px;color:#586170;">
      Sonorous Envelope gives an AI model a sound and colour channel. You got this email because someone used this address on <a class="link" href="{{ .SiteURL }}" style="color:#0b766b;">{{ .SiteURL }}</a>.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

export function build() {
  mkdirSync(OUT, { recursive: true });
  for (const [name, t] of Object.entries(templates)) writeFileSync(join(OUT, `${name}.html`), render(t));
  return Object.keys(templates);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Wrote ${build().length} templates to emails/dist`);
}
