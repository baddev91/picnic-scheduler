
import { addDays, addWeeks, format } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import { ShopperRecord, ShiftType, ShiftTime } from '../types';
import { SHIFT_TIMES, formatDateKey } from '../constants';

// Helper to match shift string to index (0-3)
const getShiftIndex = (time: ShiftTime): number => {
  // SHIFT_TIMES is ordered: Opening, Morning, Noon, Afternoon
  return SHIFT_TIMES.indexOf(time);
};

export const generateSpreadsheetRow = (shopper: ShopperRecord, weekOffset: number): string => {
  if (!shopper.details?.firstWorkingDay) {
    throw new Error(`First Working Day missing for ${shopper.name}`);
  }

  const fwdDate = new Date(shopper.details.firstWorkingDay);
  
  // Calculate the Monday of the target week
  // weekOffset 0 = Week of FWD
  // weekOffset 1 = Next Week
  let targetMonday = startOfWeek(fwdDate, { weekStartsOn: 1 }); // Monday of FWD week
  if (weekOffset > 0) {
    targetMonday = addWeeks(targetMonday, weekOffset);
  }

  // Column A: Name
  let rowString = `${shopper.name}\t`;
  
  // Column B: PW / PN Number
  // Uses the PN number if available, otherwise leaves empty
  rowString += `${shopper.details?.pnNumber || ''}\t`;

  // Iterate 7 days (Mon-Sun)
  for (let i = 0; i < 7; i++) {
    const currentDay = addDays(targetMonday, i);
    const dateKey = formatDateKey(currentDay);

    // Filter shifts for this specific day
    const daysShifts = shopper.shifts.filter(s => s.date === dateKey);

    // We need 4 columns per day: Opening, Morning, Noon, Afternoon
    // SHIFT_TIMES constant defines this exact order
    SHIFT_TIMES.forEach((timeRef) => {
      const shiftFound = daysShifts.find(s => s.time === timeRef);

      if (shiftFound) {
        // Logic: "FD" if it matches First Working Day, otherwise "X"
        // Note: fwdDate comparison needs to match the exact day
        const isFWD = format(currentDay, 'yyyy-MM-dd') === shopper.details.firstWorkingDay;
        
        rowString += isFWD ? 'FD' : 'X';
      } else {
        rowString += ''; // Empty cell
      }
      
      // Add Tab for next cell
      rowString += '\t';
    });
  }

  return rowString;
};

// Internal Helper to extract raw values for LS Inflow
const getHRRowValues = (shopper: ShopperRecord): string[] => {
  // Helper to extract initial from ShiftTime string
  const getShiftInitial = (shiftTime: string): string => {
    if (shiftTime.includes('Opening')) return 'o';
    if (shiftTime.includes('Morning')) return 'm';
    if (shiftTime.includes('Noon')) return 'n';
    if (shiftTime.includes('Afternoon')) return 'a';
    return '?';
  };

  const getShiftNameOnly = (shiftTime: string): string => {
    return shiftTime.split('(')[0].trim();
  };

  // Helper to normalize Civil Status to match Excel Dropdown exactly
  const normalizeCivilStatus = (status: string | undefined): string => {
      if (!status) return 'unknown';
      const s = status.toLowerCase().trim();
      
      if (s === 'single') return 'single';
      if (s === 'married') return 'Married';
      if (s === 'cohabit') return 'Cohabit';
      if (s === 'divorced') return 'Divorced';
      if (s === 'widowed') return 'widowed';
      if (s === 'engaged') return 'Engaged';
      if (s.includes('partnership')) return 'Registered partnership';
      if (s.includes('separation')) return 'Legal separation';
      
      return 'unknown';
  };

  // 1. Process AA Shifts
  const aaShifts = (shopper.shifts || []).filter(s => s.type === ShiftType.AA);

  // Identify distinct Weekday vs Weekend pattern
  // Logic: Only take the first found Weekday and first found Weekend
  let weekdayPattern = '';
  let weekendPattern = '';
  
  // Sort by date to ensure consistency
  aaShifts.sort((a, b) => a.date.localeCompare(b.date));

  for (const s of aaShifts) {
      const date = new Date(s.date);
      const dayIndex = date.getDay(); // 0 Sun, 6 Sat
      const isWeekend = dayIndex === 0 || dayIndex === 6;
      
      const dayName = format(date, 'EEE').toUpperCase();
      const initial = getShiftInitial(s.time);
      const patternString = `${dayName}(${initial})`;

      if (isWeekend) {
          if (!weekendPattern) weekendPattern = patternString;
      } else {
          if (!weekdayPattern) weekdayPattern = patternString;
      }
  }

  // Column E: Combine patterns (Weekday/Weekend)
  const aaPatternColumn = [weekdayPattern, weekendPattern].filter(Boolean).join('/');

  // Column D: Shift Type Name (e.g. "Morning" or "Mixed")
  let shiftTypeColumn = "";
  if (weekdayPattern || weekendPattern) {
      const distinctTimes = new Set(aaShifts.map(s => s.time));
      if (distinctTimes.size === 1) {
          shiftTypeColumn = getShiftNameOnly(Array.from(distinctTimes)[0]);
      } else {
          shiftTypeColumn = "Mixed";
      }
  }

  // Format Dates
  const serDate = shopper.created_at ? format(new Date(shopper.created_at), 'dd/MM/yyyy') : '';
  const fwdDate = shopper.details?.firstWorkingDay ? format(new Date(shopper.details.firstWorkingDay), 'dd/MM/yyyy') : '';

  // Prepare normalized civil status
  const normalizedStatus = normalizeCivilStatus(shopper.details?.civilStatus);
  const address = shopper.details?.isRandstad ? (shopper.details?.address || '') : '';
  
  // Prepare Gender (Column G)
  // Use selected value or 'N/D' if undefined
  const gender = shopper.details?.gender || 'N/D';

  return [
      serDate,                                      // Col A: Date (SER)
      shopper.details?.pnNumber || '',              // Col B: PN
      shopper.name,                                 // Col C: Name
      shiftTypeColumn,                              // Col D: Shift (AA)
      aaPatternColumn,                              // Col E: AA Pattern
      fwdDate,                                      // Col F: FWD
      gender,                                       // Col G: Gender (Updated)
      normalizedStatus,                             // Col H: Marital status
      address,                                      // Col I: Address
      '',                                           // Col J: Nationality
      shopper.details?.clothingSize || '',          // Col K: Shirt Size
      shopper.details?.shoeSize || '',              // Col L: Shoes Size
      shopper.details?.usePicnicBus ? 'TRUE' : 'FALSE', // Col M: Picnic bus?
      '',                                           // Col N: Re-hire?
      '',                                           // Col O: Onboard sheet?
      '',                                           // Col P: Score cards?
      '',                                           // Col Q: Leadership fit?
      '',                                           // Col R: RT?
      ''                                            // Col S: Recruiter
  ];
};

// Standard Text Export (TSV) - Single
export const generateHRSpreadsheetRow = (shopper: ShopperRecord): string => {
  return getHRRowValues(shopper).join('\t');
};

// HTML Export (For formatted copy/paste with alignment) - Single
export const generateHRSpreadsheetHTML = (shopper: ShopperRecord): string => {
  const values = getHRRowValues(shopper);
  // Add center alignment to all cells
  const cells = values.map(v => `<td style="text-align: center; vertical-align: middle;">${v}</td>`).join('');
  return `<table border="1"><tbody><tr>${cells}</tr></tbody></table>`;
};

// --- BULK EXPORTS ---

// Bulk Text Export (TSV)
export const generateBulkHRSpreadsheetRow = (shoppers: ShopperRecord[]): string => {
    return shoppers.map(s => getHRRowValues(s).join('\t')).join('\n');
};

// Bulk HTML Export (Preserves alignment for multiple rows)
export const generateBulkHRSpreadsheetHTML = (shoppers: ShopperRecord[]): string => {
    const rows = shoppers.map(s => {
        const values = getHRRowValues(s);
        const cells = values.map(v => `<td style="text-align: center; vertical-align: middle;">${v}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
    return `<table border="1"><tbody>${rows}</tbody></table>`;
};
