-- Débito automático en plantillas (Netflix, iCloud, etc.)

alter table public.expense_templates
  add column if not exists auto_debit boolean not null default false;
