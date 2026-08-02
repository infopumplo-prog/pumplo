import { describe, it, expect } from 'vitest';
import { signUpErrorMessage } from './authErrors';

describe('signUpErrorMessage', () => {
  // Bug z 2. 8. 2026: server s HIBP kontrolou odmítá běžná hesla a jeho
  // anglická hláška uživateli nic neřekla (a spinner ji navíc schoval).
  it('přeloží odmítnutí uniklého hesla (HIBP)', () => {
    const msg = signUpErrorMessage({
      code: 'weak_password',
      message: 'Password is known to be weak and easy to guess, please choose a different one.',
    });
    expect(msg).toContain('uniklých hesel');
    expect(msg).toContain('Zvol prosím jiné');
  });

  it('pozná weak_password i bez kódu, jen podle textu', () => {
    expect(signUpErrorMessage({ message: 'Password is known to be weak and easy to guess' }))
      .toContain('uniklých hesel');
  });

  it('přeloží existující účet', () => {
    expect(signUpErrorMessage({ code: 'user_already_exists', message: 'User already registered' }))
      .toBe('Uživatel s tímto emailem již existuje');
  });

  it('přeloží krátké heslo', () => {
    expect(signUpErrorMessage({ message: 'Password should be at least 6 characters.' }))
      .toBe('Heslo musí mít alespoň 6 znaků');
  });

  it('přeloží neplatný email', () => {
    expect(signUpErrorMessage({ code: 'validation_failed', message: 'Unable to validate email address: invalid format' }))
      .toBe('Zadej prosím platnou emailovou adresu');
  });

  it('přeloží rate limit', () => {
    expect(signUpErrorMessage({ code: 'over_request_rate_limit', message: 'Request rate limit reached' }))
      .toContain('Příliš mnoho pokusů');
  });

  it('neznámou chybu nechá projít beze změny', () => {
    expect(signUpErrorMessage({ message: 'Database error saving new user' }))
      .toBe('Database error saving new user');
  });
});
