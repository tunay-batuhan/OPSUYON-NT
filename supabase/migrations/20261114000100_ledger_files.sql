-- Cari Hesap (14 Kasım): fatura / tahsilat kaydına dosya (fatura PDF'i ya da görseli, tahsilat dekontu).
--  * Dosya, kaydın kendisine bağlanır (tek adımda): firm_ledger_entries.file_* sütunları. Ayrı tablo yok;
--    kayıt silinince dosyası da uygulamada Storage'dan silinir.
--  * Dosyalar özel (public olmayan) 'documents' kovasında, 'ledger/{organization_id}/…' altında durur.
--    Yükleme ve indirme sunucu tarafında, kaydın okuma yetkisi (RLS) doğrulandıktan sonra imzalı adresle yapılır.
--  * Storage okuma kuralı belgelerdekinin aynısı: dosyayı yalnızca o cari kaydı görebilen okuyabilir
--    (merkez ledger.read; müşteri yalnızca kendi firmasının kaydı ve ledger.read izni varsa).
--  * Yalnızca ekleme: mevcut satırlar ve bakiyeler değişmez.

alter table public.firm_ledger_entries
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_mime text,
  add column if not exists file_size bigint;

alter table public.firm_ledger_entries
  add constraint firm_ledger_entries_file_chk check (
    (file_path is null and file_name is null and file_mime is null and file_size is null)
    or (
      file_path is not null and file_name is not null
      and file_path like 'ledger/' || organization_id::text || '/%'
      and char_length(file_name) <= 255
      and (file_size is null or (file_size > 0 and file_size <= 52428800))
    )
  );

-- bir dosya yalnızca bir kayda bağlanabilir
create unique index if not exists firm_ledger_entries_file_path_key on public.firm_ledger_entries (file_path) where file_path is not null;

-- Hareketler görünümüne dosya bilgisi eklenir (sütunlar sona eklenir; yürüyen bakiye hesabı aynı).
create or replace view public.firm_ledger_movements with (security_invoker = true) as
select
  e.id,
  e.organization_id,
  e.kind,
  e.entry_date,
  e.entry_time,
  e.description,
  e.amount,
  e.created_by,
  e.created_at,
  sum(case when e.kind = 'fatura' then e.amount else -e.amount end)
    over (partition by e.organization_id order by e.entry_date, e.entry_time, e.created_at, e.id
          rows between unbounded preceding and current row)::numeric(14,2) as running_balance,
  e.file_name,
  e.file_mime,
  e.file_size
from public.firm_ledger_entries e;

revoke all on public.firm_ledger_movements from anon, authenticated;
grant select on public.firm_ledger_movements to authenticated;

-- Storage: cari dosyasını yalnızca o kaydı (RLS ile) görebilen okuyabilir. Yazma/silme yalnızca sunucuda (service role).
drop policy if exists documents_storage_read_ledger on storage.objects;
create policy documents_storage_read_ledger on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and name like 'ledger/%'
    and exists (
      select 1 from public.firm_ledger_entries e
      where e.file_path = storage.objects.name
    )
  );
