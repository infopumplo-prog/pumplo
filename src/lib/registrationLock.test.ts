import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRegistrationLock, REGISTRATION_LOCK_TIMEOUT_MS } from './registrationLock';

describe('registrationLock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drží zámek po acquire', () => {
    const setFlag = vi.fn();
    createRegistrationLock(setFlag).acquire();

    expect(setFlag).toHaveBeenCalledWith(true);
    expect(setFlag).toHaveBeenCalledTimes(1);
  });

  it('uvolní zámek při release', () => {
    const setFlag = vi.fn();
    const lock = createRegistrationLock(setFlag);

    lock.acquire();
    lock.release();

    expect(setFlag).toHaveBeenLastCalledWith(false);
  });

  // Jádro bugu z 2. 8. 2026: registrace selhala, zámek nikdo neuvolnil a
  // AuthRoute držel nekonečný spinner. Zámek se musí uvolnit sám i tehdy,
  // když ho volající zapomene pustit.
  it('uvolní zámek sám, když ho nikdo nepustí', () => {
    const setFlag = vi.fn();
    createRegistrationLock(setFlag).acquire();

    vi.advanceTimersByTime(REGISTRATION_LOCK_TIMEOUT_MS);

    expect(setFlag).toHaveBeenLastCalledWith(false);
  });

  it('po release už zámek sám nesahá na flag', () => {
    const setFlag = vi.fn();
    const lock = createRegistrationLock(setFlag);

    lock.acquire();
    lock.release();
    setFlag.mockClear();
    vi.advanceTimersByTime(REGISTRATION_LOCK_TIMEOUT_MS * 2);

    expect(setFlag).not.toHaveBeenCalled();
  });

  it('druhý acquire posune pojistku, nepustí zámek předčasně', () => {
    const setFlag = vi.fn();
    const lock = createRegistrationLock(setFlag);

    lock.acquire();
    vi.advanceTimersByTime(REGISTRATION_LOCK_TIMEOUT_MS - 1_000);
    lock.acquire();
    setFlag.mockClear();
    vi.advanceTimersByTime(REGISTRATION_LOCK_TIMEOUT_MS - 1_000);

    expect(setFlag).not.toHaveBeenCalledWith(false);
  });

  it('dispose zruší pojistku bez sáhnutí na flag', () => {
    const setFlag = vi.fn();
    const lock = createRegistrationLock(setFlag);

    lock.acquire();
    setFlag.mockClear();
    lock.dispose();
    vi.advanceTimersByTime(REGISTRATION_LOCK_TIMEOUT_MS * 2);

    expect(setFlag).not.toHaveBeenCalled();
  });
});
