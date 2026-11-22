-- CATÁLOGO DA BLACK (capinhas e cordinhas) — separado da Negociação
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

-- 1) Produtos (capinhas e cordinhas)
create table if not exists public.black_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'capa' check (tipo in ('capa', 'cordinha')),
  preco numeric not null default 0,
  preco_promo numeric,                     -- preço da Black (aparece riscado o normal)
  fotos text[] not null default '{}',
  modelos text[] not null default '{}',    -- celulares em que a capinha serve (cordinha = todos)
  descricao text,
  no_site boolean not null default true,
  lancamento boolean not null default true,
  destaque boolean not null default false, -- "Mais vendidos"
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- 2) Modelos de celular do filtro "Qual é o seu celular?"
create table if not exists public.black_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  marca text,
  ordem int not null default 0
);

-- 3) Vídeos ("Descubra cada detalhe em vídeo")
create table if not exists public.black_videos (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  capa_url text,
  produto_id uuid references public.black_produtos(id) on delete set null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- 4) Aparência (textos da abertura, seções, WhatsApp...)
create table if not exists public.black_config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb
);
insert into public.black_config (id) values (1) on conflict (id) do nothing;

-- 5) Permissões: o site da Black só LÊ; o Admin (logado) faz tudo
alter table public.black_produtos enable row level security;
alter table public.black_modelos enable row level security;
alter table public.black_videos enable row level security;
alter table public.black_config enable row level security;

drop policy if exists "site_le" on public.black_produtos;
create policy "site_le" on public.black_produtos for select to anon using (no_site);
drop policy if exists "equipe_tudo" on public.black_produtos;
create policy "equipe_tudo" on public.black_produtos for all to authenticated using (true) with check (true);

drop policy if exists "site_le" on public.black_modelos;
create policy "site_le" on public.black_modelos for select to anon using (true);
drop policy if exists "equipe_tudo" on public.black_modelos;
create policy "equipe_tudo" on public.black_modelos for all to authenticated using (true) with check (true);

drop policy if exists "site_le" on public.black_videos;
create policy "site_le" on public.black_videos for select to anon using (true);
drop policy if exists "equipe_tudo" on public.black_videos;
create policy "equipe_tudo" on public.black_videos for all to authenticated using (true) with check (true);

drop policy if exists "site_le" on public.black_config;
create policy "site_le" on public.black_config for select to anon using (true);
drop policy if exists "equipe_tudo" on public.black_config;
create policy "equipe_tudo" on public.black_config for all to authenticated using (true) with check (true);

-- 6) Modelos iniciais: iPhone 11 ao 18 Pro Max, sem 11 Pro e 11 Pro Max (dá pra mudar em Admin → Capas → Modelos)
insert into public.black_modelos (nome, marca, ordem) values
  ('iPhone 11', 'Apple', 1),
  ('iPhone 12 mini', 'Apple', 2),
  ('iPhone 12', 'Apple', 3),
  ('iPhone 12 Pro', 'Apple', 4),
  ('iPhone 12 Pro Max', 'Apple', 5),
  ('iPhone 13 mini', 'Apple', 6),
  ('iPhone 13', 'Apple', 7),
  ('iPhone 13 Pro', 'Apple', 8),
  ('iPhone 13 Pro Max', 'Apple', 9),
  ('iPhone 14', 'Apple', 10),
  ('iPhone 14 Plus', 'Apple', 11),
  ('iPhone 14 Pro', 'Apple', 12),
  ('iPhone 14 Pro Max', 'Apple', 13),
  ('iPhone 15', 'Apple', 14),
  ('iPhone 15 Plus', 'Apple', 15),
  ('iPhone 15 Pro', 'Apple', 16),
  ('iPhone 15 Pro Max', 'Apple', 17),
  ('iPhone 16e', 'Apple', 18),
  ('iPhone 16', 'Apple', 19),
  ('iPhone 16 Plus', 'Apple', 20),
  ('iPhone 16 Pro', 'Apple', 21),
  ('iPhone 16 Pro Max', 'Apple', 22),
  ('iPhone 17e', 'Apple', 23),
  ('iPhone 17', 'Apple', 24),
  ('iPhone Air', 'Apple', 25),
  ('iPhone 17 Pro', 'Apple', 26),
  ('iPhone 17 Pro Max', 'Apple', 27),
  ('iPhone 18 Pro', 'Apple', 28),
  ('iPhone 18 Pro Max', 'Apple', 29)
on conflict (nome) do nothing;

-- 7) APAGAR O CADASTRO ANTIGO DA ABA CAPAS (modelos e fotos de capinha antigos)
-- Atenção: a página /capas e as capinhas que apareciam na Negociação ficam vazias.
delete from public.capas_fotos;
delete from public.capas_modelos;
