-- 18 Kasım (müşteri isteği): fazla mesai ve yemek kartı AYLIK net tutar olarak tanımlanır; aylık yemek günü kalkar.
-- Önceden: fazla mesai = günlük tutar × fazla mesai günü, yemek kartı = günlük tutar × yemek günü.
--   fazla mesai = aylık net fazla mesai ÷ 30 × çalışılan gün
--   yemek kartı = aylık net yemek kartı ÷ 30 × çalışılan gün      (net maaş ve yol ile aynı: eksik gün düşülür)
-- Eski sütunlar (overtime_daily, overtime_days, meal_daily, meal_days) geçiş için durur ve hesaba eklenmeye devam
-- eder; yeni ekranlar günlük tutarları 0 bırakır (bu tarihte hiçbir ücret tanımında fazla mesai / yemek tutarı yoktu).

alter table public.pay_rates
  add column if not exists overtime_monthly numeric(12,2) not null default 0 check (overtime_monthly >= 0);
alter table public.pay_rates
  add column if not exists meal_monthly numeric(12,2) not null default 0 check (meal_monthly >= 0);
alter table public.payroll_lines
  add column if not exists overtime_monthly numeric(12,2) not null default 0,
  add column if not exists meal_monthly numeric(12,2) not null default 0;

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
  new.overtime_monthly  := coalesce(v_rate.overtime_monthly, 0);
  new.meal_daily        := coalesce(v_rate.meal_daily, 0);
  new.meal_monthly      := coalesce(v_rate.meal_monthly, 0);
  new.extra_monthly     := coalesce(v_rate.extra_monthly, 0);
  new.extra_label       := v_rate.extra_label;

  new.worked_days    := greatest(0, 30 - new.missing_days);
  new.normal_pay     := round(new.net_salary / 30 * new.worked_days, 2);
  new.transport_pay  := round(new.transport_monthly / 30 * new.worked_days, 2);
  new.overtime_pay   := round(new.overtime_monthly / 30 * new.worked_days, 2) + round(new.overtime_days * new.overtime_daily, 2);
  new.meal_pay       := round(new.meal_monthly / 30 * new.worked_days, 2) + round(new.meal_days * new.meal_daily, 2);
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

