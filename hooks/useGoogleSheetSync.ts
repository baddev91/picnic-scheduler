
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShopperRecord } from '../types';
import { GOOGLE_CLIENT_ID, GOOGLE_SPREADSHEET_ID, SHEET_TAB_NAME, GOOGLE_SHEET_CSV_URL } from '../constants';

interface SyncResult {
  updatedCount: number;
  matches: string[];
}

// Declare Google Types for TypeScript
declare global {
  interface Window {
    google: any;
  }
}

export const useGoogleSheetSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
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
              fetchDataFromSheets(tokenResponse.access_token);
            } else {
              setIsSyncing(false);
              alert("Login canceled or failed.");
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
              alert("CSV seems too short (needs at least 5 rows to skip headers).");
              setIsSyncing(false);
              return;
          }

          // Skip first 4 header rows (Dashboard usually has headers in row 4, data starts row 5)
          await updateSupabase(rows.slice(4));

      } catch (e: any) {
          console.error("CSV Sync Error:", e);
          alert(`CSV Error: ${e.message}`);
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
  const fetchDataFromSheets = async (accessToken: string) => {
    try {
      // UPDATED RANGE: A4 to AE to capture Picking Speed at AD
      // Row 4 is Header, Data starts Row 5
      const range = `${SHEET_TAB_NAME}!A4:AE`; 
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}/values/${range}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to fetch sheets");
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        alert("Spreadsheet is empty or range incorrect.");
        setIsSyncing(false);
        return;
      }

      // Skip row 0 (which is Row 4 in sheet = Headers)
      await updateSupabase(rows.slice(1));

    } catch (error: any) {
      console.error("Sheet API Error:", error);
      alert(`Error fetching sheet: ${error.message}`);
      setIsSyncing(false);
    }
  };

  // 3. Match & Update Supabase OR Create New
  const updateSupabase = async (rows: any[]) => {
    console.log("Raw Sheet Rows:", rows); // DEBUG FOR USER

    let updatedCount = 0;
    let createdCount = 0;
    const newShoppersToInsert: any[] = [];

    // CRITICAL FIX: Fetch fresh DB data
    const { data: dbShoppers, error: fetchError } = await supabase.from('shoppers').select('*');
    
    if (fetchError) {
        alert("Error reading database. Sync aborted.");
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

    // OPTIONAL: Reset 'isOnSheet' for all users before marking current ones?
    // For performance, we skip this reset and just mark the found ones as true.
    // Ideally, you'd want to set everyone to false first, but that's a bulk op.

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
          isOnSheet: true, // MARK AS ON SHEET
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
            alert(`Failed to create ${newShoppersToInsert.length} new shoppers. Check console for details. Error: ${insertError.message}`);
        }
    }

    setIsSyncing(false);
    
    let message = "";
    if (updatedCount > 0) message += `✅ Updated ${updatedCount} existing profiles.\n`;
    if (createdCount > 0) message += `✨ Created ${createdCount} new profiles (hidden from main view).\n`;
    
    if (updatedCount === 0 && createdCount === 0) {
        const firstRowPreview = rows.length > 0 ? JSON.stringify(rows[0].slice(0, 3)) : "No rows";
        alert(`⚠️ Sync completed but no matches found.\n\nDebug Info:\n- Parsed Rows: ${rows.length}\n- First Row Read: ${firstRowPreview}\n- Checked Name at Index 2 (Column C).\n\nCheck if your sheet range includes Column C.`);
    } else {
        // Only show alert if user didn't provide a custom callback (to avoid double alerts in UI)
        if (!onCompleteRef) alert(message);
        if (onCompleteRef) onCompleteRef();
    }
  };

  return { isSyncing, syncShoppers };
};
