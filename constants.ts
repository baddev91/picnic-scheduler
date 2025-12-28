import { ShiftTime } from './types';
import { format, startOfWeek, addWeeks, endOfWeek } from 'date-fns';

export const SHIFT_TIMES = [
  ShiftTime.OPENING,
  ShiftTime.MORNING,
  ShiftTime.NOON,
  ShiftTime.AFTERNOON,
];

export const SHIFT_COLORS = {
  OPENING: 'bg-orange-100 text-orange-800 border-orange-200',
  MORNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  NOON: 'bg-blue-100 text-blue-800 border-blue-200',
  AFTERNOON: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export const TYPE_COLORS = {
  AA: 'bg-red-500 text-white',
  STANDARD: 'bg-green-500 text-white',
};

// Helper to format date consistent with key storage
export const formatDateKey = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Helper to get the allowed range (Current Week + Next 2 Weeks = 3 Weeks Total)
export const getShopperAllowedRange = () => {
  const now = new Date();
  // Start Monday of current week
  const start = startOfWeek(now, { weekStartsOn: 1 });
  // End Sunday of the week after next (Current + 2 weeks)
  const end = endOfWeek(addWeeks(start, 2), { weekStartsOn: 1 });
  
  return { start, end };
};