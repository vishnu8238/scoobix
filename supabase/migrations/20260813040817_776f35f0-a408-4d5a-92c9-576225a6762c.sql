-- Revoke execution from public and authenticated to satisfy linter warnings 0028 and 0029
-- RLS policies execute as the table owner/superuser, so they can still call the function.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
