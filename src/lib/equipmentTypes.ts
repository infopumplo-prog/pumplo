// Map of equipment type keys to user-friendly Czech labels
export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  machine: 'Stroje',
  free_weights: 'Volné váhy',
  free_weight: 'Volné váhy',
  bodyweight: 'Vlastní váha',
  cardio: 'Kardio',
  cable: 'Kladky',
  functional: 'Funkční trénink',
  accessory: 'Příslušenství',
  plate_loaded: 'Kotoučové stroje',
  resistance_bands: 'Odporové gumy',
  resistance_band: 'Odporová guma',
  kettlebell: 'Kettlebell',
  barbell: 'Velká činka',
  dumbbell: 'Jednoručky',
  ez_bar: 'EZ činka',
  trx: 'TRX',
  exercise_ball: 'Gymnastický míč',
  pull_up_bar: 'Hrazda',
  bench: 'Lavička',
  smith_machine: 'Smithův stroj',
  medicine_ball: 'Medicinbal',
  foam_roller: 'Válec',
};

export const getEquipmentTypeLabel = (type: string): string => {
  const normalized = type.toLowerCase().replace(/[-\s]/g, '_');
  return EQUIPMENT_TYPE_LABELS[normalized] || type.replace(/_/g, ' ');
};
