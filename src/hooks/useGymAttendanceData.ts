import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AttendanceData = Record<string, number[]>;

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

interface UseGymAttendanceDataResult {
  data: AttendanceData;
  isLoading: boolean;
  hasRealData: boolean;
}

/**
 * Fetches workout session data for a gym and returns hourly popularity
 * per day of week (0–100 scale), based on the last 90 days.
 */
export const useGymAttendanceData = (
  gymId: string | undefined | null
): UseGymAttendanceDataResult => {
  const [data, setData] = useState<AttendanceData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    if (!gymId) {
      setData({});
      setIsLoading(false);
      setHasRealData(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select('started_at')
        .eq('gym_id', gymId)
        .gte('started_at', ninetyDaysAgo.toISOString());

      if (error) {
        console.error('Error fetching gym attendance data:', error);
        setData({});
        setHasRealData(false);
        setIsLoading(false);
        return;
      }

      const rows = sessions || [];

      // Initialise counts: 7 days × 24 hours
      const counts: number[][] = Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0)
      );

      for (const row of rows) {
        const date = new Date(row.started_at);
        const jsDay = date.getDay(); // 0=Sun … 6=Sat
        // Convert to Pumplo index: Mon=0 … Sun=6
        const pumpIndex = jsDay === 0 ? 6 : jsDay - 1;
        const hour = date.getHours();
        counts[pumpIndex][hour]++;
      }

      // Find global maximum for normalisation
      let maxCount = 0;
      for (const dayCounts of counts) {
        for (const c of dayCounts) {
          if (c > maxCount) maxCount = c;
        }
      }

      // Build output: scale to 0–100
      const result: AttendanceData = {};
      DAY_KEYS.forEach((key, i) => {
        if (maxCount === 0) {
          result[key] = new Array<number>(24).fill(0);
        } else {
          result[key] = counts[i].map((c) => Math.round((c / maxCount) * 100));
        }
      });

      const totalSessions = rows.length;
      setData(result);
      setHasRealData(totalSessions >= 10);
      setIsLoading(false);
    };

    fetchData();
  }, [gymId]);

  return { data, isLoading, hasRealData };
};
