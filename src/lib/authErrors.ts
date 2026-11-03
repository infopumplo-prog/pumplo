// Překlad chyb GoTrue signUpu na hlášky, kterým uživatel rozumí a umí na ně
// zareagovat. Anglická serverová hláška ("Password is known to be weak…") by
// běžnému členovi posilovny neřekla, co má udělat jinak.
//
// Server má zapnutou kontrolu proti uniklým heslům (HaveIBeenPwned) — běžná
// hesla typu „heslo123" odmítá s error_code `weak_password`, i když projdou
// klientskou kontrolou délky. Přesně tahle situace 2. 8. 2026 vypadala jako
// „rozbitá registrace": server heslo tiše odmítl a appka chybu schovala.

import { tr } from '@/lib/uiLocale';

interface SignUpErrorLike {
  code?: string;
  message: string;
}

export const signUpErrorMessage = (error: SignUpErrorLike): string => {
  if (error.code === 'weak_password' || error.message.includes('known to be weak')) {
    return tr('auth_errors.weak_password');
  }
  if (error.code === 'user_already_exists' || error.message.includes('User already registered')) {
    return tr('auth_errors.user_exists');
  }
  if (error.message.includes('Password should be at least')) {
    return tr('auth_errors.password_too_short');
  }
  if (error.code === 'validation_failed' && error.message.toLowerCase().includes('email')) {
    return tr('auth_errors.invalid_email');
  }
  if (error.code === 'over_request_rate_limit' || error.message.includes('rate limit')) {
    return tr('auth_errors.rate_limit');
  }
  return error.message;
};
