# Auth Verification

This app includes an internal-only auth diagnostics page at `/admin/auth` for
`SITE_ADMIN` and `HR_ADMIN` users. It is designed to help verify Microsoft Entra
SSO and development-login hardening without exposing any secret values.

## What To Check On `/admin/auth`

- `Microsoft 365 provider enabled` should be `Yes` in environments where Entra SSO is expected.
- `Dev credentials enabled` should be `No` in production after cutover.
- Entra config rows should show required values as configured by presence only.
- `Parsed issuer tenant ID` should match the expected Entra tenant.
- `Client ID looks like api:// URI` should be `No`.
- `Expected callback URL` should match the redirect URI registered in Microsoft Entra.

## Verification Checklist

1. Valid employee Microsoft login
- Sign in with a Microsoft Entra account whose email matches an active `Employee`.
- Confirm sign-in succeeds and the app loads normally.

2. Valid Entra user not in employee DB
- Sign in with a real tenant user that does not have a matching `Employee`.
- Confirm sign-in is rejected.

3. Inactive employee
- Sign in with a tenant user mapped to an inactive `Employee`.
- Confirm sign-in is rejected.

4. Tenant mismatch
- Point a non-production environment at the wrong tenant or test with a mismatched `tid`.
- Confirm sign-in is rejected.

5. Dev auth disabled verification
- Confirm `/admin/auth` shows `Dev credentials enabled = No`.
- Confirm the login page no longer shows the dev credentials form.

6. Session payload verification
- After a successful Microsoft sign-in, confirm the app session still resolves an `employeeId`.
- Confirm no raw Microsoft access token, refresh token, or `id_token` is exposed in the client session.

## Notes

- Redirect URI for local development:
  - `http://localhost:3000/api/auth/callback/microsoft-entra-id`
- Redirect URI for production:
  - `https://your-app.example.com/api/auth/callback/microsoft-entra-id`
- `AUTH_MICROSOFT_ENTRA_ID_ID` must be the Entra Application (client) ID GUID, not the `api://...` Application ID URI.
