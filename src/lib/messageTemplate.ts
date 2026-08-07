// Šablony systémových zpráv. Uvítání je uložené s {{name}} a jméno se dosazuje
// až při zobrazení — e-mailová registrace vytvoří profil bez jména a vyplní ho
// teprve formulář po vzniku účtu.
//
// Stejná logika běží i v edge funkci send-message-push (push notifikace).

const NAME_TOKEN = /\s*\{\{name\}\}/g;

/**
 * Doplní křestní jméno do šablony. Bez jména zahodí placeholder i mezeru před
 * interpunkcí, aby nevzniklo „Ahoj ,".
 */
export const fillName = (text: string, firstName: string): string => {
  if (firstName) return text.replace(NAME_TOKEN, ` ${firstName}`).replace(/^\s+/, '');
  return text.replace(NAME_TOKEN, '').replace(/\s+([,.!?])/g, '$1');
};
