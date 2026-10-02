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

- Keep the mobile experience as a single state-driven route; this preserves app-like transitions without unnecessary URL changes.
- Store experiences, photos and saved places in the backend per user (private by default); real place data comes only from Google Places via authenticated server functions — never fabricate places or use AI images for real venues.
