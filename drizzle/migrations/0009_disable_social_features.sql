-- Social features (presence, connections, chat, people blocking/reporting) are disabled in this version.
-- Additive and reversible: no tables or data are dropped; re-GRANT to restore.
REVOKE EXECUTE ON FUNCTION public.send_chat_message(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_messages_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_connection(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_connection(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_connections(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_people_v2(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_people(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.end_presence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_presence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_presence(uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
-- Direct table writes for the same features (RLS allowed owners to write their own rows).
REVOKE INSERT, UPDATE, DELETE ON public.place_presence FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_blocks FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_reports FROM anon, authenticated;
COMMENT ON TABLE public.place_presence IS 'Social feature disabled in this version (writes revoked); data kept for a future return.';
COMMENT ON TABLE public.user_blocks IS 'Social feature disabled in this version (writes revoked); data kept for a future return.';
COMMENT ON TABLE public.user_reports IS 'Social feature disabled in this version (writes revoked); data kept for a future return.';