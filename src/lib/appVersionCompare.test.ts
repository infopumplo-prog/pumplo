import { describe, it, expect } from 'vitest';
import { compareVersions, meetsMinVersion } from './appVersionCompare';

describe('compareVersions', () => {
  it('porovná hlavní, vedlejší i opravné číslo', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('nepočítá čísla jako text — 10 je víc než 9', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
  });

  it('chybějící část bere jako nulu', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });

  it('nespadne na nesmyslném vstupu', () => {
    expect(compareVersions('', '1.0.0')).toBe(-1);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
  });
});

describe('meetsMinVersion', () => {
  it('bez požadavku na verzi projde všechno', () => {
    expect(meetsMinVersion('1.0.0', null)).toBe(true);
    expect(meetsMinVersion(null, null)).toBe(true);
  });

  it('pustí stejnou i vyšší verzi', () => {
    expect(meetsMinVersion('1.3.0', '1.3.0')).toBe(true);
    expect(meetsMinVersion('1.4.0', '1.3.0')).toBe(true);
  });

  it('nepustí starší verzi — ta by zprávu neuměla zobrazit', () => {
    expect(meetsMinVersion('1.2.9', '1.3.0')).toBe(false);
  });

  it('zařízení, které verzi nehlásí, je ze cílené zprávy vynechané', () => {
    expect(meetsMinVersion(null, '1.3.0')).toBe(false);
  });
});
