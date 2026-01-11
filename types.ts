
export enum ShiftTime {
  OPENING = 'Opening (04:00 - 13:00)',
  MORNING = 'Morning (06:00 - 15:00)',
  NOON = 'Noon (12:55 - 22:00)',
  AFTERNOON = 'Afternoon (14:55 - 00:00)',
}

export enum ShiftType {
  AA = 'Always Available',
  STANDARD = 'Standard',
}

// Map: DateString -> ShiftTime -> Array of allowed ShiftTypes
export type AdminAvailabilityMap = Record<string, Partial<Record<ShiftTime, ShiftType[]>>>;

// 0 = Sunday, 1 = Monday, ... 6 = Saturday
export type WeeklyTemplate = Record<number, Record<ShiftTime, ShiftType[]>>;

export interface ShopperShift {
  date: string;
  time: ShiftTime;
  type: ShiftType;
}

export interface ShopperDetails {
  usePicnicBus: boolean | null; // Changed to allow null for explicit selection requirement
  civilStatus: string;
  gender?: string; // New field for Gender (Male, Female, N/D)
  clothingSize: string;
  shoeSize: string;
  gloveSize: string; // Auto-calculated
  isRandstad: boolean;
  address?: string; // Required if isRandstad is true
  firstWorkingDay?: string; // YYYY-MM-DD
  pnNumber?: string; // e.g. PN123456
}

export interface ShopperData {
  name: string;
  shifts: ShopperShift[];
  details?: ShopperDetails;
}

// Extended interface for Admin Panel including DB fields
export interface ShopperRecord {
  id: string;
  created_at: string;
  name: string;
  details: any; // Using any for flexibility with JSONB, or strictly ShopperDetails
  shifts: any[]; // Using any array to match Supabase join, typically contains id, date, time, type
  rank?: number;
}

export enum AppMode {
  HOME = 'HOME',
  ADMIN = 'ADMIN',
  SHOPPER_SETUP = 'SHOPPER_SETUP',
  SHOPPER_FLOW = 'SHOPPER_FLOW',
  SUMMARY = 'SUMMARY',
}

export enum ShopperStep {
  AA_SELECTION = 0,
  FWD_SELECTION = 1, // New Step: First Working Day Selection
  STANDARD_SELECTION = 2,
  DETAILS = 3
}

export enum AdminWizardStep {
  DASHBOARD = 'DASHBOARD',
  WIZARD_DAYS = 'WIZARD_DAYS', // Configuring Mon-Sun
  WIZARD_APPLY = 'WIZARD_APPLY', // Selecting duration
  VIEW_SUBMISSIONS = 'VIEW_SUBMISSIONS', // New Data Dashboard
  BUS_CONFIG = 'BUS_CONFIG' // New Bus Schedule Manager
}

// --- BUS CONFIGURATION TYPES ---
export interface BusSchedule {
  departure: string; // e.g. "05:15"
  return: string;    // e.g. "15:15"
}

export interface BusStop {
  id: string;
  name: string;
  locationName: string;
  coordinates: string; // Display string e.g. 51°...
  googleMapsLink: string;
  schedules: Record<ShiftTime, BusSchedule>;
}

export type BusConfig = BusStop[];
