# Making FinBud an app

FinBud is already a **responsive, installable PWA**. Here are the three ways to ship it as
"an app," from least to most effort — pick based on how native you need it to feel.

## Option A — PWA (available today, zero extra build)

The app ships a web manifest (`public/manifest.webmanifest`) and icon, so on phones and
desktops users can **"Add to Home Screen" / "Install"** and get a standalone, full-screen
app with its own icon — no app store required.

To strengthen it:
- Add a **service worker** for offline shell + caching (e.g. `next-pwa`, or a hand-written
  SW registered in the root layout). Cache the app shell and last-viewed data.
- Add an **install prompt** (`beforeinstallprompt`) with a friendly "Install FinBud" button.
- Maskable icons at 192/512 px (PNG) for crisper Android icons.

**Best when:** you want an app-like experience fast and don't need the App Store / native
device APIs yet.

## Option B — Capacitor wrapper (App Store + Play Store, reuses 100% of this app)

[Capacitor](https://capacitorjs.com) wraps the existing web app in a native iOS/Android
shell you can submit to the stores — no rewrite. Because FinBud uses **Server Components +
Server Actions** (not a static export), point the native shell at your **deployed URL**
(a native window around the live PWA), which keeps all server logic intact:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init FinBud app.finbud --web-dir=public
```

```ts
// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.finbud",
  appName: "FinBud",
  webDir: "public",
  server: { url: "https://your-finbud-deployment.com", cleartext: false },
};
export default config;
```

```bash
npx cap add ios && npx cap add android
npx cap open ios      # build/submit in Xcode
npx cap open android  # build/submit in Android Studio
```

Add native niceties via Capacitor plugins: **Push notifications** (budget alerts, "you're
close to your dining budget"), **Biometric lock** (Face ID / fingerprint before opening),
**Haptics** on achievements. Plaid Link and SnapTrade's portal work inside the webview.

**Best when:** you need store presence and some native APIs, but want one codebase.

## Option C — Native client (Expo / React Native) against a FinBud API

For a fully native feel (native navigation, offline-first, best performance), build a
separate **Expo/React Native** client that talks to FinBud over JSON. You'd expose the
existing server logic as **API route handlers** (`app/api/*`) — the domain logic in
`src/lib/*` (budget math, categorization, gamification) is already pure and reusable, so
the backend is largely done; you're building a new presentation layer.

**Best when:** mobile is the primary surface and you want the most polished native UX.

---

### Recommendation

Ship **Option A** now (it's already here), reach for **Option B (Capacitor)** when you want
the App Store — it's the highest ROI because it reuses this entire app — and consider
**Option C** only if a first-class native experience becomes the priority.
