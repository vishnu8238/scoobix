GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;
GRANT SELECT ON public.portal_access TO anon, authenticated;
GRANT ALL ON public.portal_access TO service_role;