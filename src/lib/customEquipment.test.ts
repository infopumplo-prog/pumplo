import { describe, it, expect } from 'vitest';
import {
  ALL_EQUIPMENT,
  EQUIPMENT_GROUP_IDS,
  classifyMachine,
  filterExercisesByEquipment,
  isExerciseDoable,
  resolveMachineIds,
  sanitizeCustomEquipment,
  toggleEquipment,
  usesCustomEquipment,
  type MachineRow,
} from './customEquipment';

// Výřez reálné tabulky machines (14. 10. 2026)
const M = (id: string, name: string, equipment_category: string | null, is_cardio = false): MachineRow =>
  ({ id, name, equipment_category, is_cardio });
const MACHINES: MachineRow[] = [
  M('db', 'Jednoručky', 'free_weight'),
  M('kb', 'Kettlebell', 'free_weight'),
  M('osa', 'Osa', 'free_weight'),
  M('rack', 'Half rack', 'free_weight'),
  M('lav', 'Šikmá lavička', 'machine'),
  M('hrazda', 'Hrazdy', 'accessories'),
  M('exp', 'Expander', ''),
  M('guma', 'Guma', ''),
  M('trx', 'TRX', ''),
  M('kladky', 'Protisměrné kladky', 'cable'),
  M('lat', 'Lat pulldown', 'machine'),
  M('smith', 'Smith stroj vyvážený', 'machine'),
  M('lp', 'Leg press 45°', 'plate_loaded'),
  M('legext', 'Leg extension', 'machine'),
  M('pas', 'Běžecký pás', 'cardio', true),
  M('ball', 'Gymball', ''),
  M('pytle', 'Pytle', 'accessories'),
];

describe('classifyMachine', () => {
  it('maps real machines to the expected groups', () => {
    const byId = Object.fromEntries(MACHINES.map(m => [m.id, classifyMachine(m)]));
    expect(byId).toMatchObject({
      db: 'dumbbells', kb: 'kettlebell', osa: 'barbell', rack: 'barbell', lav: 'bench',
      hrazda: 'pull_up_bar', exp: 'bands', guma: 'bands', trx: 'trx', kladky: 'cables',
      lat: 'cables', smith: 'smith', lp: 'leg_press', legext: 'machines', pas: 'cardio',
      ball: 'accessories', pytle: null,
    });
  });

  it('is case/whitespace tolerant', () => {
    expect(classifyMachine(M('x', '  JEDNORUČKY ', null))).toBe('dumbbells');
    expect(classifyMachine(M('y', 'Peck deck ', 'selectorized'))).toBe('machines');
  });

  it('cardio wins over category and name', () => {
    expect(classifyMachine(M('z', 'Veslařský stroj', 'cardio', true))).toBe('cardio');
  });
});

describe('resolveMachineIds', () => {
  it('returns only machines of ticked groups', () => {
    expect([...resolveMachineIds(['dumbbells', 'bands'], MACHINES)].sort()).toEqual(['db', 'exp', 'guma']);
  });

  it('"all" returns every machine incl. unclassified ones', () => {
    expect(resolveMachineIds([ALL_EQUIPMENT], MACHINES).size).toBe(MACHINES.length);
  });

  it('bodyweight only → no machines', () => {
    expect(resolveMachineIds(['bodyweight'], MACHINES).size).toBe(0);
  });

  it('ignores unknown values', () => {
    expect([...resolveMachineIds(['nonsense', 'kettlebell'], MACHINES)]).toEqual(['kb']);
  });
});

describe('isExerciseDoable / filterExercisesByEquipment', () => {
  const available = resolveMachineIds(['dumbbells', 'barbell'], MACHINES);
  const exercises = [
    { id: 'pushup', machine_id: null, secondary_machine_id: null },        // vlastní váha
    { id: 'db_press', machine_id: 'db' },
    { id: 'squat', machine_id: 'rack', secondary_machine_id: 'osa' },      // rack + osa
    { id: 'hip_thrust', machine_id: 'lav', secondary_machine_id: 'osa' },  // chybí lavice
    { id: 'legext', machine_id: 'legext' },
    { id: 'band_row', machine_id: 'exp', secondary_machine_id: 'guma' },
  ];

  it('keeps bodyweight and fully equipped exercises only', () => {
    expect(filterExercisesByEquipment(exercises, available).map(e => e.id)).toEqual(['pushup', 'db_press', 'squat']);
  });

  it('requires the secondary machine too', () => {
    expect(isExerciseDoable({ machine_id: 'rack', secondary_machine_id: 'kladky' }, available)).toBe(false);
    const withBench = resolveMachineIds(['barbell', 'bench'], MACHINES);
    expect(isExerciseDoable({ machine_id: 'lav', secondary_machine_id: 'osa' }, withBench)).toBe(true);
  });

  it('empty set keeps only machine-free exercises', () => {
    expect(filterExercisesByEquipment(exercises, new Set()).map(e => e.id)).toEqual(['pushup']);
  });
});

describe('sanitize / usesCustomEquipment / toggle', () => {
  it('sanitizes stored values', () => {
    expect(sanitizeCustomEquipment(null)).toEqual([]);
    expect(sanitizeCustomEquipment(['dumbbells', 'dumbbells', 'x'])).toEqual(['dumbbells']);
    expect(sanitizeCustomEquipment(['dumbbells', ALL_EQUIPMENT])).toEqual([ALL_EQUIPMENT]);
  });

  it('custom mode only without a gym and with equipment', () => {
    expect(usesCustomEquipment({ selected_gym_id: null, custom_equipment: ['dumbbells'] })).toBe(true);
    expect(usesCustomEquipment({ selected_gym_id: 'g1', custom_equipment: ['dumbbells'] })).toBe(false);
    expect(usesCustomEquipment({ selected_gym_id: null, custom_equipment: [] })).toBe(false);
    expect(usesCustomEquipment({ selected_gym_id: null, custom_equipment: null })).toBe(false);
    expect(usesCustomEquipment(null)).toBe(false);
  });

  it('"all" is exclusive with individual groups', () => {
    expect(toggleEquipment(['dumbbells'], ALL_EQUIPMENT)).toEqual([ALL_EQUIPMENT]);
    expect(toggleEquipment([ALL_EQUIPMENT], 'bands')).toEqual(['bands']);
    expect(toggleEquipment(['bands'], 'bands')).toEqual([]);
    expect(toggleEquipment([ALL_EQUIPMENT], ALL_EQUIPMENT)).toEqual([]);
  });

  it('group ids are unique', () => {
    expect(new Set(EQUIPMENT_GROUP_IDS).size).toBe(EQUIPMENT_GROUP_IDS.length);
  });
});
