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
export type AdminAvailabilityMap = Record<string, Record<ShiftTime, ShiftType[]>>;

// 0 = Sunday, 1 = Monday, ... 6 = Saturday
export type WeeklyTemplate = Record<number, Record<ShiftTime, ShiftType[]>>;

export interface ShopperShift {
  date: string;
  time: ShiftTime;
  type: ShiftType;
}

export interface ShopperDetails {
  usePicnicBus: boolean;
  civilStatus: string;
  clothingSize: string;
  shoeSize: string;
  gloveSize: string; // Auto-calculated
  isRandstad: boolean;
  address?: string; // Required if isRandstad is true
}

export interface ShopperData {
  name: string;
  shifts: ShopperShift[];
  details?: ShopperDetails;
}

export enum AppMode {
  HOME = 'HOME',
  ADMIN = 'ADMIN',
  SHOPPER_SETUP = 'SHOPPER_SETUP',
  SHOPPER_FLOW = 'SHOPPER_FLOW',
  SUMMARY = 'SUMMARY',
}