-- CATÁLOGO DA BLACK · parte 3: foto dos modelos, filtros (Público, Estilo, Função, Cor) e rascunhos
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

-- Foto de cada modelo de celular (aparece no "Qual é o seu iPhone?")
alter table public.black_modelos add column if not exists foto_url text;

-- Produtos: filtros marcados e rascunho (foto subida em lote, ainda sem preencher)
alter table public.black_produtos add column if not exists filtros text[] not null default '{}';
alter table public.black_produtos add column if not exists rascunho boolean not null default false;

-- Opções de filtro
create table if not exists public.black_filtros (
  id uuid primary key default gen_random_uuid(),
  grupo text not null check (grupo in ('publico', 'estilo', 'funcao', 'cor')),
  nome text not null,
  cor_hex text,
  ordem int not null default 0,
  unique (grupo, nome)
);
alter table public.black_filtros enable row level security;
drop policy if exists "site_le" on public.black_filtros;
create policy "site_le" on public.black_filtros for select to anon using (true);
drop policy if exists "equipe_tudo" on public.black_filtros;
create policy "equipe_tudo" on public.black_filtros for all to authenticated using (true) with check (true);

insert into public.black_filtros (grupo, nome, cor_hex, ordem) values
  ('publico', 'Feminina', null, 1), ('publico', 'Masculina', null, 2), ('publico', 'Unissex', null, 3),
  ('estilo', 'Com brilho', null, 1), ('estilo', 'Transparente', null, 2), ('estilo', 'Colorida', null, 3),
  ('estilo', 'Fosca', null, 4), ('estilo', 'Estampada', null, 5), ('estilo', 'Couro', null, 6),
  ('funcao', 'MagSafe', null, 1), ('funcao', 'Anti-impacto', null, 2), ('funcao', 'Com alça', null, 3), ('funcao', 'Com cordinha', null, 4),
  ('cor', 'Preto', '#1d1d1f', 1), ('cor', 'Branco', '#f4f3ef', 2), ('cor', 'Rosa', '#f2b8c6', 3), ('cor', 'Azul', '#8fb3e0', 4),
  ('cor', 'Lilás', '#c9b6f2', 5), ('cor', 'Verde', '#a9c3a4', 6), ('cor', 'Dourado', '#d7ae62', 7), ('cor', 'Vermelho', '#d94141', 8)
on conflict (grupo, nome) do nothing;
