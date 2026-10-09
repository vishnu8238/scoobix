<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Portal Preview Mode (src/lib/preview-mode.ts) is dev-server-only (import.meta.env.DEV && VITE_ENABLE_PORTAL_PREVIEW_MODE) and blocks all insforge-crud writes; why: lets portals be inspected unauthenticated without ever weakening production auth.
