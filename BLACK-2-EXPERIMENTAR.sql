-- CATÁLOGO DA BLACK · parte 2: "Experimentar no meu celular"
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.black_vestidas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.black_produtos(id) on delete cascade,
  modelo text not null,
  cor text not null,
  url text not null,
  criado_em timestamptz not null default now(),
  unique (produto_id, modelo, cor)
);

alter table public.black_vestidas enable row level security;
drop policy if exists "site_le" on public.black_vestidas;
create policy "site_le" on public.black_vestidas for select to anon using (true);
drop policy if exists "equipe_tudo" on public.black_vestidas;
create policy "equipe_tudo" on public.black_vestidas for all to authenticated using (true) with check (true);
