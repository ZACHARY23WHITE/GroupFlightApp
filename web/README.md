# Group flight planner (Next.js)

Trips and travelers live in **Cloud Firestore** (via **Firebase Admin** on the server). There is no local SQLite database.

## Setup

1. Create a Firebase project and enable **Firestore** (Native mode).
2. **Project settings → Service accounts → Generate new private key.** Copy into `web/.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (full key; in `.env` you can use `\n` for line breaks)
3. Copy `.env.example` → `.env` and add `SERPAPI_API_KEY` if you want live flight prices (otherwise the app uses demo data).
4. Deploy Firestore rules (deny all direct client access; the app uses Admin SDK only). **Do not use `npm install -g`** unless you fix global npm permissions — use the project copy instead:

   ```bash
   cd web
   npm install
   npx firebase login
   npx firebase use --add
   npm run deploy:firestore
   ```

   (`deploy:firestore` runs from `web/` where `firebase.json` lives.)

5. **Dev:** `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Deploy (Firebase App Hosting)

In [Firebase Console](https://console.firebase.google.com/) → **App Hosting**, connect your Git repo.

**Root directory must be `web`** (Settings → Deployment). The repository root only has `README` / `.gitignore`; `package.json` is inside `web/`. If root is `/`, the build fails with an opaque error (e.g. Docker step exit **21**).

Configure environment variables in the backend **Environment** section.

**Important:** Every variable row must have a **Value** *or* a **Secret** linked. If the name is saved but the value/secret is missing, delete that row — otherwise the build fails with **`Invalid apphosting.yaml`** / *“either 'value' or 'secret' field is required”*. In Cloud Build logs, the **preparer** step prints `Final app hosting schema`: if you see `FIREBASE_PROJECT_ID` (or any custom key) with **no** `value:` or `secret:` line under it, that row is broken in the Console.

**`SERPAPI_API_KEY` and the same error:** If the log shows `SERPAPI_API_KEY` with only `source: Firebase Console` and **no** `value:` or `secret:`, the Console row is invalid (common if you picked **Secret** / Secret Manager but did not finish linking an existing secret, or the value never saved). **Fix:** delete **`SERPAPI_API_KEY`**, save, then add it again using **plain value** (paste the SerpAPI key in the value field and confirm it saved). Only use the **Secret** option if you have already created a secret in Google Cloud Secret Manager and you fully select it in the form. Variables set in the Console **override** `apphosting.yaml`, so a broken Console row cannot be fixed by editing the repo alone — you must delete or correct that row.

**App Hosting and the Admin SDK:** Firebase injects **`FIREBASE_CONFIG`** (includes `projectId`) at build and runtime. The server uses **Application Default Credentials** on App Hosting, so you typically **do not** need `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, or `FIREBASE_PRIVATE_KEY` in the Console — and leaving them as empty placeholders causes the error above. Remove those three unless you intentionally use explicit service-account env vars. Add **`SERPAPI_API_KEY`** only if you want live flight prices, using a **saved** plain value or a **fully linked** secret as above.

`next.config.ts` uses **`output: 'standalone'`**, which Firebase App Hosting / Cloud Run expects for Next.js.

If a rollout still fails, open **Google Cloud Console → Cloud Build → History**, click the failed build, and search the log for **`error`** / **`ERR!`**.

## Data model

- Collection **`trips`**: `name`, `shareCode`, `createdAt`
- Subcollection **`trips/{tripId}/travelers`**: `displayName`, `homeAirport`, `adults`, `children`, `cabinClass`, `createdAt`
