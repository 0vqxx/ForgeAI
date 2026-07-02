# OAuth Provider Setup Instructions

There are **two places** where redirect URLs need to be configured — the OAuth provider's developer console, and the Supabase dashboard. They use different URLs.

---

## URL Reference

| Where | URL |
|---|---|
| Discord Developer Portal → Redirects | `https://wjqvembqrmoegagbdllu.supabase.co/auth/v1/callback` |
| Google Cloud Console → Authorized redirect URIs | `https://wjqvembqrmoegagbdllu.supabase.co/auth/v1/callback` |
| Supabase Dashboard → Auth → URL Configuration → Redirect URLs | `https://forgeaiweb.vercel.app/api/auth/callback/google` |
| Supabase Dashboard → Auth → URL Configuration → Redirect URLs | `https://forgeaiweb.vercel.app/api/auth/callback/discord` |
| Supabase Dashboard → Auth → URL Configuration → Site URL | `https://forgeaiweb.vercel.app` |

---

## Enable Google OAuth in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Click **Google** → toggle **Enable Sign in with Google** ON
3. Paste your credentials (from [Google Cloud Console](https://console.cloud.google.com)):
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
4. Click Save

## Enable Discord OAuth in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Click **Discord** → toggle **Enable Sign in with Discord** ON
3. Paste your credentials (from [Discord Developer Portal](https://discord.com/developers)):
   - **Client ID**: `YOUR_DISCORD_CLIENT_ID`
   - **Client Secret**: `YOUR_DISCORD_CLIENT_SECRET`
4. Click Save

---

## Supabase Redirect URL Allowlist

In Supabase Dashboard → Authentication → URL Configuration, add **both** of these to the **Redirect URLs** list:

```
https://forgeaiweb.vercel.app/api/auth/callback/google
https://forgeaiweb.vercel.app/api/auth/callback/discord
```

Also make sure **Site URL** is set to:

```
https://forgeaiweb.vercel.app
```

---

## Google Cloud Console setup

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth client:

Under **Authorized redirect URIs**, add:

```
https://wjqvembqrmoegagbdllu.supabase.co/auth/v1/callback
```

---

## Discord Developer Portal setup

In [Discord Developer Portal](https://discord.com/developers/applications) → your app → OAuth2:

Under **Redirects**, add:

```
https://wjqvembqrmoegagbdllu.supabase.co/auth/v1/callback
```

---

## How the flow works

1. User clicks "Continue with Google/Discord"
2. App calls `supabase.auth.signInWithOAuth` with `redirectTo: https://forgeaiweb.vercel.app/api/auth/callback/{provider}`
3. Supabase redirects the user to Google/Discord, passing its own callback URL (`wjqvembqrmoegagbdllu.supabase.co/auth/v1/callback`) as the return target
4. After the user approves, Google/Discord redirects to Supabase's callback
5. Supabase processes the token, then redirects to your app's callback (`/api/auth/callback/google` or `/api/auth/callback/discord`) with a `code` param
6. The callback page calls `supabase.auth.exchangeCodeForSession(code)` to write the session to localStorage
7. User is redirected to `/dashboard` and is now authenticated

---

## Troubleshooting "Failed to create conversation"

This error appears when the API call to create a conversation returns a 401 (unauthorized). The most common cause is the OAuth callback page not calling `exchangeCodeForSession` — meaning the session was never saved and the Bearer token is empty. This has been fixed in the callback routes.

If the error persists after OAuth sign-in, open the browser console and check:
- `supabase.auth.getSession()` returns a valid session
- The `/api/conversations` POST request includes an `Authorization: Bearer <token>` header
