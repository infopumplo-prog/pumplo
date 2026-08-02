// Překlad chyb GoTrue signUpu na hlášky, kterým uživatel rozumí a umí na ně
// zareagovat. Anglická serverová hláška ("Password is known to be weak…") by
// běžnému členovi posilovny neřekla, co má udělat jinak.
//
// Server má zapnutou kontrolu proti uniklým heslům (HaveIBeenPwned) — běžná
// hesla typu „heslo123" odmítá s error_code `weak_password`, i když projdou
// klientskou kontrolou délky. Přesně tahle situace 2. 8. 2026 vypadala jako
// „rozbitá registrace": server heslo tiše odmítl a appka chybu schovala.

interface SignUpErrorLike {
  code?: string;
  message: string;
}

export const signUpErrorMessage = (error: SignUpErrorLike): string => {
  if (error.code === 'weak_password' || error.message.includes('known to be weak')) {
    return 'Toto heslo je příliš běžné a objevilo se v databázích uniklých hesel. Zvol prosím jiné — pomůže delší heslo nebo přidání číslic a znaků.';
  }
  if (error.code === 'user_already_exists' || error.message.includes('User already registered')) {
    return 'Uživatel s tímto emailem již existuje';
  }
  if (error.message.includes('Password should be at least')) {
    return 'Heslo musí mít alespoň 6 znaků';
  }
  if (error.code === 'validation_failed' && error.message.toLowerCase().includes('email')) {
    return 'Zadej prosím platnou emailovou adresu';
  }
  if (error.code === 'over_request_rate_limit' || error.message.includes('rate limit')) {
    return 'Příliš mnoho pokusů — počkej prosím chvíli a zkus to znovu.';
  }
  return error.message;
};
