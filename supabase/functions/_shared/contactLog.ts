// contact_log (F1 e-maily, 19. 10. 2026): každý kontakt napříč kanály, aby šel
// držet strop „1 kontakt za pražský den“. Zápis i čtení jsou best-effort:
// chyba (např. tabulka ještě neexistuje) nikdy neshodí push ani e-mail.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ContactChannel = 'push' | 'email' | 'in_app';

export async function logContact(supabase: Db, userId: string, channel: ContactChannel, type: string): Promise<void> {
  try {
    const { error } = await supabase.from('contact_log').insert({ user_id: userId, channel, type });
    if (error) console.error('contact_log insert failed', channel, type, error.message);
  } catch (e) {
    console.error('contact_log insert threw', e);
  }
}

/** Odešel uživateli od sinceIso e-mail? Chyba čtení = false (push raději pošli). */
export async function hadEmailSince(supabase: Db, userId: string, sinceIso: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('contact_log')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'email')
      .gte('sent_at', sinceIso)
      .limit(1);
    if (error) {
      console.error('contact_log read failed', error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.error('contact_log read threw', e);
    return false;
  }
}
