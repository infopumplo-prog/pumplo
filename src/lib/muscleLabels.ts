export const MUSCLE_LABELS: Record<string, string> = {
  abs: 'Břišní svaly',
  obliques: 'Šikmé svaly',
  deep_core_muscles: 'Hluboké core svaly',
  lower_back: 'Spodní část zad',
  upper_back: 'Horní část zad',
  middle_back: 'Střední část zad',
  wide_back_muscles: 'Široký záda',
  chest_muscles: 'Prsní svaly',
  front_shoulders: 'Přední ramena',
  side_shoulders: 'Boční ramena',
  rear_shoulders: 'Zadní ramena',
  biceps: 'Biceps',
  upper_arm_muscles: 'Svaly paží',
  forearms: 'Předloktí',
  triceps: 'Triceps',
  glutes: 'Hýždě',
  side_glutes: 'Boční hýždě',
  hip_flexors: 'Flexory kyčle',
  inner_thighs: 'Vnitřní stehna',
  outer_thighs: 'Vnější stehna',
  front_thighs: 'Přední stehna',
  back_thighs: 'Zadní stehna',
  calves: 'Lýtka',
  stabilizing_muscles: 'Stabilizační svaly',
  core_stabilizers: 'Core stabilizátory',
  upper_trapezius: 'Horní trapéz',
  middle_trapezius: 'Střední trapéz',
  lower_trapezius: 'Dolní trapéz',
  levator_scapulae: 'Zdvihač lopatky',
  rhomboid_major: 'Velký rhomboid',
  rhomboid_minor: 'Malý rhomboid',
};

export const getMuscleLabel = (muscle: string): string => {
  const normalized = muscle.toLowerCase().replace(/[-\s]/g, '_');
  return MUSCLE_LABELS[normalized] || muscle.replace(/_/g, ' ');
};
