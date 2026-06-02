-- Push notifications on new messages.
-- AFTER INSERT on gym_messages / direct_messages -> pg_net POST to the
-- `send-message-push` Edge Function, which resolves the recipient and sends FCM.
--
-- PREREQUISITE (applied manually via Management API, NOT in this file to avoid
-- committing the secret): a Vault secret named 'message_push_bearer' holding the
-- CRON_SECRET value the Edge Function checks. The trigger reads it from Vault.

create or replace function public.notify_message_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'message_push_bearer'
  limit 1;

  -- Not configured yet -> do nothing (never block the insert).
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/send-message-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'row_id', NEW.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_gym_messages_push on public.gym_messages;
create trigger trg_gym_messages_push
  after insert on public.gym_messages
  for each row execute function public.notify_message_push();

drop trigger if exists trg_direct_messages_push on public.direct_messages;
create trigger trg_direct_messages_push
  after insert on public.direct_messages
  for each row execute function public.notify_message_push();
