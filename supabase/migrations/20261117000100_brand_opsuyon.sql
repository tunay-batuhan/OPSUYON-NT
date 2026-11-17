-- 17 Kasım: marka yazımı OPSUYON (Ü'süz). Uygulama metinleri kodda (src/lib/brand.ts); veritabanında yalnızca
-- yardım asistanı modülünün adı ve açıklaması marka adını içeriyor.
update public.app_modules
   set name = replace(replace(name, 'Opsüyon', 'Opsuyon'), 'OPSÜYON', 'OPSUYON'),
       description = replace(replace(description, 'Opsüyon', 'Opsuyon'), 'OPSÜYON', 'OPSUYON')
 where name ~* 'ops[üÜ]yon' or description ~* 'ops[üÜ]yon';
