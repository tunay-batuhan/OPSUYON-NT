-- Bordro ve maaş hesaplama (16 Kasım).
--
-- Müşterinin Excel bordrosundaki hesap (hepsi NET tutarlar, ay 30 gün sayılır):
--   çalışılan gün   = 30 − eksik gün
--   normal kazanç   = net maaş ÷ 30 × çalışılan gün
--   yol             = aylık net yol ÷ 30 × çalışılan gün
--   fazla mesai     = fazla mesai günü × günlük net fazla mesai ücreti
--   yemek kartı     = yemek günü × günlük yemek kartı ücreti
--   ek ödeme        = aylık sabit tutar
--   kazanç toplamı  = yukarıdakilerin toplamı
--   kesintiler      = avanslar (o ay, o proje) + ihbar + BES + diğer
--   net ödenen      = kazanç toplamı − kesintiler
--   yemek kartına   = yemek kartı tutarı;  bankadan = net ödenen − yemek kartı
--
-- Kim ne girer:
--   * Ücret tanımları (pay_rates: net maaş, yol, fazla mesai, yemek, ek ödeme)  → yalnızca merkez (payroll.manage).
--     Müşteri görür, değiştiremez.
--   * Avans (pay_advances)                                                       → müşteri (payroll.advances) ve merkez.
--   * Ay sonu: eksik gün, fazla mesai günü, yemek günü (payroll_lines)            → müşteri (payroll.run) ve merkez.
--   * İhbar / BES / diğer kesinti (payroll_lines)                                 → yalnızca merkez.
--   * Onay (dönemi kilitler)                                                       → payroll.run; kilidi açmak yalnızca merkez.
-- Tutarları istemci göndermez: her satır kaydedilirken veritabanı yeniden hesaplar (tetikleyici). Avans ya da ücret
-- değişince taslak dönemlerin satırları kendiliğinden yeniden hesaplanır; onaylı dönem değişmez.

-- ---------- yetkiler ----------
insert into public.permissions (code, module, description, sort_order, customer_grantable) values
  ('payroll.advances', 'personel', 'Personele verilen avansları gir / sil',                         46, true),
  ('payroll.run',      'personel', 'Aylık maaş hesapla (eksik gün, fazla mesai) ve bordroyu onayla', 47, true),
  ('payroll.manage',   'personel', 'Ücret tanımları, kesintiler ve onaylı bordronun kilidini açma',  48, false)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
  from (values
    ('manager', 'payroll.advances'), ('manager', 'payroll.run'), ('manager', 'payroll.manage'),
    ('accountant', 'payroll.read'), ('accountant', 'payroll.advances'), ('accountant', 'payroll.run'), ('accountant', 'payroll.manage'),
    ('operator', 'payroll.read'), ('operator', 'payroll.advances'), ('operator', 'payroll.run'),
    ('customer_manager', 'payroll.advances'), ('customer_manager', 'payroll.run'),
    ('customer_hr', 'payroll.advances'), ('customer_hr', 'payroll.run')
  ) as p(role_code, code)
  join public.roles r on r.code = p.role_code
on conflict do nothing;

-- ---------- ücret tanımları (personel başına) ----------
create table public.pay_rates (
  personnel_id      uuid primary key references public.personnel (id) on delete cascade,
  net_salary        numeric(12,2) not null default 0 check (net_salary >= 0),
  transport_monthly numeric(12,2) not null default 0 check (transport_monthly >= 0),
  overtime_daily    numeric(12,2) not null default 0 check (overtime_daily >= 0),
  meal_daily        numeric(12,2) not null default 0 check (meal_daily >= 0),
  meal_days         numeric(4,1)  not null default 26 check (meal_days between 0 and 31),   -- ayda kaç gün yemek kartı (eksik gün düşülür)
  extra_monthly     numeric(12,2) not null default 0 check (extra_monthly >= 0),
  extra_label       text check (char_length(extra_label) <= 60),                           -- ör. "Emekli farkı"
  updated_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);
create trigger pay_rates_updated_at before update on public.pay_rates
  for each row execute function app.set_updated_at();

-- ---------- avanslar ----------
create table public.pay_advances (
  id           uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete restrict,
  project_id   uuid not null references public.projects (id) on delete restrict,
  paid_on      date not null,
  period_year  smallint not null,
  period_month smallint not null check (period_month between 1 and 12),
  amount       numeric(12,2) not null check (amount > 0 and amount < 10000000),
  note         text check (char_length(note) <= 300),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index pay_advances_period_idx on public.pay_advances (project_id, period_year, period_month);
create index pay_advances_personnel_idx on public.pay_advances (personnel_id, paid_on desc);

-- ---------- aylık dönem (proje + ay) ----------
create table public.payroll_runs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete restrict,
  period_year  smallint not null check (period_year between 2020 and 2100),
  period_month smallint not null check (period_month between 1 and 12),
  status       text not null default 'draft' check (status in ('draft', 'approved')),
  approved_at  timestamptz,
  approved_by  uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, period_year, period_month)
);
create trigger payroll_runs_updated_at before update on public.payroll_runs
  for each row execute function app.set_updated_at();

-- ---------- personel satırları ----------
create table public.payroll_lines (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.payroll_runs (id) on delete cascade,
  personnel_id      uuid not null references public.personnel (id) on delete restrict,
  -- girilenler
  missing_days      numeric(4,1)  not null default 0 check (missing_days between 0 and 30),
  overtime_days     numeric(4,1)  not null default 0 check (overtime_days between 0 and 31),
  meal_days         numeric(4,1)  not null default 0 check (meal_days between 0 and 31),
  ihbar_deduction   numeric(12,2) not null default 0 check (ihbar_deduction >= 0),
  bes_deduction     numeric(12,2) not null default 0 check (bes_deduction >= 0),
  other_deduction   numeric(12,2) not null default 0 check (other_deduction >= 0),
  other_note        text check (char_length(other_note) <= 200),
  -- hesaplananlar (tetikleyici yazar; ücret tanımının o anki kopyası dahil)
  has_rates         boolean       not null default false,
  net_salary        numeric(12,2) not null default 0,
  transport_monthly numeric(12,2) not null default 0,
  overtime_daily    numeric(12,2) not null default 0,
  meal_daily        numeric(12,2) not null default 0,
  extra_monthly     numeric(12,2) not null default 0,
  extra_label       text,
  worked_days       numeric(4,1)  not null default 30,
  normal_pay        numeric(12,2) not null default 0,
  transport_pay     numeric(12,2) not null default 0,
  overtime_pay      numeric(12,2) not null default 0,
  meal_pay          numeric(12,2) not null default 0,
  extra_pay         numeric(12,2) not null default 0,
  earnings_total    numeric(12,2) not null default 0,
  advance_total     numeric(12,2) not null default 0,
  deductions_total  numeric(12,2) not null default 0,
  net_paid          numeric(12,2) not null default 0,
  meal_card_paid    numeric(12,2) not null default 0,
  bank_paid         numeric(12,2) not null default 0,
  updated_at        timestamptz   not null default now(),
  unique (run_id, personnel_id)
);
create index payroll_lines_personnel_idx on public.payroll_lines (personnel_id);

-- ---------- yardımcılar ----------
create or replace function app.payroll_run_permission(p_run uuid, perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select app.has_project_permission(r.project_id, perm) from public.payroll_runs r where r.id = p_run), false)
$$;

create or replace function app.payroll_period_locked(p_project uuid, p_year int, p_month int)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payroll_runs r
     where r.project_id = p_project and r.period_year = p_year and r.period_month = p_month and r.status = 'approved'
  )
$$;

-- ---------- satır hesabı ----------
create or replace function app.payroll_lines_compute()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_run  public.payroll_runs;
  v_rate public.pay_rates;
  v_has  boolean;
  v_adv  numeric(12,2);
  v_mgr  boolean := auth.uid() is null or app.has_global_permission('payroll.manage');
begin
  if tg_op = 'DELETE' then
    -- dönem silinirken (cascade) dönem satırı artık görünmez: o durumda serbest
    select * into v_run from public.payroll_runs where id = old.run_id;
    if found and v_run.status = 'approved' then
      raise exception 'Bu dönemin bordrosu onaylandı (kilitli); satır silinemez.';
    end if;
    return old;
  end if;

  select * into v_run from public.payroll_runs where id = new.run_id;
  if v_run.status = 'approved' then
    raise exception 'Bu dönemin bordrosu onaylandı (kilitli). Değişiklik için merkezden kilidin açılmasını isteyin.';
  end if;

  -- kesintileri yalnızca merkez girer
  if not v_mgr then
    if tg_op = 'INSERT' then
      if new.ihbar_deduction <> 0 or new.bes_deduction <> 0 or new.other_deduction <> 0 or new.other_note is not null then
        raise exception 'Kesintileri yalnızca merkez girebilir.';
      end if;
    elsif (new.ihbar_deduction, new.bes_deduction, new.other_deduction, new.other_note)
          is distinct from (old.ihbar_deduction, old.bes_deduction, old.other_deduction, old.other_note) then
      raise exception 'Kesintileri yalnızca merkez girebilir.';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.run_id is distinct from old.run_id or new.personnel_id is distinct from old.personnel_id) then
    raise exception 'Bordro satırının dönemi ve personeli değiştirilemez.';
  end if;

  select * into v_rate from public.pay_rates where personnel_id = new.personnel_id;
  v_has := found;

  -- eksik gün değişti ama yemek günü elle değiştirilmediyse: yemek günü = tanımdaki gün − eksik gün
  if tg_op = 'UPDATE' and new.missing_days is distinct from old.missing_days and new.meal_days is not distinct from old.meal_days then
    new.meal_days := greatest(0, coalesce(v_rate.meal_days, 26) - new.missing_days);
  end if;

  new.has_rates         := v_has;
  new.net_salary        := coalesce(v_rate.net_salary, 0);
  new.transport_monthly := coalesce(v_rate.transport_monthly, 0);
  new.overtime_daily    := coalesce(v_rate.overtime_daily, 0);
  new.meal_daily        := coalesce(v_rate.meal_daily, 0);
  new.extra_monthly     := coalesce(v_rate.extra_monthly, 0);
  new.extra_label       := v_rate.extra_label;

  new.worked_days    := greatest(0, 30 - new.missing_days);
  new.normal_pay     := round(new.net_salary / 30 * new.worked_days, 2);
  new.transport_pay  := round(new.transport_monthly / 30 * new.worked_days, 2);
  new.overtime_pay   := round(new.overtime_days * new.overtime_daily, 2);
  new.meal_pay       := round(new.meal_days * new.meal_daily, 2);
  new.extra_pay      := new.extra_monthly;
  new.earnings_total := new.normal_pay + new.transport_pay + new.overtime_pay + new.meal_pay + new.extra_pay;

  select coalesce(sum(a.amount), 0) into v_adv
    from public.pay_advances a
   where a.personnel_id = new.personnel_id and a.project_id = v_run.project_id
     and a.period_year = v_run.period_year and a.period_month = v_run.period_month;

  new.advance_total    := v_adv;
  new.deductions_total := v_adv + new.ihbar_deduction + new.bes_deduction + new.other_deduction;
  new.net_paid         := new.earnings_total - new.deductions_total;
  new.meal_card_paid   := new.meal_pay;
  new.bank_paid        := new.net_paid - new.meal_pay;
  new.updated_at       := now();
  return new;
end;
$$;
create trigger payroll_lines_compute before insert or update or delete on public.payroll_lines
  for each row execute function app.payroll_lines_compute();

-- ---------- dönem kuralları ----------
create or replace function app.payroll_runs_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      raise exception 'Onaylı bordro silinemez; önce merkezden kilidin açılmasını isteyin.';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.created_by := coalesce(new.created_by, auth.uid());
    return new;
  end if;
  if new.project_id is distinct from old.project_id or new.period_year is distinct from old.period_year or new.period_month is distinct from old.period_month then
    raise exception 'Bordro döneminin projesi ve ayı değiştirilemez.';
  end if;
  if old.status = 'approved' and new.status = 'draft' then
    if auth.uid() is not null and not app.has_global_permission('payroll.manage') then
      raise exception 'Onaylı bordronun kilidini yalnızca merkez açabilir.';
    end if;
    new.approved_at := null;
    new.approved_by := null;
  elsif old.status = 'draft' and new.status = 'approved' then
    new.approved_at := now();
    new.approved_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger payroll_runs_guard before insert or update or delete on public.payroll_runs
  for each row execute function app.payroll_runs_guard();

-- ---------- avans kuralları ----------
create or replace function app.pay_advances_before()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if app.payroll_period_locked(old.project_id, old.period_year, old.period_month) then
      raise exception 'Bu ayın bordrosu onaylandı (kilitli); avans değiştirilemez.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.period_year := extract(year from new.paid_on)::smallint;
  new.period_month := extract(month from new.paid_on)::smallint;
  if app.payroll_period_locked(new.project_id, new.period_year, new.period_month) then
    raise exception 'Bu ayın bordrosu onaylandı (kilitli); bu aya avans girilemez.';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if not exists (select 1 from public.personnel_assignments a where a.personnel_id = new.personnel_id and a.project_id = new.project_id) then
    raise exception 'Bu personel seçilen projede görevli değil.';
  end if;
  return new;
end;
$$;
create trigger pay_advances_before before insert or update or delete on public.pay_advances
  for each row execute function app.pay_advances_before();

-- avans ya da ücret değişince taslak dönemin satırı yeniden hesaplanır (dokunmak yeterli: hesap tetikleyicide)
create or replace function app.payroll_touch(p_personnel uuid, p_project uuid, p_year int, p_month int)
returns void
language sql security definer
set search_path = ''
as $$
  update public.payroll_lines l
     set updated_at = now()
    from public.payroll_runs pr
   where pr.id = l.run_id and pr.status = 'draft'
     and pr.project_id = p_project and pr.period_year = p_year and pr.period_month = p_month
     and l.personnel_id = p_personnel
$$;
revoke execute on function app.payroll_touch(uuid, uuid, int, int) from public, anon, authenticated;

create or replace function app.pay_advances_after()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform app.payroll_touch(old.personnel_id, old.project_id, old.period_year, old.period_month);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform app.payroll_touch(new.personnel_id, new.project_id, new.period_year, new.period_month);
  end if;
  return null;
end;
$$;
create trigger pay_advances_after after insert or update or delete on public.pay_advances
  for each row execute function app.pay_advances_after();

create or replace function app.pay_rates_after()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.payroll_lines l
     set updated_at = now()
    from public.payroll_runs pr
   where pr.id = l.run_id and pr.status = 'draft' and l.personnel_id = new.personnel_id;
  return null;
end;
$$;
create trigger pay_rates_after after insert or update on public.pay_rates
  for each row execute function app.pay_rates_after();

-- ---------- erişim ----------
alter table public.pay_rates     enable row level security;
alter table public.pay_advances  enable row level security;
alter table public.payroll_runs  enable row level security;
alter table public.payroll_lines enable row level security;

create policy pay_rates_read on public.pay_rates for select to authenticated
  using (app.can_access_personnel(personnel_id, 'payroll.read'));
create policy pay_rates_write on public.pay_rates for all to authenticated
  using (app.has_global_permission('payroll.manage')) with check (app.has_global_permission('payroll.manage'));

create policy pay_advances_read on public.pay_advances for select to authenticated
  using (app.has_project_permission(project_id, 'payroll.read') or app.has_project_permission(project_id, 'payroll.advances'));
create policy pay_advances_write on public.pay_advances for all to authenticated
  using (app.has_project_permission(project_id, 'payroll.advances'))
  with check (app.has_project_permission(project_id, 'payroll.advances'));

create policy payroll_runs_read on public.payroll_runs for select to authenticated
  using (app.has_project_permission(project_id, 'payroll.read') or app.has_project_permission(project_id, 'payroll.run'));
create policy payroll_runs_write on public.payroll_runs for all to authenticated
  using (app.has_project_permission(project_id, 'payroll.run'))
  with check (app.has_project_permission(project_id, 'payroll.run'));

create policy payroll_lines_read on public.payroll_lines for select to authenticated
  using (app.payroll_run_permission(run_id, 'payroll.read') or app.payroll_run_permission(run_id, 'payroll.run'));
create policy payroll_lines_write on public.payroll_lines for all to authenticated
  using (app.payroll_run_permission(run_id, 'payroll.run'))
  with check (app.payroll_run_permission(run_id, 'payroll.run'));

-- ---------- işlem geçmişi ----------
create trigger audit_pay_rates after insert or update or delete on public.pay_rates
  for each row execute function app.audit_row();
create trigger audit_pay_advances after insert or update or delete on public.pay_advances
  for each row execute function app.audit_row();
create trigger audit_payroll_runs after insert or update or delete on public.payroll_runs
  for each row execute function app.audit_row();
