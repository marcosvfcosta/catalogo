-- Aviso de hora em hora dos Retornos (rode UMA vez no SQL Editor)
-- ANTES: troque sb_publishable__ufxNgI5l4WBTgWf5Hw2iQ_ABeGecHx pela sua chave anon
--        (é a mesma do VITE_SUPABASE_ANON_KEY do arquivo .env — essa chave é pública, sem problema)

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('retornos-de-hora-em-hora');
exception when others then null;
end $$;

-- Roda todo dia, de hora em hora. A função só avisa no horário da loja
-- (seg–sex 9h–18h, sáb 9h–12h) e só se tiver cliente para chamar.
select cron.schedule(
  'retornos-de-hora-em-hora',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://bahcoajavayvdfavdhpg.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer COLE_AQUI_A_ANON_KEY'),
    body := '{"acao":"retornos"}'::jsonb
  );
  $$
);
