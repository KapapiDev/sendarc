# Google OAuth configuration

SendArc uses Google's installed-app OAuth 2.0 Authorization Code flow with PKCE in the system browser. The desktop app listens on an ephemeral `127.0.0.1` loopback port, validates a cryptographically random state value, exchanges the code with the PKCE verifier, and stores the resulting tokens through Windows Credential Manager.

## Scope contract

The initial beta must request exactly:

`https://www.googleapis.com/auth/gmail.send`

Do not add `gmail.compose`, `gmail.modify`, `mail.google.com`, mailbox-read, OpenID profile/email, contacts, or calendar scopes. Because profile scopes are intentionally absent, the desktop UI may identify the connection generically as a Google account rather than displaying the account's email address.

The user-facing transport calls Gmail `users.messages.send` only after a local preview and explicit Send action. It does not create a Gmail draft.

## Dedicated Google Cloud setup

Use a dedicated Google Cloud project and credentials for SendArc. Do not reuse go-mapi or another product's OAuth client.

1. Create/select a Google Cloud project named SendArc.
2. Enable the Gmail API.
3. Configure OAuth branding as **SendArc**.
4. Use operator **장형진**, support/developer contact `maxtop9843@gmail.com`, and the deployed SendArc privacy/terms links.
5. Configure only the exact `gmail.send` scope above.
6. Create an OAuth client with application type **Desktop app**.
7. While the app remains in Testing, allow only controlled test accounts. Do not call the OAuth configuration production-ready until its publication/verification state and real-account flow are proven.

A custom `SendArc.app` domain is deliberately deferred and must not block local/test OAuth work. When a production domain is later purchased and connected, update authorized-domain and policy URLs as required without broadening the scope.

## Local development values

Copy `.env.local.example` to the gitignored `.env.local` file:

```dotenv
SENDARC_OAUTH_CLIENT_ID=...
SENDARC_OAUTH_CLIENT_SECRET=...
```

Release automation receives the same names through protected secrets and injects them at link time. Never commit values, echo them, upload them as debug artifacts, or include them in screenshots.

Google Desktop-app client secrets cannot be treated as confidential once embedded in a distributed binary. Security depends on PKCE, exact redirect/state validation, Google client controls, and least privilege—not on hiding the desktop client secret from an installed user.

## Redirect and authorization behavior

- Bind only `127.0.0.1`, never `0.0.0.0` or a LAN address.
- Use an ephemeral port and `http://127.0.0.1:<port>/callback`.
- Use a five-minute flow timeout.
- Generate a fresh 32-byte random state value for every attempt.
- Use `S256` PKCE.
- Reject missing/mismatched state, missing code, OAuth error callbacks, and callbacks after cancellation/timeout.
- Request offline access so a refresh token can support later explicit sends.
- Open the user's default system browser without shell-concatenating the URL.

Do not instruct general users to bypass an unverified-app warning. Controlled testers may follow the consent flow only when the Google page identifies the app as SendArc and the test account was intentionally authorized.

## Token lifecycle

- Credential Manager service: `SendArc`.
- Credential Manager account: `oauth-tokens`.
- Store access/refresh token JSON only in the OS credential store.
- Refresh shortly before expiry under a single synchronization boundary.
- Clear memory and Credential Manager state on explicit disconnect, `invalid_grant`, or a refresh state that cannot recover.
- Never write tokens to queue files, logs, analytics, issues, screenshots, workflow output, or release artifacts.

## Verification gate

Unit tests are necessary but not enough. Before launch, preserve evidence that:

- the actual authorization URL contains only `gmail.send`;
- fresh sign-in, refresh, disconnect/reconnect, cancel, timeout, state mismatch, and invalid-grant recovery work;
- consent branding and policy links are SendArc-specific;
- a sanitized message is absent from Gmail before Send;
- the message appears in Gmail Sent only after Send;
- no request carrying message content reaches SendArc or Cloudflare infrastructure.

The current external-console and real-account status is recorded in [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md); absence of evidence there means the gate is not complete.
