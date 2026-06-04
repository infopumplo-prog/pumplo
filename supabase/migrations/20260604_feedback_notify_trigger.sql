-- Notify the super-admin (David) by email when a user submits app feedback.
-- Reuses the generic notify_message_push() trigger fn -> pg_net -> send-message-push,
-- which routes table='user_feedback' to handleFeedback (emails SUPER_ADMIN_EMAIL).

drop trigger if exists trg_user_feedback_notify on public.user_feedback;
create trigger trg_user_feedback_notify
  after insert on public.user_feedback
  for each row execute function public.notify_message_push();
