// Onboarding 2.0: každý klíč, který dotazník může zobrazit, musí existovat v cs i en.
// Dynamické klíče se rozbalí z konstant v src/lib/onboardingFlow.ts a trainingGoals.ts.
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const flow = read('src/lib/onboardingFlow.ts');
const goals = read('src/lib/trainingGoals.ts');
const list = (src, name) => [...src.match(new RegExp(`${name}(?:: [A-Za-z\\[\\]]+)? = \\[([^\\]]+)\\]`))[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

const motivations = list(flow, 'MOTIVATIONS');
const expectations = list(flow, 'EXPECTATIONS');
const plans = list(flow, 'PLAN_CHOICES');
const goalIds = list(goals, 'TRAINING_GOAL_IDS');
const chapters = [...flow.matchAll(/\{ id: '([a-z]+)', steps:/g)].map((m) => m[1]);
const levels = ['beginner', 'intermediate', 'advanced'];

const keys = [
  'optional', 'multi_hint', 'reaction_trainer_name', 'name_title', 'name_subtitle', 'name_placeholder',
  'motivation_title', 'motivation_free_label', 'motivation_free_placeholder',
  'expectations_title', 'expectations_free_label', 'expectations_free_placeholder',
  'plan_choice_title', 'plan_choice_recommended', 'own_plan_name', 'react_name', 'react_expect', 'react_expect_build_own',
  'react_days_one', 'react_days_other', 'react_days_lots',
  ...chapters.map((c) => `chapter_${c}`),
  ...motivations.flatMap((m) => [`motivation_${m}`, `react_motivation_${m}`]),
  ...expectations.map((e) => `expectation_${e}`),
  ...plans.flatMap((p) => [`plan_choice_${p}`, `plan_choice_${p}_desc`]),
  ...goalIds.flatMap((g) => [`react_goal_${g}`, `react_goal_${g}_named`]),
  ...levels.map((l) => `react_level_${l}`),
  // Obrazovka „Jak chceš začít?“
  'plan_choice_subtitle', 'plan_choice_soon', 'plan_choice_next_label', 'plan_choice_pumplo_next', 'plan_choice_trainer_next_one',
  'plan_choice_trainer_next_other', 'plan_choice_own_next', 'plan_choice_own_next_nonumber',
  // Social proof mezi kroky
  'proof_goal_title', 'proof_goal_share', 'proof_level_title', 'proof_trainer_role', 'proof_trainer_years', 'proof_exercises_label',
  'proof_exercises_nonumber_short', 'proof_level_fit', 'proof_plan_title', 'proof_plan_goal', 'proof_plan_week_one', 'proof_plan_week_other',
  'proof_plan_blocks', 'proof_plan_gym', 'proof_plan_exercises', 'proof_plan_exercises_nonumber',
  ...goalIds.map((g) => `proof_goal_method_${g}`),
  ...levels.map((l) => `proof_level_${l}`),
];

let missing = 0;
for (const lang of ['cs', 'en']) {
  const src = read(`src/i18n/locales/${lang}.ts`);
  for (const k of keys) {
    const hits = src.split(`'onboarding.${k}':`).length - 1;
    if (hits !== 1) { console.error(`${lang}: onboarding.${k} ×${hits}`); missing++; }
  }
}
if (!read('src/i18n/locales/cs.ts').includes("'onboarding.react_days_few':")) { console.error('cs: react_days_few missing'); missing++; }
console.log(`checked ${keys.length} keys (chapters ${chapters.length}, goals ${goalIds.length}, motivations ${motivations.length})`);
if (missing) process.exit(1);
console.log('ONBOARDING_I18N_OK');

// Barva appky (fáze 2): všechny barvy z palety + texty kroku.
const accentSrc = read('src/lib/accentColors.ts');
const accents = list(accentSrc, 'ACCENT_COLORS');
const accentKeys = ['title', 'onboarding_title', 'onboarding_subtitle', ...accents];
let accentMissing = 0;
for (const lang of ['cs', 'en']) {
  const src = read(`src/i18n/locales/${lang}.ts`);
  for (const k of accentKeys) if (src.split(`'accent.${k}':`).length - 1 !== 1) { console.error(`${lang}: accent.${k}`); accentMissing++; }
}
// CSS musí mít pravidla pro každou barvu kromě výchozí modré (světlý i tmavý režim).
const css = read('src/index.css');
for (const a of accents.filter((a) => a !== 'blue')) {
  if (!css.includes(`[data-accent="${a}"] {`) || !css.includes(`.dark[data-accent="${a}"] {`)) { console.error(`css: ${a}`); accentMissing++; }
}
if (accentMissing) process.exit(1);
console.log(`ACCENT_I18N_CSS_OK (${accents.length} colors)`);
