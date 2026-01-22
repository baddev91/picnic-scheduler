
import { addDays, isAfter, endOfWeek, addWeeks, format, isWeekend, startOfDay } from 'date-fns';
import { ShiftTime, ShiftType, ShopperShift } from '../types';
import { formatDateKey, EUROPEAN_COUNTRIES, getShopperMinDate } from '../constants';

// Helper to parse date key safely
export const getSafeDateFromKey = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const calculateGloveSize = (clothingSize: string): string => {
  const map: Record<string, string> = {
    'XS': '6 (XS)', 'S': '7 (S)', 'M': '8 (M)', 'L': '9 (L)',
    'XL': '10 (XL)', 'XXL': '11 (XXL)', '3XL': '12 (3XL)', 
    '4XL': '12 (4XL)', '5XL': '12 (4XL)', '6XL': '12 (4XL)'
  };
  return map[clothingSize] || '8 (M)';
};

// --- START DATE LOGIC ---

// Helper to add N business days to a date
const addBusinessDays = (startDate: Date, daysToAdd: number): Date => {
    let count = 0;
    let currentDate = startDate;
    while (count < daysToAdd) {
        currentDate = addDays(currentDate, 1);
        if (!isWeekend(currentDate)) {
            count++;
        }
    }
    return currentDate;
};

export const calculateMinStartDate = (nationality: string | undefined): Date => {
    // If no nationality selected (shouldn't happen in flow), default to standard
    if (!nationality) return getShopperMinDate();

    // 1. Special Rule: Ukraine -> 7 Working Days
    if (nationality === 'Ukraine' || nationality.includes('Ukraine')) {
        return addBusinessDays(startOfDay(new Date()), 7);
    }

    // 2. Check if EU/European (Standard Rule)
    const isEuropean = EUROPEAN_COUNTRIES.includes(nationality) || EUROPEAN_COUNTRIES.some(c => nationality.includes(c));

    if (isEuropean) {
        // Standard Rule: Today + 3 Days
        return getShopperMinDate();
    } else {
        // 3. Non-EU Rule: Today + 5 WORKING Days
        return addBusinessDays(startOfDay(new Date()), 5);
    }
};

// --- VALIDATION RULES ---

export const isRestViolation = (dateStr: string, newTime: ShiftTime, currentShifts: ShopperShift[]): boolean => {
  const earlyShifts = [ShiftTime.OPENING, ShiftTime.MORNING];
  const lateShifts = [ShiftTime.NOON, ShiftTime.AFTERNOON];
  const isNewEarly = earlyShifts.includes(newTime);
  const isNewLate = lateShifts.includes(newTime);
  
  const date = getSafeDateFromKey(dateStr);
  const prevDateKey = formatDateKey(addDays(date, -1));
  const nextDateKey = formatDateKey(addDays(date, 1));
  
  const prevShift = currentShifts.find(s => s.date === prevDateKey);
  const nextShift = currentShifts.find(s => s.date === nextDateKey);
  
  if (isNewEarly && prevShift && lateShifts.includes(prevShift.time)) return true;
  if (isNewLate && nextShift && earlyShifts.includes(nextShift.time)) return true;
  return false;
};

export const isConsecutiveDaysViolation = (dateStr: string, currentShifts: ShopperShift[]): boolean => {
    const targetDate = getSafeDateFromKey(dateStr);
    const shiftDates = new Set(currentShifts.map(s => s.date));
    let consecutiveBefore = 0;
    let checkDate = addDays(targetDate, -1);
    while (shiftDates.has(formatDateKey(checkDate))) { consecutiveBefore++; checkDate = addDays(checkDate, -1); }
    let consecutiveAfter = 0;
    checkDate = addDays(targetDate, 1);
    while (shiftDates.has(formatDateKey(checkDate))) { consecutiveAfter++; checkDate = addDays(checkDate, 1); }
    return (consecutiveBefore + 1 + consecutiveAfter) > 5;
};

export const validateShopperRange = (proposedShifts: ShopperShift[], firstWorkingDay: string | undefined): { valid: boolean, message?: string } => {
   if (!firstWorkingDay) return { valid: true };

   const fwdDate = getSafeDateFromKey(firstWorkingDay);
   // Allowed End Date: Sunday of the week FOLLOWING the FWD's week
   const allowedEndDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });

   const standardShifts = proposedShifts.filter(s => s.type === ShiftType.STANDARD);
   const lateShifts = standardShifts.filter(s => isAfter(getSafeDateFromKey(s.date), allowedEndDate));

   if (lateShifts.length > 0) {
       return {
           valid: false,
           message: `Range Limit Exceeded.\n\nBased on your Start Date (${format(fwdDate, 'MMM do')}), you can only select shifts up to ${format(allowedEndDate, 'MMM do')}.`
       };
   }
   return { valid: true };
};
