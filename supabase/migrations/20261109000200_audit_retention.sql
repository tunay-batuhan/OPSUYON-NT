-- İşlem geçmişi (9 Kasım):
--  * Giriş saati güncellemeleri (profiles.last_login_at) artık işlem geçmişine yazılmaz: denetim değeri yok, listeyi dolduruyordu.
--    Genel kural: bir UPDATE'te yalnızca "gürültü" alanları (updated_at, last_login_at) değiştiyse kayıt açılmaz.
--  * Kayıtlar 1 ay saklanır; daha eskisi her gece otomatik silinir (pg_cron yoksa İşlem geçmişi sayfası açılınca da temizlenir).

create or replace function app.audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_noise text[] := array['updated_at', 'last_login_at'];
begin
  -- yalnızca gürültü alanları değişen güncellemeler atlanır (ör. her girişte son giriş saati)
  if tg_op = 'UPDATE' and (v_old - v_noise) = (v_new - v_noise) then
    return new;
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'personnel_id', v_old ->> 'personnel_id'),
          v_old, v_new);
  return coalesce(new, old);
end;
$$;

-- ---------- 1 aydan eski işlem kayıtları silinir ----------
create or replace function public.purge_old_audit_logs()
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.audit_logs where at < now() - interval '1 month';
$$;
revoke execute on function public.purge_old_audit_logs() from public, anon, authenticated;
grant  execute on function public.purge_old_audit_logs() to service_role;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-old-audit-logs', '30 0 * * *', 'select public.purge_old_audit_logs()');
exception when others then
  raise notice 'pg_cron kurulamadı (%): uygulama tarafı yedeği kullanılacak', sqlerrm;
end $$;

-- eski giriş-saati kayıtları ve 1 aydan eskiler hemen temizlenir
delete from public.audit_logs
 where table_name = 'profiles' and action = 'UPDATE'
   and (old_data - array['updated_at', 'last_login_at']) = (new_data - array['updated_at', 'last_login_at']);
select public.purge_old_audit_logs();
