import { useState } from 'react';
import { cn } from '@/lib/utils';

// Static popular times data based on Google Maps (hourly popularity 0-100)
// TODO: Move to Supabase when gyms have their own attendance data
const POPULAR_TIMES: Record<string, number[]> = {
  monday:    [0,0,0,0,0,0,10,25,35,40,35,30,35,30,25,30,45,60,55,40,25,15,5,0],
  tuesday:   [0,0,0,0,0,0,10,20,30,35,30,30,35,30,25,35,50,65,55,40,25,15,5,0],
  wednesday: [0,0,0,0,0,0,10,25,35,40,35,30,30,25,25,35,50,60,50,35,25,15,5,0],
  thursday:  [0,0,0,0,0,0,10,20,30,35,35,30,40,35,30,35,55,70,60,45,30,15,5,0],
  friday:    [0,0,0,0,0,0,15,30,40,45,40,35,35,30,30,40,55,60,45,30,20,10,5,0],
  saturday:  [0,0,0,0,0,0,0,15,30,45,55,55,45,35,30,35,40,40,30,20,10,5,0,0],
  sunday:    [0,0,0,0,0,0,0,10,20,35,45,50,45,35,25,25,30,30,20,10,5,0,0,0],
};

const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const GymAttendanceChart = () => {
  const now = new Date();
  const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Monday
  const currentHour = now.getHours();

  const [selectedDay, setSelectedDay] = useState(currentDayIndex);

  const selectedKey = DAY_KEYS[selectedDay];
  const hours = POPULAR_TIMES[selectedKey] || [];
  const isToday = selectedDay === currentDayIndex;

  // Show hours 6-23 (opening range)
  const startHour = 6;
  const endHour = 24;
  const visibleHours = hours.slice(startHour, endHour);

  return (
    <div className="space-y-2">
      {/* Day selector - clickable */}
      <div className="flex gap-1">
        {DAY_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setSelectedDay(i)}
            className={cn(
              "text-[10px] flex-1 text-center py-0.5 rounded transition-colors",
              i === selectedDay
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-[2px] h-16">
        {visibleHours.map((val, i) => {
          const hour = startHour + i;
          const isCurrent = isToday && hour === currentHour;
          return (
            <div
              key={hour}
              className={cn(
                "flex-1 rounded-sm min-h-[2px] transition-all",
                isCurrent ? "bg-primary" : "bg-primary/30"
              )}
              style={{ height: `${Math.max(val, 3)}%` }}
            />
          );
        })}
      </div>

      {/* Hour labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
        <span>6</span>
        <span>9</span>
        <span>12</span>
        <span>15</span>
        <span>18</span>
        <span>21</span>
      </div>
    </div>
  );
};

export default GymAttendanceChart;
