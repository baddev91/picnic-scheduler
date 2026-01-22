
import React, { useState, useEffect } from 'react';
import { User, MapPin, Sheet, Copy, FileSpreadsheet, Calendar, Star, CheckCircle, XCircle, Clock, AlertTriangle, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ShopperRecord, ShiftType } from '../../types';
import { 
    generateSpreadsheetRow, 
    generateHRSpreadsheetRow, 
    generateHRSpreadsheetHTML 
} from '../../utils/clipboardExport';

interface ShopperExpandedDetailsProps {
    shopper: ShopperRecord;
    onStatusUpdate?: (id: string, status: 'PENDING' | 'SHOWED_UP' | 'NO_SHOW') => void;
}

export const ShopperExpandedDetails: React.FC<ShopperExpandedDetailsProps> = ({ shopper, onStatusUpdate }) => {
    // Local state for confirmation flow
    const [pendingStatus, setPendingStatus] = useState<'PENDING' | 'SHOWED_UP' | 'NO_SHOW' | null>(null);

    // Reset pending status if shopper data updates externally
    useEffect(() => {
        setPendingStatus(null);
    }, [shopper.details?.firstDayStatus]);
    
    // --- COPY HANDLERS (Local to the item) ---
    const handleCopyForSheet = (weekOffset: number) => {
        try {
            const rowString = generateSpreadsheetRow(shopper, weekOffset);
            navigator.clipboard.writeText(rowString);
            const whichWeek = weekOffset === 0 ? "Week 1" : "Week 2";
            alert(`Copied ${whichWeek} data for ${shopper.name}!\n\nPN: ${shopper.details?.pnNumber || 'Not Set'}\n\nReady to paste into spreadsheet.`);
        } catch (e: any) {
            alert(e.message);
        }
    };
  
    const handleCopyLSInflow = async () => {
        try {
            const text = generateHRSpreadsheetRow(shopper);
            const html = generateHRSpreadsheetHTML(shopper);
  
            if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
               try {
                   const textBlob = new Blob([text], { type: 'text/plain' });
                   const htmlBlob = new Blob([html], { type: 'text/html' });
                   await navigator.clipboard.write([
                       new ClipboardItem({ 'text/plain': textBlob, 'text/html': htmlBlob })
                   ]);
               } catch (err) {
                   await navigator.clipboard.writeText(text);
               }
            } else {
               await navigator.clipboard.writeText(text);
            }
            alert(`Copied LS Inflow Data for ${shopper.name}!\n\nReady to paste.`);
        } catch(e: any) {
            alert("Clipboard error: " + e.message);
        }
    };

    // --- STATUS FLOW HANDLERS ---
    const initiateStatusChange = (newStatus: 'PENDING' | 'SHOWED_UP' | 'NO_SHOW') => {
        // Current effective status (treat undefined as PENDING)
        const currentStatus = shopper.details?.firstDayStatus || 'PENDING';
        
        // If trying to switch to what is already selected, ignore
        if (newStatus === currentStatus) return;

        // Set pending to show confirmation UI
        setPendingStatus(newStatus);
    };

    const confirmStatusChange = () => {
        if (pendingStatus && onStatusUpdate) {
            onStatusUpdate(shopper.id, pendingStatus);
            setPendingStatus(null);
        }
    };

    const cancelStatusChange = () => {
        setPendingStatus(null);
    };

    const formatDateDisplay = (dateStr: string) => {
        if(!dateStr) return 'N/A';
        try { return format(new Date(dateStr), 'EEE, MMM do, yyyy'); } catch (e) { return dateStr; }
    };

    const currentStatus = shopper.details?.firstDayStatus || 'PENDING';

    return (
        <div className="bg-gray-50/50 px-4 py-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                {/* LEFT COL: Personal Details */}
                <div className="space-y-3 text-sm text-gray-600 md:border-r md:pr-6">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2"><User className="w-4 h-4" /> Personal Details</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <span>Clothing: <strong>{shopper.details?.clothingSize}</strong></span>
                        <span>Shoes: <strong>{shopper.details?.shoeSize}</strong></span>
                        <span>Gloves: <strong>{shopper.details?.gloveSize}</strong></span>
                        <span>Status: <strong>{shopper.details?.civilStatus}</strong></span>
                        <span>Gender: <strong>{shopper.details?.gender || 'N/D'}</strong></span>
                        {shopper.details?.pnNumber && (
                            <span className="col-span-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded w-fit mt-1">
                                PN: <strong>{shopper.details.pnNumber}</strong>
                            </span>
                        )}
                    </div>
                    {shopper.details?.isRandstad && (
                        <div className="mt-2 pt-2 border-t">
                            <div className="flex items-start gap-2 text-xs"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{shopper.details?.address || 'No address provided'}</div>
                        </div>
                    )}
                    
                    {/* EXPORT BUTTONS */}
                    <div className="mt-4 pt-4 border-t space-y-3">
                        <h5 className="font-bold text-gray-900 text-xs uppercase flex items-center gap-2"><Sheet className="w-3 h-3 text-green-600" /> Google Sheets Export</h5>
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleCopyForSheet(0); }}
                                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/30 hover:shadow-md transition-all group text-center"
                            >
                                <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-green-100 text-gray-500 group-hover:text-green-600 transition-colors">
                                    <Copy className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-700 group-hover:text-green-800">Copy Week 1</span>
                            </button>

                            <button 
                                onClick={(e) => { e.stopPropagation(); handleCopyForSheet(1); }}
                                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/30 hover:shadow-md transition-all group text-center"
                            >
                                <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-green-100 text-gray-500 group-hover:text-green-600 transition-colors">
                                    <Copy className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-700 group-hover:text-green-800">Copy Week 2</span>
                            </button>

                            <button 
                                onClick={(e) => { e.stopPropagation(); handleCopyLSInflow(); }}
                                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/30 hover:shadow-md transition-all group text-center"
                            >
                                <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-blue-100 text-gray-500 group-hover:text-blue-600 transition-colors">
                                    <FileSpreadsheet className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-800">Copy LS Inflow</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COL: Shifts Grid */}
                <div className="col-span-2">
                    
                    {/* ATTENDANCE CHECK CONTROL */}
                    {onStatusUpdate && (
                        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden transition-all duration-300">
                            
                            {/* Title */}
                            <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-purple-600" /> 
                                Attendance Check (First Day)
                            </h4>

                            {/* Main Buttons (Hidden when pending confirmation) */}
                            {!pendingStatus && (
                                <div className="flex gap-2 animate-in fade-in">
                                    <button 
                                        onClick={() => initiateStatusChange('PENDING')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
                                            currentStatus === 'PENDING'
                                            ? 'bg-gray-100 text-gray-700 border-gray-300 shadow-inner'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Clock className="w-3.5 h-3.5" /> Pending
                                    </button>
                                    <button 
                                        onClick={() => initiateStatusChange('SHOWED_UP')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
                                            currentStatus === 'SHOWED_UP'
                                            ? 'bg-green-100 text-green-700 border-green-300 shadow-inner ring-1 ring-green-200'
                                            : 'bg-white text-green-600 border-gray-200 hover:bg-green-50 hover:border-green-200'
                                        }`}
                                    >
                                        <CheckCircle className="w-3.5 h-3.5" /> Showed Up
                                    </button>
                                    <button 
                                        onClick={() => initiateStatusChange('NO_SHOW')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
                                            currentStatus === 'NO_SHOW'
                                            ? 'bg-red-100 text-red-700 border-red-300 shadow-inner ring-1 ring-red-200'
                                            : 'bg-white text-red-600 border-gray-200 hover:bg-red-50 hover:border-red-200'
                                        }`}
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> No Show
                                    </button>
                                </div>
                            )}

                            {/* CONFIRMATION OVERLAY */}
                            {pendingStatus && (
                                <div className="absolute inset-0 bg-white z-10 flex items-center justify-between px-4 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                                        <span>
                                            Change to <span className={`uppercase px-1.5 py-0.5 rounded ${
                                                pendingStatus === 'SHOWED_UP' ? 'bg-green-100 text-green-700' :
                                                pendingStatus === 'NO_SHOW' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                            }`}>{pendingStatus.replace('_', ' ')}</span>?
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={cancelStatusChange}
                                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 transition-colors"
                                            title="Cancel"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={confirmStatusChange}
                                            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-black transition-colors flex items-center gap-1 shadow-sm"
                                        >
                                            <Check className="w-3 h-3" /> Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm"><Calendar className="w-4 h-4" /> All Selected Shifts ({(shopper.shifts || []).length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(shopper.shifts || []).length > 0 ? (
                            [...(shopper.shifts || [])]
                              .sort((a: any, b: any) => a.date.localeCompare(b.date))
                              .map((shift: any, idx: number) => {
                                  // Check if this is the First Working Day
                                  const isFWD = shopper.details?.firstWorkingDay === shift.date;
                                  
                                  let styleClass = '';
                                  if (isFWD) {
                                      styleClass = 'bg-yellow-50 border-yellow-300 text-yellow-800 ring-1 ring-yellow-200';
                                  } else if (shift.type === ShiftType.AA) {
                                      styleClass = 'bg-red-50 border-red-100 text-red-700';
                                  } else {
                                      styleClass = 'bg-green-50 border-green-100 text-green-700';
                                  }

                                  return (
                                    <div key={idx} className={`relative p-2 rounded border text-xs flex flex-col justify-center ${styleClass}`}>
                                        {isFWD && (
                                            <div className="absolute top-1 right-1">
                                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-600" />
                                            </div>
                                        )}
                                        <div className="font-bold">{formatDateDisplay(shift.date)}</div>
                                        <div className="truncate pr-4" title={shift.time}>
                                            {shift.time.split('(')[0]}
                                        </div>
                                    </div>
                                  );
                              })
                        ) : <span className="text-gray-400 italic text-sm">No shifts selected</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};
