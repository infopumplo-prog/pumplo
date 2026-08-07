import { useEffect, useRef } from 'react';
import {
  addWatchActionListener,
  buildWatchWorkoutState,
  endWatchState,
  updateWatchState,
  type BuildInput,
  type WatchAction,
} from '@/lib/watchWorkout';

/**
 * Přenos telefon → hodinky a zpět. Hook o tréninku neví nic: dostane hotový
 * stav a předává akce ven.
 *
 * `state === null` znamená „teď neposílej nic" (např. než se načtou cviky).
 *
 * Odesílá se jen při skutečné změně stavu — porovnáváme serializovaný tvar,
 * protože volající skládá nový objekt při každém renderu a pole dat v poli
 * závislostí by posílalo snapshot pořád dokola.
 */
export function useWatchBridge(state: BuildInput | null, onAction: (a: WatchAction) => void): void {
  // Listener se připojuje jen při mountu, ale musí volat aktuální closure —
  // jinak by po výměně cviku běžel proti zastaralému stavu.
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  useEffect(() => {
    const off = addWatchActionListener(a => actionRef.current(a));
    return off;
  }, []);

  // Odchod z tréninku sundá banner na hodinkách.
  useEffect(() => () => { void endWatchState(); }, []);

  const serialized = state ? JSON.stringify(state) : null;
  useEffect(() => {
    if (!serialized) return;
    void updateWatchState(buildWatchWorkoutState(JSON.parse(serialized) as BuildInput));
  }, [serialized]);
}
