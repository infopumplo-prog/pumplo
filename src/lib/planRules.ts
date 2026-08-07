// Pravidla plánu sdílená s hodinkovou serverovou funkcí. Skutečný obsah žije
// v supabase/functions/_shared/planRules.ts, aby appka i funkce četly TÝŽ kód
// a nemohly se rozejít — tenhle soubor je jen pohodlný import pro appku.
export {
  getCurrentDayLetter,
  getNextDayLetter,
  getRestSecondsForCategory,
  RIR_BY_WEEK,
  getRIRGuidance,
} from '../../supabase/functions/_shared/planRules';
