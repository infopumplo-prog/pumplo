import { describe, it, expect } from 'vitest';
import { parseInstallReferrer } from './installReferrer';

describe('parseInstallReferrer', () => {
  it('QR scan referrer', () =>
    expect(parseInstallReferrer('pumplo_scan_3f2a9c1e-77aa-4d1b-9a0e-1234567890ab')).toEqual({ installSource: 'qr_scan', scanId: '3f2a9c1e-77aa-4d1b-9a0e-1234567890ab' }));
  it('URL-encoded QR scan referrer', () =>
    expect(parseInstallReferrer('pumplo_scan_abc%2D123')).toEqual({ installSource: 'qr_scan', scanId: 'abc-123' }));
  it('QR scan followed by extra params', () =>
    expect(parseInstallReferrer('pumplo_scan_abc123&utm_medium=qr')).toEqual({ installSource: 'qr_scan', scanId: 'abc123' }));
  it('strips unexpected characters from scan id', () =>
    expect(parseInstallReferrer('pumplo_scan_ab<script>c')).toEqual({ installSource: 'qr_scan', scanId: 'abscriptc' }));
  it('empty scan id is not a QR attribution', () =>
    expect(parseInstallReferrer('pumplo_scan_')).toEqual({ installSource: null, scanId: null }));
  it('utm_source from Play referrer', () =>
    expect(parseInstallReferrer('utm_source=google-play&utm_medium=organic')).toEqual({ installSource: 'google-play', scanId: null }));
  it('utm_source is capped to the GA user property length', () =>
    expect(parseInstallReferrer(`utm_source=${'x'.repeat(50)}`).installSource).toHaveLength(36));
  it('nothing usable', () => {
    expect(parseInstallReferrer(undefined)).toEqual({ installSource: null, scanId: null });
    expect(parseInstallReferrer('')).toEqual({ installSource: null, scanId: null });
    expect(parseInstallReferrer('utm_medium=organic')).toEqual({ installSource: null, scanId: null });
  });
});
