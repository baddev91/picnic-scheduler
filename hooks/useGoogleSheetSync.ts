
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShopperRecord } from '../types';
import { GOOGLE_CLIENT_ID, GOOGLE_SPREADSHEET_ID, SHEET_TAB_NAME, GOOGLE_SHEET_CSV_URL } from '../constants';
import { SyncResultData } from '../components/SyncResultModal';

// Declare Google Types for TypeScript
declare global {
  interface Window {
    google: any;
  }
}

export const useGoogleSheetSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  
  // NEW: Store the Access Token to avoid re-opening the popup
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  // NEW: State for Modal Result instead of alert
  const [syncResult, setSyncResult] = useState<SyncResultData | null>(null);
  const [onCompleteRef, setOnCompleteRef] = useState<(() => void) | undefined>(undefined);

  // Initialize Google Token Client on Mount (Only if no CSV URL is provided)
  useEffect(() => {
    if (GOOGLE_SHEET_CSV_URL) return; // Skip OAuth init if using CSV

    if (window.google && GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('INSERISCI')) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              // CACHE THE TOKEN
              setAccessToken(tokenResponse.access_token);
              fetchDataFromSheets(tokenResponse.access_token);
            } else {
              setIsSyncing(false);
              setSyncResult({
                  isOpen: true,
                  updatedCount: 0,
                  createdCount: 0,
                  totalRowsProcessed: 0,
                  isError: true,
                  errorMessage: "Login canceled or failed."
              });
            }
          },
        });
        setTokenClient(client);
      } catch (e) {
        console.error("Google Identity Services not loaded", e);
      }
    }
  }, []);

  // 1. Triggered by UI Button
  const syncShoppers = async (shoppers: ShopperRecord[], onComplete?: () => void) => {
    setIsSyncing(true);
    setSyncResult(null); // Reset previous result
    setOnCompleteRef(() => onComplete);

    // METHOD A: PUBLIC CSV (Fastest, No Login)
    if (GOOGLE_SHEET_CSV_URL) {
        await fetchCsvData();
        return;
    }

    // METHOD B: OAUTH LOGIN (Secure, Private)
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('INSERISCI')) {
      alert("Please set GOOGLE_CLIENT_ID in constants.ts first!");
      setIsSyncing(false);
      return;
    }

    // NEW LOGIC: Use Cached Token if available
    if (accessToken) {
        await fetchDataFromSheets(accessToken);
        return;
    }

    if (!tokenClient) {
      alert("Google Login Service not ready. Refresh page or check internet.");
      setIsSyncing(false);
      return;
    }

    // Request Access Token (Triggers Popup)
    tokenClient.requestAccessToken();
  };

  // --- METHOD A: CSV FETCH ---
  const fetchCsvData = async () => {
      try {
          const response = await fetch(GOOGLE_SHEET_CSV_URL);
          if (!response.ok) throw new Error("Failed to fetch CSV");
          
          const text = await response.text();
          const rows = parseCSV(text);
          
          if (rows.length < 5) {
              setSyncResult({
                  isOpen: true,
                  updatedCount: 0,
                  createdCount: 0,
                  totalRowsProcessed: rows.length,
                  isError: true,
                  errorMessage: "CSV file is too short/empty."
              });
              setIsSyncing(false);
              return;
          }

          // Skip first 4 header rows (Dashboard usually has headers in row 4, data starts row 5)
          await updateSupabase(rows.slice(4));

      } catch (e: any) {
          console.error("CSV Sync Error:", e);
          setSyncResult({
              isOpen: true,
              updatedCount: 0,
              createdCount: 0,
              totalRowsProcessed: 0,
              isError: true,
              errorMessage: e.message
          });
          setIsSyncing(false);
      }
  };

  // Simple CSV Parser that handles basic quotes
  const parseCSV = (text: string): string[][] => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentVal = '';
      let insideQuote = false;
      
      for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i+1];

          if (char === '"') {
              if (insideQuote && nextChar === '"') {
                  currentVal += '"'; // Escape double quote
                  i++;
              } else {
                  insideQuote = !insideQuote;
              }
          } else if (char === ',' && !insideQuote) {
              currentRow.push(currentVal);
              currentVal = '';
          } else if ((char === '\r' || char === '\n') && !insideQuote) {
              if (currentVal || currentRow.length > 0) currentRow.push(currentVal);
              if (currentRow.length > 0) rows.push(currentRow);
              currentRow = [];
              currentVal = '';
              if (char === '\r' && nextChar === '\n') i++;
          } else {
              currentVal += char;
          }
      }
      if (currentVal || currentRow.length > 0) {
          currentRow.push(currentVal);
          rows.push(currentRow);
      }
      return rows;
  };

  // --- METHOD B: API FETCH ---
  const fetchDataFromSheets = async (token: string) => {
    try {
      // UPDATED RANGE: A4 to AE to capture Picking Speed at AD
      // Row 4 is Header, Data starts Row 5
      const range = `${SHEET_TAB_NAME}!A4:AE`; 
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}/values/${range}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // If token expired (401), clear it and retry flow manually (user has to click again for now to keep it simple)
        if (response.status === 401) {
            setAccessToken(null); 
            throw new Error("Session expired. Please click Sync again.");
        }
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to fetch sheets");
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        setSyncResult({
            isOpen: true,
            updatedCount: 0,
            createdCount: 0,
            totalRowsProcessed: 0,
            isError: true,
            errorMessage: "Spreadsheet range is empty."
        });
        setIsSyncing(false);
        return;
      }

      // Skip row 0 (which is Row 4 in sheet = Headers)
      await updateSupabase(rows.slice(1));

    } catch (error: any) {
      console.error("Sheet API Error:", error);
      setSyncResult({
          isOpen: true,
          updatedCount: 0,
          createdCount: 0,
          totalRowsProcessed: 0,
          isError: true,
          errorMessage: error.message
      });
      setIsSyncing(false);
    }
  };

  // 3. Match & Update Supabase OR Create New
  const updateSupabase = async (rows: any[]) => {
    let updatedCount = 0;
    let createdCount = 0;
    const newShoppersToInsert: any[] = [];

    // CRITICAL FIX: Fetch fresh DB data
    const { data: dbShoppers, error: fetchError } = await supabase.from('shoppers').select('*');
    
    if (fetchError) {
        setSyncResult({
            isOpen: true,
            updatedCount: 0,
            createdCount: 0,
            totalRowsProcessed: rows.length,
            isError: true,
            errorMessage: "Database Connection Error"
        });
        setIsSyncing(false);
        return;
    }

    const referenceShoppers = dbShoppers || [];

    // --- DASHBOARD Z37 MAPPING ---
    const sheetData = rows.map(row => ({
      pnNumber: row[1] ? String(row[1]).trim() : '',
      name: row[2] ? String(row[2]).trim() : '',
      activeWeeks: row[6] || '',
      late: row[13] || '',
      absence: row[14] || '',
      speedAM: row[29] || '', // AD is index 29
      notes: '' // Optional mapping
    }));

    for (const rowData of sheetData) {
      if (!rowData.name) continue;

      // Match shopper (Case Insensitive) against DB Data
      const shopper = referenceShoppers.find(s => s.name.trim().toLowerCase() === rowData.name.toLowerCase());

      const performanceMetrics = {
        activeWeeks: rowData.activeWeeks ? Number(rowData.activeWeeks) : undefined,
        absence: rowData.absence ? Number(rowData.absence) : undefined,
        late: rowData.late ? Number(rowData.late) : undefined,
        speedAM: rowData.speedAM ? Number(rowData.speedAM) : undefined,
      };

      if (shopper) {
        // --- UPDATE EXISTING ---
        const currentDetails = shopper.details || {};
        const currentPerformance = currentDetails.performance || {};

        const newDetails = {
          ...currentDetails,
          pnNumber: rowData.pnNumber || currentDetails.pnNumber,
          isOnSheet: true, // MARK AS ON SHEET (Critical for visibility)
          performance: {
            ...currentPerformance,
            ...performanceMetrics 
          }
        };

        const { error } = await supabase
          .from('shoppers')
          .update({ details: newDetails })
          .eq('id', shopper.id);

        if (!error) updatedCount++;

      } else {
        // --- PREPARE FOR CREATION (If not found) ---
        newShoppersToInsert.push({
            name: rowData.name,
            details: {
                isHiddenFromMainView: true,
                isOnSheet: true, // MARK AS ON SHEET
                pnNumber: rowData.pnNumber,
                notes: '',
                performance: performanceMetrics,
                // Default required fields to avoid UI crashes
                usePicnicBus: null, 
                civilStatus: 'unknown', 
                clothingSize: 'M', 
                shoeSize: '40', 
                gloveSize: '8 (M)', 
                isRandstad: false
            }
        });
      }
    }

    // Batch Insert New Shoppers
    if (newShoppersToInsert.length > 0) {
        const { error: insertError } = await supabase.from('shoppers').insert(newShoppersToInsert);
        if (!insertError) {
            createdCount = newShoppersToInsert.length;
        } else {
            console.error("Error creating new shoppers from sheet:", insertError);
            setSyncResult({
                isOpen: true,
                updatedCount,
                createdCount: 0,
                totalRowsProcessed: rows.length,
                isError: true,
                errorMessage: `Partial Failure: Updated ${updatedCount} but failed to create new profiles. Error: ${insertError.message}`
            });
            setIsSyncing(false);
            return;
        }
    }

    setIsSyncing(false);
    
    // SUCCESS MODAL STATE
    setSyncResult({
        isOpen: true,
        updatedCount,
        createdCount,
        totalRowsProcessed: rows.length,
        isError: false
    });

    if (onCompleteRef) onCompleteRef();
  };

  const closeSyncModal = () => setSyncResult(null);

  return { isSyncing, syncShoppers, syncResult, closeSyncModal };
};
