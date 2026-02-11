
import { ShiftTime, BusConfig } from './types';
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

// Helper to get the allowed range (Current Week + 3 Weeks into the future)
export const getShopperAllowedRange = () => {
  const now = new Date();
  // Start Monday of current week
  const start = startOfWeek(now, { weekStartsOn: 1 });
  // End Sunday of the 3rd week from now (allows picking a start date ~3 weeks out)
  const end = endOfWeek(addWeeks(start, 3), { weekStartsOn: 1 });
  
  return { start, end };
};

export const EUROPEAN_COUNTRIES = [
    "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", 
    "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", 
    "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", 
    "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", 
    "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", 
    "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", 
    "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City"
];

export const DEFAULT_BUS_CONFIG: BusConfig = [
  {
    id: 'rotterdam_cs',
    name: 'Rotterdam Central Station',
    locationName: 'Conradstraat (Bus Platform)',
    coordinates: `51°55'26.2"N 4°28'04.5"E`,
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=51.923944,4.467917',
    schedules: {
      [ShiftTime.OPENING]: { departure: '03:15', return: '13:30' },
      [ShiftTime.MORNING]: { departure: '05:15', return: '15:30' },
      [ShiftTime.NOON]: { departure: '12:00', return: '22:30' },
      [ShiftTime.AFTERNOON]: { departure: '14:00', return: '00:30' },
    }
  },
  {
    id: 'rotterdam_zuid',
    name: 'Rotterdam Zuidplein',
    locationName: 'Bus Station Zuidplein',
    coordinates: `51°53'09.8"N 4°29'19.1"E`,
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=51.886056,4.488639',
    schedules: {
      [ShiftTime.OPENING]: { departure: '03:30', return: '13:30' },
      [ShiftTime.MORNING]: { departure: '05:30', return: '15:30' },
      [ShiftTime.NOON]: { departure: '12:15', return: '22:30' },
      [ShiftTime.AFTERNOON]: { departure: '14:15', return: '00:30' },
    }
  },
  {
    id: 'dordrecht_cs',
    name: 'Dordrecht Central Station',
    locationName: 'Bus Station',
    coordinates: `51°48'30.0"N 4°39'52.6"E`,
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=51.808333,4.664611',
    schedules: {
      [ShiftTime.OPENING]: { departure: '03:00', return: '13:45' },
      [ShiftTime.MORNING]: { departure: '05:00', return: '15:45' },
      [ShiftTime.NOON]: { departure: '11:45', return: '22:45' },
      [ShiftTime.AFTERNOON]: { departure: '13:45', return: '00:45' },
    }
  }
];

// --- GOOGLE API CONFIGURAZIONE ---

// 1. CLIENT ID
export const GOOGLE_CLIENT_ID = '520487940784-73147tpo2ugt4svf1v7d5atp59u1gm1m.apps.googleusercontent.com'; 

// 2. SPREADSHEET ID
export const GOOGLE_SPREADSHEET_ID = '1qXTpVH_JQB1ru1W9NQEub4JgD4CdRqzFniXX6ODVyuc';

// 3. NOME DEL FOGLIO (Tab Name)
export const SHEET_TAB_NAME = 'Shift-Dashboard-proposal';

// 4. (OPZIONALE) LINK CSV PUBBLICO
export const GOOGLE_SHEET_CSV_URL = '';
