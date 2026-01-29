
import React from 'react';
import { ShiftTime, ShiftType, ShopperShift, AdminAvailabilityMap, WeeklyTemplate } from '../types';
import { useCalendarLogic } from '../hooks/useCalendarLogic';
import { MobileCalendarList } from './Calendar/MobileCalendarList';
import { DesktopCalendarGrid } from './Calendar/DesktopCalendarGrid';
import { DesktopDayPanel } from './Calendar/DesktopDayPanel';

interface CalendarViewProps {
  mode: 'ADMIN' | 'SHOPPER';
  step?: number;
  isFWDSelection?: boolean;
  adminAvailability: AdminAvailabilityMap;
  weeklyTemplate?: WeeklyTemplate | null; // Added
  currentShopperShifts?: ShopperShift[];
  firstWorkingDay?: string;
  fwdCounts?: Record<string, number>;
  onAdminToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onShopperToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onSetFirstWorkingDay?: (date: string) => void;
  minDate?: Date; // NEW: Allow external override for minimum date
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  mode,
  step = 1,
  isFWDSelection = false,
  adminAvailability,
  weeklyTemplate, // Added
  currentShopperShifts = [],
  firstWorkingDay,
  fwdCounts = {},
  onAdminToggle,
  onShopperToggle,
  onSetFirstWorkingDay,
  minDate
}) => {
  const {
    currentDate,
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
  } = useCalendarLogic({
    mode,
    step,
    isFWDSelection,
    currentShopperShifts,
    firstWorkingDay,
    adminAvailability,
    weeklyTemplate, // Passed down
    minDateOverride: minDate
  });

  return (
    <>
        {/* Mobile View: Vertical List */}
        <div className="md:hidden">
            <MobileCalendarList 
              daysToList={getMobileListDates()}
              mode={mode}
              step={step}
              isFWDSelection={isFWDSelection}
              currentShopperShifts={currentShopperShifts}
              fwdCounts={fwdCounts}
              getShopperDayStatus={getShopperDayStatus}
              isDateDisabledForShopper={isDateDisabledForShopper}
              isTypeAvailable={isTypeAvailable}
              onShopperToggle={onShopperToggle}
              firstWorkingDay={firstWorkingDay} // Added prop
            />
        </div>

        {/* Desktop View: Grid Calendar */}
        <div className="hidden md:block">
            <DesktopCalendarGrid 
              currentDate={currentDate}
              daysInMonth={daysInMonth}
              today={today}
              minShopperDate={minShopperDate}
              mode={mode}
              isFWDSelection={isFWDSelection}
              adminAvailability={adminAvailability}
              getShopperDayStatus={getShopperDayStatus}
              isDateDisabledForShopper={isDateDisabledForShopper}
              getShiftLabel={getShiftLabel}
              handlePrevMonth={handlePrevMonth}
              handleNextMonth={handleNextMonth}
              setSelectedDay={setSelectedDay}
            />
            <DesktopDayPanel 
              selectedDay={selectedDay}
              mode={mode}
              step={step}
              isFWDSelection={isFWDSelection}
              firstWorkingDay={firstWorkingDay}
              currentShopperShifts={currentShopperShifts}
              fwdCounts={fwdCounts}
              isDateDisabledForShopper={isDateDisabledForShopper}
              isTypeAvailable={isTypeAvailable}
              onAdminToggle={onAdminToggle}
              onShopperToggle={onShopperToggle}
              setSelectedDay={setSelectedDay}
            />
        </div>
    </>
  );
};
