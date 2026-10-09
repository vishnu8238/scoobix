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

- Portal Preview Mode (src/lib/preview-mode.ts) activates only when its flag is on AND the host is the dev server, localhost or a Lovable editor preview host (published/custom domains fail closed); it blocks all insforge-crud writes; why: lets portals be inspected unauthenticated without weakening production auth.
