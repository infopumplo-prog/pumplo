// Map of equipment type keys to user-friendly Czech labels
export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  machine: 'Stroje',
  free_weights: 'Volné váhy',
  bodyweight: 'Vlastní váha',
  cardio: 'Kardio',
  cable: 'Kladky',
  functional: 'Funkční trénink',
  accessory: 'Příslušenství',
  plate_loaded: 'Kotoučové stroje',
  resistance_bands: 'Odporové gumy',
};

export const getEquipmentTypeLabel = (type: string): string => {
  return EQUIPMENT_TYPE_LABELS[type.toLowerCase()] || type;
};
