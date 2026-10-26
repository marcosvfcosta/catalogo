-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- Pode rodar de novo sem problema.

-- 1) Cor de cada foto do produto (bolinhas do catálogo trocam a foto)
alter table public.produtos_catalogo add column if not exists foto_cor text;
alter table public.produto_fotos add column if not exists cor text;

-- 2) Fotos que o cliente manda na avaliação do usado
alter table public.entradas add column if not exists fotos jsonb;

-- 3) Pasta (bucket) "entradas" para as fotos dos clientes
insert into storage.buckets (id, name, public)
values ('entradas', 'entradas', true)
on conflict (id) do nothing;

-- Cliente (sem login) só pode ENVIAR foto nessa pasta; não pode apagar nem trocar
do $$
begin
  drop policy if exists "cliente_envia_fotos_entrada" on storage.objects;
  create policy "cliente_envia_fotos_entrada" on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'entradas');
exception when others then
  raise notice 'Política do storage não criada: %', sqlerrm;
end $$;

-- 4) Aviso em tempo real na Negociação quando chega avaliação nova
do $$
begin
  alter publication supabase_realtime add table public.entradas;
exception when others then
  raise notice 'Tempo real: %', sqlerrm;
end $$;

-- 5) Notificações push (tela apagada)
alter table public.entradas add column if not exists notificado boolean not null default false;

create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  email text,
  aparelho text,
  created_at timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
drop policy if exists "equipe_tudo" on public.push_inscricoes;
create policy "equipe_tudo" on public.push_inscricoes for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- 6) Preço com promoção (riscado) e "mostrar preço no catálogo"
alter table public.produtos_catalogo add column if not exists preco numeric;
alter table public.produtos_catalogo add column if not exists preco_antigo numeric;
alter table public.produtos_catalogo add column if not exists mostrar_preco boolean not null default false;

-- 7) Busca de acessório pelo modelo do celular
alter table public.produtos_catalogo add column if not exists tipo text;          -- capa, pelicula, carregador, cabo, fone
alter table public.produtos_catalogo add column if not exists compativel text[];  -- modelos (capas/películas)
alter table public.produtos_catalogo add column if not exists conector text;      -- USB-C, Lightning, Bluetooth
alter table public.capas_modelos add column if not exists entrada text;           -- USB-C ou Lightning

-- 8) Retornos: clientes para chamar de novo depois de X dias
create table if not exists public.catalogo_retornos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  modelo text not null,
  modelo_id text,
  intervalo_dias int not null default 30,
  proximo_contato date not null default (current_date + 30),
  ultimo_contato timestamptz,
  contatos int not null default 0,
  aceita boolean not null default true,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.catalogo_retornos enable row level security;
drop policy if exists "equipe_tudo" on public.catalogo_retornos;
create policy "equipe_tudo" on public.catalogo_retornos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- 9) Desconto (%) com validade curta nos Retornos
alter table public.catalogo_retornos add column if not exists desconto_pct numeric;
alter table public.catalogo_retornos add column if not exists desconto_validade date;
alter table public.catalogo_retornos add column if not exists desconto_usado_em timestamptz;

-- 10) Tabela de troca (quanto vale cada aparelho na troca) — editável na Negociação
create table if not exists public.catalogo_tabela_troca (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  gb text,
  cor text,
  bateria text,
  valor numeric,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.catalogo_tabela_troca enable row level security;
drop policy if exists "equipe_tudo" on public.catalogo_tabela_troca;
create policy "equipe_tudo" on public.catalogo_tabela_troca for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- Preenche com a tabela atual (só se estiver vazia, pra não duplicar)
insert into public.catalogo_tabela_troca (modelo, gb, cor, bateria, valor, ordem)
select * from (values
    ('iPhone 11', '128GB', 'Branca', '80%', 1100, 1),
    ('iPhone 11', '128GB', 'Preto', '90%', 1300, 2),
    ('iPhone 13', '128GB', 'Rosa', '80% a 85%', 1500, 3),
    ('iPhone 13', '128GB', 'Azul / Preto', '80% a 85%', 1600, 4),
    ('iPhone 13 Pro', '128GB', 'Qualquer cor', '80% a 85%', 2000, 5),
    ('iPhone 13 Pro Max', '128GB', 'Azul / Preto', '80% a 85%', 2100, 6),
    ('iPhone 14', '128GB', 'Azul / Preto', '80% a 85%', 1800, 7),
    ('iPhone 14', '128GB', 'Branco', '80% a 85%', 1900, 8),
    ('iPhone 14 Pro', '128GB', 'Todas as cores', '80% a 85%', 2500, 9),
    ('iPhone 14 Pro Max', '128GB', 'Todas as cores', '80% a 85%', 2700, 10),
    ('iPhone 15', '128GB', 'Todas as cores', '80% a 85%', 2300, 11),
    ('iPhone 15', '128GB', 'Todas as cores', '85% a 90%', 2600, 12),
    ('iPhone 15', '128GB', 'Todas as cores', '90% ou mais', 2800, 13),
    ('iPhone 15 Pro', '128GB', 'Todas as cores', '80% a 85%', 2900, 14),
    ('iPhone 15 Pro', '128GB', 'Todas as cores', '85% a 90%', 3400, 15),
    ('iPhone 15 Pro', '128GB', 'Todas as cores', '90% ou mais', 3600, 16),
    ('iPhone 15 Pro Max', '256GB', 'Todas as cores', '80% a 85%', 3700, 17),
    ('iPhone 15 Pro Max', '256GB', 'Todas as cores', '85% a 90%', 3800, 18),
    ('iPhone 15 Pro Max', '256GB', 'Todas as cores', '90% ou mais', 3900, 19),
    ('iPhone 16', '128GB', 'Todas as cores', '85% a 90%', 3300, 20),
    ('iPhone 16', '128GB', 'Todas as cores', '90% ou mais', 3400, 21),
    ('iPhone 16', '256GB', 'Todas as cores', '85% a 90%', 3400, 22),
    ('iPhone 16', '256GB', 'Todas as cores', '90% ou mais', 3500, 23),
    ('iPhone 16 Pro', '128GB', 'Todas as cores', '80% a 85%', 3600, 24),
    ('iPhone 16 Pro', '128GB', 'Todas as cores', '85% a 90%', 3700, 25),
    ('iPhone 16 Pro', '128GB', 'Todas as cores', '90% ou mais', 3800, 26),
    ('iPhone 16 Pro', '256GB', 'Todas as cores', '80% a 85%', 3900, 27),
    ('iPhone 16 Pro', '256GB', 'Todas as cores', '85% a 90%', 4000, 28),
    ('iPhone 16 Pro', '256GB', 'Todas as cores', '90% ou mais', 4100, 29),
    ('iPhone 16 Pro Max', '256GB', 'Todas as cores', '80% a 85%', 3900, 30),
    ('iPhone 16 Pro Max', '256GB', 'Todas as cores', '85% a 90%', 4100, 31),
    ('iPhone 16 Pro Max', '256GB', 'Todas as cores', '90% ou mais', 4200, 32),
    ('iPhone 17', '256GB', 'Todas as cores', '90% ou mais', null, 33),
    ('iPhone 17 Pro Max', '256GB', 'Todas as cores', '90% ou mais', 6000, 34)
) as t(modelo, gb, cor, bateria, valor, ordem)
where not exists (select 1 from public.catalogo_tabela_troca);

-- 11) O que o cliente comprou por último (Retornos)
alter table public.catalogo_retornos add column if not exists ultima_compra text;
alter table public.catalogo_retornos add column if not exists ultima_compra_em date;
