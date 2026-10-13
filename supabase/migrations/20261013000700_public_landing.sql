-- =====================================================================
-- OPSUYON  |  07 · Public landing data
-- The home page lists the active service lines as login buttons, before
-- anyone is signed in. This is public marketing information only.
-- =====================================================================
grant select on public.service_lines to anon;

create policy service_lines_public_read on public.service_lines for select to anon
  using (is_active);
