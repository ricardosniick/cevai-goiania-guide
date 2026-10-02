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
- Category taxonomy (groups, subcategories, Google types, criteria) lives in src/lib/categories.ts and is shared by client and server; why: one source for filters, labels and Places requests.
- Presence is written only by the `startPresence` server function after verifying category and distance against Google place data; social reads/writes go through SECURITY DEFINER RPCs that call `cleanup_presence()`. Why: clients can't fake check-ins and chats vanish with presence.
- Drizzle migration history starts fresh after the remix; tables created before it already exist in the database. Why: copied migrations didn't match the new database.
- "Situação agora" is written only by the `postSituation` server function after a Google-verified geofence check (10-min rate limit per user/place) and read via `place_situation_now()`; rows persist after 2h expiry for history. Why: clients cannot fake on-site reports. Situation sets live in `src/lib/categories.ts` (`SITUATION_OPTIONS`, `situationKind`).
