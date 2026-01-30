
import React from 'react';
import { GripVertical, Pencil, Trash2, CheckCircle2, XCircle, AlertTriangle, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ShopperRecord, ShiftType } from '../../types';
import { getSafeDateFromKey } from '../../utils/validation';

interface ShopperTableRowProps {
    shopper: ShopperRecord;
    index: number;
    groupKey: string;
    expandedRow: string | null;
    setExpandedRow: (id: string | null) => void;
    draggingId: string | null;
    deleteConfirmId: string | null;
    searchTerm: string;
    onDragStart: (e: React.DragEvent, index: number, group: string, id: string) => void;
    onDragEnter: (e: React.DragEvent, index: number, group: string) => void;
    onDragEnd: () => void;
    onEdit: (shopper: ShopperRecord) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    issues?: string[]; // NEW PROP
}

export const ShopperTableRow: React.FC<ShopperTableRowProps> = ({
    shopper,
    index,
    groupKey,
    expandedRow,
    setExpandedRow,
    draggingId,
    deleteConfirmId,
    searchTerm,
    onDragStart,
    onDragEnter,
    onDragEnd,
    onEdit,
    onDelete,
    issues // Receive Issues
}) => {
    
    // Helper to visualize AA Pattern in the table
    const renderAAPatternCell = (shifts: any[]) => {
        const aaShifts = shifts.filter(s => s.type === ShiftType.AA);
        if (aaShifts.length === 0) return <span className="text-gray-300">-</span>;
        
        // Use a Map to ensure unique Weekdays. 
        // Key: DayName (e.g. "Sun"), Value: The display string (e.g. "Sun Morning")
        // We iterate chronologically, so the latest pattern for a day overwrites previous ones if they differ
        const uniqueDaysMap = new Map<string, string>();
        
        // Sort by date ensures consistent processing
        const sortedAA = [...aaShifts].sort((a, b) => a.date.localeCompare(b.date));

        sortedAA.forEach((s: any) => {
            try {
                const dateObj = getSafeDateFromKey(s.date);
                const dayName = format(dateObj, 'EEE'); // e.g. "Sun"
                const timeShort = s.time.split('(')[0].trim();
                
                // We key by 'dayName' so "Sun Morning" and "Sun Opening" don't coexist. 
                // Only one entry per day of week.
                uniqueDaysMap.set(dayName, `${dayName} ${timeShort}`);
            } catch(e) {}
        });
        
        const patterns = Array.from(uniqueDaysMap.values());
        
        if (patterns.length === 0) return <span className="text-gray-300">-</span>;
        
        return (
            <div className="flex flex-col gap-1 items-start">
                {patterns.map(p => (
                    <span key={p} className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded whitespace-nowrap">
                        {p}
                    </span>
                ))}
            </div>
        );
    };

    const status = shopper.details?.firstDayStatus;
    const recruiterInitials = shopper.details?.recruiter 
        ? shopper.details.recruiter.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : null;

    return (
        <tr 
            className={`transition-all duration-200 cursor-grab active:cursor-grabbing ${
                expandedRow === shopper.id ? 'bg-purple-50/50' : ''
            } ${
                draggingId === shopper.id 
                ? 'opacity-50 bg-blue-50 border-2 border-dashed border-blue-300 scale-[0.98]' 
                : 'hover:bg-purple-50'
            }`}
            onClick={() => setExpandedRow(expandedRow === shopper.id ? null : shopper.id)}
            draggable={!searchTerm} // Disable drag when filtering
            onDragStart={(e) => onDragStart(e, index, groupKey, shopper.id)}
            onDragEnter={(e) => onDragEnter(e, index, groupKey)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
        >
            <td className="px-2 text-center text-gray-300" onClick={(e) => e.stopPropagation()}>
                <GripVertical className={`w-4 h-4 mx-auto ${draggingId === shopper.id ? 'text-blue-500' : ''}`} />
            </td>
            <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3 relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0 relative">
                    {shopper.name.substring(0,2).toUpperCase()}
                    {recruiterInitials && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center border border-white shadow-sm" title={`Recruiter: ${shopper.details.recruiter}`}>
                            {recruiterInitials}
                        </div>
                    )}
                </div>
                {shopper.name}
                
                {/* ISSUE INDICATOR */}
                {issues && issues.length > 0 && (
                    <div className="group relative ml-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 cursor-help" />
                        {/* Tooltip */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 hidden group-hover:block shadow-xl">
                            <strong className="block mb-1 text-red-300 uppercase tracking-wider">Compliance Issues</strong>
                            <ul className="list-disc pl-3 space-y-1">
                                {issues.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                            {/* Arrow */}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-gray-900"></div>
                        </div>
                    </div>
                )}
            </td>
            <td className="px-6 py-4 text-gray-500">
                <div className="flex items-center gap-2">
                    {shopper.details?.firstWorkingDay ? format(getSafeDateFromKey(shopper.details.firstWorkingDay), 'EEE, MMM d') : '-'}
                    
                    {/* ATTENDANCE BADGE */}
                    {status === 'SHOWED_UP' && (
                        <span className="text-green-600 bg-green-50 rounded-full p-0.5" title="Showed Up"><CheckCircle2 className="w-4 h-4" /></span>
                    )}
                    {status === 'NO_SHOW' && (
                        <span className="text-red-600 bg-red-50 rounded-full p-0.5" title="No Show"><XCircle className="w-4 h-4" /></span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex justify-center gap-2">
                    {shopper.details?.usePicnicBus && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold border border-green-200" title="Uses Bus">BUS</span>
                    )}
                    {shopper.details?.isRandstad && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold border border-blue-200" title="Randstad Agency">RND</span>
                    )}
                    {shopper.details?.pnNumber && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-mono border border-gray-200" title={`PN: ${shopper.details.pnNumber}`}>PN</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                {renderAAPatternCell(shopper.shifts)}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(shopper); }} 
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" 
                        title="Edit Shopper"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => onDelete(e, shopper.id)} 
                        className={`p-2 rounded-lg transition-all border ${
                            deleteConfirmId === shopper.id 
                            ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 w-24 text-center' 
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50 border-transparent'
                        }`} 
                        title="Delete Record"
                    >
                        {deleteConfirmId === shopper.id ? <span className="text-xs font-bold">Confirm?</span> : <Trash2 className="w-4 h-4" />}
                    </button>
                </div>
            </td>
        </tr>
    );
};
