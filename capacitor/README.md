# Scoobix — multi-application architecture

Scoobix ships as **four independent applications on one shared InsForge backend**.
There is no portal switcher: each app owns a route scope, its own login, its own
navigation, its own manifest/launcher identity and its own deep links.

| App | Role | Scope | Application ID | Manifest | Deep link |
| --- | --- | --- | --- | --- | --- |
| Scoobix (Customer) | `customer` | `/app` | `app.scoobix.customer` | `/manifest-customer.webmanifest` | `scoobix://` · `https://scoobix.app` |
| Scoobix Partner | `partner` (`restaurant` in DB) | `/partner` | `app.scoobix.partner` | `/manifest-partner.webmanifest` | `scoobix-partner://` · `https://partner.scoobix.app` |
| Scoobix Rider | `rider` (`driver` in DB) | `/rider` | `app.scoobix.rider` | `/manifest-rider.webmanifest` | `scoobix-rider://` · `https://rider.scoobix.app` |
| Scoobix Admin | `admin` | `/admin` | `app.scoobix.admin` | `/manifest-admin.webmanifest` | browser dashboard only |

Source of truth: `src/lib/apps.ts`.

## Isolation rules

- `RoleGuard` wraps every layout route (`app.tsx`, `partner.tsx`, `rider.tsx`, `admin.tsx`).
  - Anonymous → `/auth/login?app=<id>&redirect=<href>`.
  - Wrong role → redirected to that role's own home. Cross-app navigation is impossible.
- `/auth/login` never asks for a role; the destination comes from `public.users.role`.
- The old `/portal` picker, `RoleSwitch` pill and admin "Switch role" link are deleted.

## Native builds

Configs live in `capacitor/*.config.ts`. Each targets the same web build with a
different `appId`, app name, icon set and deep-link host:

```bash
bun run build
npx cap sync --config capacitor/customer.config.ts
npx cap sync --config capacitor/partner.config.ts
npx cap sync --config capacitor/rider.config.ts
```

Launcher icons: drop per-app assets into `android/<app>/app/src/main/res/` (and
`ios/<app>/App/Assets.xcassets`). Placeholders currently reuse the Scoobix mark.

Each native shell should open on its own scope (`/app`, `/partner`, `/rider`) so
the splash screen leads directly into that app's login.
