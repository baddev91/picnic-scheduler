
import { addDays, isAfter, endOfWeek, addWeeks, format, isWeekend, differenceInHours, getDay, isSameWeek } from 'date-fns';
import startOfDay from 'date-fns/startOfDay';
import startOfWeek from 'date-fns/startOfWeek';
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
        // If it's Saturday (6) or Sunday (0), don't count it
        if (!isWeekend(currentDate)) {
            count++;
        }
    }
    return currentDate;
};

export const calculateMinStartDate = (nationality: string | undefined): Date => {
    // If no nationality selected (shouldn't happen in flow), default to standard
    if (!nationality) return getShopperMinDate();

    const normalizedNat = nationality.trim().toLowerCase();

    // 1. Special Rule: Ukraine -> 7 Working Days
    if (normalizedNat === 'ukraine' || normalizedNat.includes('ukraine')) {
        return addBusinessDays(startOfDay(new Date()), 7);
    }

    // 2. Check if EU/European (Standard Rule)
    // Case-insensitive check against the allowed European list
    const isEuropean = EUROPEAN_COUNTRIES.some(c => 
        c.toLowerCase() === normalizedNat || normalizedNat.includes(c.toLowerCase())
    );

    if (isEuropean) {
        // Standard Rule: Today + 3 Days
        return getShopperMinDate();
    } else {
        // 3. Non-EU / Not in List Rule: Today + 5 WORKING Days
        // This ensures any manual input not recognized as European gets the longer lead time.
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
    
    // Total consecutive days including the new one must NOT exceed 5
    // So 6 days in a row is the violation threshold
    return (consecutiveBefore + 1 + consecutiveAfter) > 5;
};

export const isOpeningShiftViolation = (dateStr: string, time: ShiftTime, currentShifts: ShopperShift[], firstWorkingDay?: string): boolean => {
    // Only applies to OPENING shifts
    if (time !== ShiftTime.OPENING) return false;

    // Filter shifts to only include those on or after the First Working Day (if known)
    // This prevents pre-start AA shifts from inflating the shift count
    let relevantShifts = currentShifts;
    if (firstWorkingDay) {
        relevantShifts = currentShifts.filter(s => s.date >= firstWorkingDay);
    }

    // We need to simulate the array with the new shift included to sort them chronologically
    const uniqueDates = Array.from(new Set([...relevantShifts.map(s => s.date), dateStr]));
    uniqueDates.sort(); // Standard string sort works for YYYY-MM-DD

    const shiftIndex = uniqueDates.indexOf(dateStr);

    // If index is 0 (1st shift) or 1 (2nd shift), OPENING is forbidden.
    // Allowed from 3rd shift (index 2) onwards.
    return shiftIndex < 2;
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
    const uniqueDaysOfWeek = new Set(aaShifts.map(s => getDay(getSafeDateFromKey(s.date))));
    
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
    
    // 4. Opening Shift Rule Check
    // "OPENING" allowed only from the 3rd shift onwards (index >= 2)
    sortedShifts.forEach((s, index) => {
        if (s.time === ShiftTime.OPENING && index < 2) {
            issues.push(`Opening Rule Violation: Shift on ${s.date} is too early (Shift #${index+1}). Must work 2 shifts before taking Opening.`);
        }
    });

    return issues;
};

// Check if adding a standard shift on dateStr would exceed 5 days in one week
// Considering: FWD (if standard), AA shifts, and Standard shifts
export const isWeeklyDaysViolation = (dateStr: string, currentShifts: ShopperShift[], firstWorkingDay?: string): boolean => {
    if (!firstWorkingDay) return false;

    const targetDate = getSafeDateFromKey(dateStr);
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
    
    // Count distinct working days in this week
    const workingDaysSet = new Set<string>();
    
    // 1. Include FWD if it's in the same week AND it's a standard shift
    const fwdDate = getSafeDateFromKey(firstWorkingDay);
    if (isSameWeek(fwdDate, targetDate, { weekStartsOn: 1 })) {
        // Check if FWD has a standard shift or will have one
        const fwdHasStandard = currentShifts.some(s => s.date === firstWorkingDay && s.type === ShiftType.STANDARD);
        if (fwdHasStandard) {
            workingDaysSet.add(firstWorkingDay);
        }
    }
    
    // 2. Include all AA shifts in the week
    currentShifts
        .filter(s => s.type === ShiftType.AA && isSameWeek(getSafeDateFromKey(s.date), targetDate, { weekStartsOn: 1 }))
        .forEach(s => workingDaysSet.add(s.date));
    
    // 3. Include all Standard shifts in the week (including the one being proposed)
    currentShifts
        .filter(s => s.type === ShiftType.STANDARD && isSameWeek(getSafeDateFromKey(s.date), targetDate, { weekStartsOn: 1 }))
        .forEach(s => workingDaysSet.add(s.date));
    
    // Add the proposed date (we're testing if it would violate)
    workingDaysSet.add(dateStr);
    
    // If more than 5 distinct days in a week, it's a violation
    return workingDaysSet.size > 5;
};

// --- FIRST WORKING DAY CAPACITY CHECK ---
// This function counts how many workers have a specific date as their first working day
// and are scheduled for a specific shift time. Used to enforce the 5 FWD workers per shift limit.
export const countFirstWorkingDayWorkers = async (
    date: string,
    time: ShiftTime,
    excludeShopperId?: string
): Promise<number> => {
    // Import supabase dynamically to avoid circular dependencies
    const { supabase } = await import('../supabaseClient');

    // A. Find all shoppers who have this date as their First Working Day
    const { data: shoppers, error: shoppersError } = await supabase
        .from('shoppers')
        .select('id')
        .eq('details->>firstWorkingDay', date);

    if (shoppersError || !shoppers || shoppers.length === 0) {
        return 0;
    }

    // Filter out the current shopper if we're editing (to avoid counting them twice)
    const shopperIds = shoppers
        .map(s => s.id)
        .filter(id => !excludeShopperId || id !== excludeShopperId);

    if (shopperIds.length === 0) {
        return 0;
    }

    // B. Count how many of these shoppers have a shift on this date and time
    const { count, error: countError } = await supabase
        .from('shifts')
        .select('*', { count: 'exact', head: true })
        .in('shopper_id', shopperIds)
        .eq('date', date)
        .eq('time', time);

    if (countError) {
        console.error('Error counting FWD workers:', countError);
        return 0;
    }

    return count || 0;
};
