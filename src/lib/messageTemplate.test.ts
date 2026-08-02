import { describe, it, expect } from 'vitest';
import { fillName } from './messageTemplate';

// Uvítací zpráva je šablona s {{name}}. E-mailová registrace vytvoří profil
// bez jména, takže prázdný případ musí dopadnout čitelně — ne "Ahoj ,".
describe('fillName', () => {
  it('doplní jméno za oslovení', () => {
    expect(fillName('Vítej v Pumplu{{name}}!', 'David')).toBe('Vítej v Pumplu David!');
  });

  it('bez jména zahodí placeholder i mezeru před interpunkcí', () => {
    expect(fillName('Vítej v Pumplu{{name}}!', '')).toBe('Vítej v Pumplu!');
    expect(fillName('Ahoj {{name}}, jsme rádi, že jsi tady.', '')).toBe('Ahoj, jsme rádi, že jsi tady.');
  });

  it('nenechá text začínat mezerou, když placeholder stojí na začátku', () => {
    expect(fillName('{{name}}, vítej!', 'Eva')).toBe('Eva, vítej!');
  });

  it('nahradí všechny výskyty', () => {
    expect(fillName('{{name}} — {{name}}', 'Eva')).toBe('Eva — Eva');
  });

  it('text bez placeholderu nechá být', () => {
    const text = 'Opravili jsme ukládání ceníku.';
    expect(fillName(text, 'David')).toBe(text);
    expect(fillName(text, '')).toBe(text);
  });
});
