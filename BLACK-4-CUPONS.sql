-- Cupons de desconto da Black. Rode UMA vez no Supabase → SQL Editor → New query → Run.
create table if not exists public.black_cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  pct numeric not null check (pct > 0 and pct <= 100),
  limite int,              -- quantas pessoas podem usar (vazio = sem limite)
  inicio timestamptz,      -- a partir de quando vale (vazio = já vale)
  fim timestamptz,         -- até quando vale (vazio = sem data)
  usos int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.black_cupons enable row level security;
drop policy if exists "equipe_tudo" on public.black_cupons;
create policy "equipe_tudo" on public.black_cupons for all to authenticated using (true) with check (true);
-- o site NÃO enxerga a lista de cupons: só pergunta se um código vale (e gasta 1 uso ao finalizar)

create or replace function public.black_cupom(p_codigo text, p_usar boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare c public.black_cupons;
begin
  select * into c from public.black_cupons where upper(codigo) = upper(trim(p_codigo)) limit 1;
  if not found then return json_build_object('ok', false, 'motivo', 'invalido'); end if;
  if c.inicio is not null and c.inicio > now() then return json_build_object('ok', false, 'motivo', 'ainda_nao'); end if;
  if (c.fim is not null and c.fim < now()) or (c.limite is not null and c.usos >= c.limite) then
    return json_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if p_usar then
    update public.black_cupons set usos = usos + 1
      where id = c.id and (limite is null or usos < limite);
    if not found then return json_build_object('ok', false, 'motivo', 'expirado'); end if;
  end if;
  return json_build_object('ok', true, 'codigo', c.codigo, 'pct', c.pct);
end $$;
grant execute on function public.black_cupom(text, boolean) to anon, authenticated;
