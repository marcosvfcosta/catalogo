-- CATÁLOGO DA BLACK · ZERAR TUDO
-- Apaga produtos, vídeos, fotos "experimentar" e modelos da Black, volta a Aparência pro padrão
-- e deixa os modelos de iPhone 11 ao 18 Pro Max (sem 11 Pro e 11 Pro Max).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- Não mexe no catálogo de celulares nem na Negociação.

do $$
begin
  if to_regclass('public.black_vestidas') is not null then delete from public.black_vestidas; end if;
end $$;
delete from public.black_videos;
delete from public.black_produtos;
delete from public.black_modelos;
update public.black_config set dados = '{}'::jsonb where id = 1;

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
