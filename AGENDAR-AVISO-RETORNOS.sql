-- Aviso de hora em hora dos Retornos (rode UMA vez no SQL Editor)
-- ANTES: troque COLE_AQUI_A_ANON_KEY pela sua chave anon
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
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer CeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaGNvYWphdmF5dmRmYXZkaHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODA4NjQsImV4cCI6MjA5NTc1Njg2NH0.M-GEPcreB0koTpam8jVIRHem88QyMGnYZE5eTgUq_iI'),
    body := '{"acao":"retornos"}'::jsonb
  );
  $$
);
