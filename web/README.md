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

Configure environment variables (same as `.env`) in the backend **Environment** section. See `apphosting.yaml`.

## Data model

- Collection **`trips`**: `name`, `shareCode`, `createdAt`
- Subcollection **`trips/{tripId}/travelers`**: `displayName`, `homeAirport`, `adults`, `children`, `cabinClass`, `createdAt`
