
import { addDays, isAfter, endOfWeek, addWeeks, format, isWeekend, startOfDay, differenceInHours, parseISO, getDay } from 'date-fns';
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

// --- BATCH VALIDATION (ADMIN CHECK) ---
export const validateShopperSchedule = (shifts: ShopperShift[]): string[] => {
    const issues: string[] = [];
    if (!shifts || shifts.length === 0) return ["No shifts assigned."];

    // 1. AA Pattern Check
    // Requirement: At least 2 distinct days of the week (e.g. Mon + Sat, or Sat + Sun)
    const aaShifts = shifts.filter(s => s.type === ShiftType.AA);
    const uniqueDaysOfWeek = new Set(aaShifts.map(s => getDay(parseISO(s.date))));
    
    if (uniqueDaysOfWeek.size < 2) {
        issues.push(`Invalid AA Pattern: Found ${uniqueDaysOfWeek.size} distinct weekday(s), expected at least 2.`);
    }

    // Sort shifts by date
    const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

    // 2. Consecutive Days Check
    let consecutiveStreak = 1;
    for (let i = 1; i < sortedShifts.length; i++) {
        const prev = getSafeDateFromKey(sortedShifts[i-1].date);
        const curr = getSafeDateFromKey(sortedShifts[i].date);
        
        if (differenceInHours(curr, prev) < 26) { // Approx 1 day diff
             consecutiveStreak++;
        } else {
             consecutiveStreak = 1;
        }

        if (consecutiveStreak > 5) {
            // Avoid duplicate error messages
            if (!issues.some(i => i.includes('Consecutive'))) {
                issues.push("Exceeds 5 consecutive working days.");
            }
        }
    }

    // 3. Rest Rule Check (11 hours)
    // Early: Opening (04:00), Morning (06:00)
    // Late: Noon (ends ~22:00), Afternoon (ends ~00:00)
    const earlyShifts = [ShiftTime.OPENING, ShiftTime.MORNING];
    const lateShifts = [ShiftTime.NOON, ShiftTime.AFTERNOON];

    for (let i = 0; i < sortedShifts.length - 1; i++) {
        const current = sortedShifts[i];
        const next = sortedShifts[i+1];
        
        const currentDate = getSafeDateFromKey(current.date);
        const nextDate = getSafeDateFromKey(next.date);

        // Check only if they are consecutive days
        if (differenceInHours(nextDate, currentDate) < 26) {
            if (lateShifts.includes(current.time) && earlyShifts.includes(next.time)) {
                issues.push(`Rest Violation: ${current.date} (${current.time.split('(')[0]}) -> ${next.date} (${next.time.split('(')[0]}).`);
            }
        }
    }

    return issues;
};
