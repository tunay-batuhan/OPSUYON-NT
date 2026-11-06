-- İzin yöneticisi (leaves.manage) imzalı izin evrakını kendisi yükleyebilsin:
-- belge yazma kuralı, 'yillik_izin' kategorisi için leaves.manage iznini de kabul eder.
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for all to authenticated
  using (
    app.has_global_permission('documents.manage')
    or (category_code = 'yillik_izin' and app.has_global_permission('leaves.manage'))
  )
  with check (
    app.has_global_permission('documents.manage')
    or (category_code = 'yillik_izin' and app.has_global_permission('leaves.manage'))
  );
