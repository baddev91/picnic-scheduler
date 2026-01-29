
import { useState, useMemo } from 'react';
import { 
  format, endOfMonth, eachDayOfInterval, addMonths, isWeekend, endOfWeek, isWithinInterval, 
  isAfter, isBefore, addWeeks, getDay 
} from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import parseISO from 'date-fns/parseISO';
import subMonths from 'date-fns/subMonths';
import startOfMonth from 'date-fns/startOfMonth';
import startOfDay from 'date-fns/startOfDay';
import { ShiftTime, ShiftType, ShopperShift, AdminAvailabilityMap, WeeklyTemplate } from '../types';
import { formatDateKey, getShopperAllowedRange, getShopperMinDate } from '../constants';

interface UseCalendarLogicProps {
  mode: 'ADMIN' | 'SHOPPER';
  step: number;
  isFWDSelection: boolean;
  currentShopperShifts: ShopperShift[];
  firstWorkingDay?: string;
  adminAvailability: AdminAvailabilityMap;
  weeklyTemplate?: WeeklyTemplate | null; // Added: Standard Pattern
  minDateOverride?: Date;
}

export const useCalendarLogic = ({
  mode,
  step,
  isFWDSelection,
  currentShopperShifts,
  firstWorkingDay,
  adminAvailability,
  weeklyTemplate,
  minDateOverride
}: UseCalendarLogicProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Constants / Memos
  const allowedRange = useMemo(() => getShopperAllowedRange(), []);
  // Use override if present, else fallback to standard logic
  const minShopperDate = useMemo(() => minDateOverride || getShopperMinDate(), [minDateOverride]);
  const today = startOfDay(new Date());

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Navigation Handlers
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // --- BUSINESS LOGIC ---

  const getShopperDayStatus = (date: Date) => {
    const key = formatDateKey(date);
    const shifts = currentShopperShifts.filter(s => s.date === key);
    
    const aaShift = shifts.find(s => s.type === ShiftType.AA);
    const stdShift = shifts.find(s => s.type === ShiftType.STANDARD);
    
    return { 
      hasShift: shifts.length > 0, 
      aaShift,
      stdShift,
      isFirstWorkingDay: firstWorkingDay === key
    };
  };

  const isTypeAvailable = (dateKey: string, time: ShiftTime, type: ShiftType) => {
    // 1. Check for Specific Date Override in Admin Map
    if (adminAvailability[dateKey] && adminAvailability[dateKey][time]) {
        return adminAvailability[dateKey][time]?.includes(type) ?? true;
    }

    // 2. Fallback to Standard Weekly Pattern if exists
    if (weeklyTemplate) {
        const dateObj = parseISO(dateKey);
        const dayOfWeek = getDay(dateObj); // 0 (Sun) - 6 (Sat)
        
        // Check if day exists in template
        if (weeklyTemplate[dayOfWeek] && weeklyTemplate[dayOfWeek][time]) {
            return weeklyTemplate[dayOfWeek][time]?.includes(type) ?? true;
        }
    }

    // 3. Default Open if no rules defined
    return true;
  };

  const isDateDisabledForShopper = (date: Date) => {
    if (mode === 'ADMIN') return false;
    
    const dateKey = formatDateKey(date);

    // 1. If First Working Day is selected (Step 2+), enforce Strict Range
    if (step >= 2 && firstWorkingDay) {
        // Block dates BEFORE the start date
        if (dateKey < firstWorkingDay) return true;

        // Block dates AFTER the allowed window (Sunday of the following week)
        const fwdDate = parseISO(firstWorkingDay);
        const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
        
        if (isAfter(date, limitDate)) return true;
    } 
    // 2. Otherwise use generic min date (dynamic based on nationality or static)
    else {
        if (isBefore(date, minShopperDate)) return true;
    }

    // 3. General Global Range Check (Max 8 weeks out)
    if (!isWithinInterval(date, allowedRange)) return true;

    return false;
  };

  const getShiftLabel = (fullTimeStr: string) => {
    const main = fullTimeStr.split(' ')[0];
    const map: Record<string, string> = {
      'Opening': 'Open',
      'Morning': 'Morn',
      'Noon': 'Noon',
      'Afternoon': 'Aft'
    };
    return { desktop: main, mobile: map[main] || main };
  };

  // Logic to generate the specific list of dates for Mobile View
  const getMobileListDates = () => {
    let daysToList: Date[] = [];
    
    if (mode === 'SHOPPER') {
       let rangeStart = allowedRange.start;
       let rangeEnd = allowedRange.end;

       // If FWD is selected (Step 2), TIGHTEN the list range
       if (step >= 2 && firstWorkingDay) {
           const fwdDate = parseISO(firstWorkingDay);
           
           if (isAfter(fwdDate, rangeStart)) {
               rangeStart = fwdDate;
           }

           const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
           if (isBefore(limitDate, rangeEnd)) {
               rangeEnd = limitDate;
           }
       } else {
           // If we are choosing FWD (Step 1 or 0), respect minShopperDate
           if (isAfter(minShopperDate, rangeStart)) {
               rangeStart = minShopperDate;
           }
       }

       if (!isAfter(rangeStart, rangeEnd)) {
           daysToList = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
       }
    } else {
       // Fallback for Admin
       daysToList = daysInMonth; 
    }
    return daysToList;
  };

  return {
    currentDate,
    setCurrentDate,
    selectedDay,
    setSelectedDay,
    daysInMonth,
    today,
    minShopperDate,
    handlePrevMonth,
    handleNextMonth,
    getShopperDayStatus,
    isTypeAvailable,
    isDateDisabledForShopper,
    getShiftLabel,
    getMobileListDates,
  };
};
