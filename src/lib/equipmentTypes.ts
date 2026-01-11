// Map of equipment type keys to user-friendly Slovak/Czech labels
export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  machine: 'Stroje',
  free_weights: 'Voľné váhy',
  free_weight: 'Voľné váhy',
  bodyweight: 'Vlastná váha',
  cardio: 'Kardio',
  cable: 'Kladky',
  functional: 'Funkčný tréning',
  accessory: 'Príslušenstvo',
  plate_loaded: 'Kotúčové stroje',
  resistance_bands: 'Odporové gumy',
  resistance_band: 'Odporová guma',
  kettlebell: 'Kettlebell',
  barbell: 'Veľká činka',
  dumbbell: 'Jednoručky',
  ez_bar: 'EZ činka',
  trx: 'TRX',
  exercise_ball: 'Fitlopta',
  pull_up_bar: 'Hrazda',
  bench: 'Lavička',
  smith_machine: 'Smithov stroj',
  medicine_ball: 'Medicinbal',
  foam_roller: 'Valec',
};

export const getEquipmentTypeLabel = (type: string): string => {
  const normalized = type.toLowerCase().replace(/[-\s]/g, '_');
  return EQUIPMENT_TYPE_LABELS[normalized] || type.replace(/_/g, ' ');
};
