# System Design — Authentication Feature

**Version:** 1.0  
**Date:** March 24, 2026  
**Status:** Proposed  
**Depends on:** System Design v1.0, Feature Change v2.0

---

## 1. Overview

The current application requires users to manually paste a raw Twistlock Bearer token into every session. This enhancement introduces a **login screen** where the user provides their Twistlock username and password. The application exchanges those credentials for an access token via the Twistlock `/api/v1/authenticate` endpoint, stores the token in the client's session state, and uses it for all subsequent Twistlock API calls.

If the token expires (HTTP 401 from any Twistlock call), the user is redirected back to the login screen to re-authenticate.

### Goals

- Replace manual token pasting with a standard username/password login flow
- Obtain and manage the Twistlock access token automatically
- Detect expired tokens and prompt re-authentication
- Keep the token in client-side state only — no server-side session storage

### Non-Goals

- Token refresh / renewal (Twistlock tokens are short-lived; re-login is acceptable)
- Persistent sessions across browser tabs or page reloads
- Role-based access control within the application

---

## 2. Authentication Flow

### 2.1 Sequence Diagram

```
Browser                          Next.js API Route              Twistlock API
  │                                    │                              │
  │  POST /api/auth/login              │                              │
  │  { username, password }            │                              │
  │ ──────────────────────────────►    │                              │
  │                                    │  POST /api/v1/authenticate   │
  │                                    │  { username, password }      │
  │                                    │  ─────────────────────────►  │
  │                                    │                              │
  │                                    │  200 { token: "eyJ..." }     │
  │                                    │  ◄─────────────────────────  │
  │                                    │                              │
  │  200 { token: "eyJ..." }           │                              │
  │ ◄──────────────────────────────    │                              │
  │                                    │                              │
  │  (stores token in React state)     │                              │
  │                                    │                              │
  │  POST /api/search-images           │                              │
  │  { ..., twistlockToken }           │                              │
  │ ──────────────────────────────►    │                              │
  │                                    │  GET /api/v1/registry        │
  │                                    │  Authorization: Bearer ...   │
  │                                    │  ─────────────────────────►  │
  │                                    │                              │
  │                                    │  401 Unauthorized            │
  │                                    │  ◄─────────────────────────  │
  │                                    │                              │
  │  401 { error: "..." }              │                              │
  │ ◄──────────────────────────────    │                              │
  │                                    │                              │
  │  (clears token, shows login)       │                              │
```

### 2.2 State Machine

```
┌──────────┐     login success      ┌───────────────┐
│          │ ──────────────────────► │               │
│  LOGIN   │                        │  AUTHENTICATED │
│          │ ◄────────────────────── │               │
└──────────┘     401 / logout        └───────────────┘
```

---

## 3. Backend Changes

### 3.1 New API Route: `POST /api/auth/login`

**File:** `app/api/auth/login/route.ts`

Proxies the user's credentials to the Twistlock authenticate endpoint. The credential exchange happens entirely server-side — the Twistlock base URL is never exposed to the browser.

**Request:**

```json
{
  "username": "john.doe",
  "password": "s3cret"
}
```

**Processing:**

1. Validate input (both fields required)
2. `POST` to `{TWISTLOCK_BASE_URL}/api/v1/authenticate` with `{ username, password }`
3. On success: return the token to the client
4. On failure: return an appropriate error

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error responses:**

| Status | Condition |
|---|---|
| 400 | Missing username or password |
| 401 | Invalid credentials (Twistlock returned 401) |
| 500 | Unexpected error |

### 3.2 New Lib Function: `authenticate()`

**File:** `lib/twistlock.ts`

```typescript
export async function authenticate(
  username: string,
  password: string
): Promise<string>
```

- Sends `POST /api/v1/authenticate` with `{ username, password }` to the Twistlock API
- Returns the access token string on success
- Throws `TwistlockError(401, ...)` on bad credentials

### 3.3 Existing API Routes — Token Expiry Handling

No changes to `/api/search-images` or `/api/generate-report`. They already:
- Accept `twistlockToken` in the request body
- Return HTTP 401 when Twistlock rejects the token

The **frontend** is responsible for detecting 401 responses and redirecting the user back to the login screen.

---

## 4. Frontend Changes

### 4.1 New Validator: `loginFormSchema`

**File:** `lib/validators.ts`

```typescript
export const loginFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
```

### 4.2 New Component: `LoginForm.tsx`

**File:** `components/LoginForm.tsx`

A simple login form with username and password fields + "Log In" button.

```
┌─────────────────────────────────┐
│  Container Scan Report Generator│
│                                 │
│  Log in with your Twistlock     │
│  credentials to get started.    │
│                                 │
│  Username  [________________]   │
│  Password  [________________]   │
│                                 │
│  [Log In]                       │
└─────────────────────────────────┘
```

**Behavior:**

- On submit: `POST /api/auth/login` with `{ username, password }`
- On success: calls `onLogin(token)` callback to pass the token to the parent
- On failure: shows error banner (e.g., "Invalid username or password.")
- Loading state: button shows "Logging in…" and inputs are disabled

### 4.3 Updated Component: `ReportForm.tsx`

The `twistlockToken` field is removed from the search form. Instead, `ReportForm` receives the token as a prop:

```typescript
interface ReportFormProps {
  token: string;
  onSessionExpired: () => void;
}
```

- All API calls use the `token` prop instead of a form field value
- If any API call returns HTTP 401, calls `onSessionExpired()` to redirect to login

### 4.4 Updated Page: `app/page.tsx`

The page manages authentication state and conditionally renders either the login form or the report form:

```typescript
const [token, setToken] = useState<string | null>(null);

if (!token) {
  return <LoginForm onLogin={setToken} />;
}

return <ReportForm token={token} onSessionExpired={() => setToken(null)} />;
```

### 4.5 Updated Validator: `searchFormSchema`

The `twistlockToken` field is removed from the search form schema since the token now comes from the auth state, not from user input.

```typescript
export const searchFormSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  tpm: z.string().optional(),
});
```

---

## 5. Data Flow

```
User opens app
      │
      ▼
App state: token = null → render LoginForm
      │
      ▼
User enters username + password, clicks "Log In"
      │
      ▼
POST /api/auth/login { username, password }
      │
      ▼
Server: POST Twistlock /api/v1/authenticate
      │
      ▼
Server returns { token } → App state: token = "eyJ..."
      │
      ▼
App renders ReportForm (token passed as prop)
      │
      ▼
User searches repos / generates reports (token sent in each API call)
      │
      ▼
If any API call returns 401:
  → App state: token = null → render LoginForm
  → Banner: "Session expired. Please log in again."
```

---

## 6. UX Considerations

### 6.1 Login Screen

- Clean, centered card layout matching the existing app style
- Subtitle explains what credentials to use: "Log in with your Twistlock credentials"
- Password field is masked
- Error banner appears above the form on bad credentials
- No "Remember me" — tokens are intentionally ephemeral

### 6.2 Session Expiry

- When a 401 is detected, the app immediately shows the login form
- An info/error banner explains: "Your session has expired. Please log in again."
- The user's unsaved selections (project name, checked repos) are lost — this is acceptable given the simplicity of re-entering them

### 6.3 Logout

- A subtle "Log out" link appears in the report form header
- Clicking it clears the token and returns to the login screen
- No server-side session to invalidate — simply discards the client-side token

---

## 7. File Changes Summary

| File | Action | Description |
|---|---|---|
| `lib/twistlock.ts` | **Modify** | Add `authenticate()` function |
| `lib/validators.ts` | **Modify** | Add `loginFormSchema`; remove `twistlockToken` from `searchFormSchema` |
| `app/api/auth/login/route.ts` | **New** | Login endpoint proxying credentials to Twistlock |
| `components/LoginForm.tsx` | **New** | Username/password login form |
| `components/ReportForm.tsx` | **Modify** | Accept `token` prop; remove token field; handle 401 → session expired |
| `app/page.tsx` | **Modify** | Manage auth state; conditionally render LoginForm or ReportForm |

---

## 8. Security Considerations

- **Credentials are never stored.** Username and password are sent once to the server, forwarded to Twistlock, and immediately discarded. They are not logged or persisted.
- **Token lives only in React state.** The access token is held in component state (memory) — not in localStorage, sessionStorage, or cookies. It disappears on page refresh or tab close.
- **Server-side credential exchange.** The Twistlock base URL and authentication endpoint are never exposed to the browser. All credential exchange happens through the Next.js API route.
- **No token in URLs.** The token is always sent in POST request bodies, never as a query parameter.
- **HTTPS only.** All traffic between the browser, the Next.js server, and the Twistlock API is over HTTPS.
- **Short-lived tokens.** Twistlock tokens have a built-in expiry. The app does not attempt to extend or refresh them — it simply asks the user to log in again.

---

## 9. Future Enhancements

- **Token expiry detection via JWT decode.** Parse the JWT `exp` claim client-side to proactively warn the user before the token expires, rather than waiting for a 401.
- **Session persistence.** Optionally store the token in an encrypted HTTP-only cookie to survive page reloads (requires careful CSRF protection).
- **SSO integration.** Support organizational single sign-on via SAML/OIDC if the Twistlock instance supports it.
