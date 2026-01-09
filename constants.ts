import { ShiftTime } from './types';
import { format, addWeeks, endOfWeek, addDays } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import startOfDay from 'date-fns/startOfDay';

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

export const MIN_DAYS_TO_START = 3;

// Helper to get the strict minimum start date (Today + 3 days)
export const getShopperMinDate = () => {
  return addDays(startOfDay(new Date()), MIN_DAYS_TO_START);
};

// Helper to get the allowed range (Current Week + 8 Weeks into the future to allow future starts)
export const getShopperAllowedRange = () => {
  const now = new Date();
  // Start Monday of current week
  const start = startOfWeek(now, { weekStartsOn: 1 });
  // End Sunday of the 8th week from now (allows picking a start date ~2 months out)
  const end = endOfWeek(addWeeks(start, 8), { weekStartsOn: 1 });
  
  return { start, end };
};