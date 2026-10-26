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
