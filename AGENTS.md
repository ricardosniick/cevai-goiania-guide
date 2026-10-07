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
- Social features (presence "Estou aqui", people list, connections, chat, blocking/reporting people) are disabled in this version: UI removed, `startPresence` throws via `PRESENCE_DISABLED`, and migration 0009 revokes EXECUTE on their RPCs and writes on place_presence/user_blocks/user_reports from anon/authenticated; tables, data and code are kept. Why: ship without social risk while allowing a later return by re-granting and re-mounting the panel.
- Drizzle migration history starts fresh after the remix; tables created before it already exist in the database. Why: copied migrations didn't match the new database.
- "Situação agora" is written only by the `postSituation` server function after a Google-verified geofence check (10-min rate limit per user/place) and read via `place_situation_now()`; rows persist after 2h expiry for history. Why: clients cannot fake on-site reports. Situation sets live in `src/lib/categories.ts` (`SITUATION_OPTIONS`, `situationKind`).
- Only server functions write `public.places`, always with Google-sourced data (`ensurePlace` before user content references a place); why: clients could overwrite place data for everyone.
- Per-user limits on Google-calling server functions go through `hit_rate_limit()` (advisory-locked SQL, service_role only) via `rateLimit()` in places.functions.ts; why: atomic under concurrent requests and keeps Google costs bounded.
- Place photos are stored as Google photo names (`places.photo_name`) and turned into URLs on display via `resolvePlacePhotos`; `photo_url` is a deprecated fallback for older rows. Why: Google photo URLs expire.
- Splitting of src/routes/index.tsx is paused after step 7B-4: shared pieces live in src/components/cevai/ (types.ts, manage-context.ts, shared.tsx, Logo, BooksPanel, StallsPanel) and src/hooks/ (usePlaces, useExperiences); the remaining screens stay in index.tsx until the user resumes it, and extracted modules must never import from @/routes/index. Why: avoid circular imports and keep the refactor reviewable step by step.
- Categories can be hidden with `hidden: true` in src/lib/categories.ts (kept in code); UI, "Destaques" types and filters use ACTIVE_GROUPS/activeSubs, and free-text search drops hidden-only places via `RESTRICT_TEXT_TO_ACTIVE` in places.functions.ts. Why: focus on leisure while allowing reactivation; existing experiences in hidden categories still display.
