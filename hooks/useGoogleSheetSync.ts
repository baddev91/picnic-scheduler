
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
          
          if (rows.length < 2) {
              alert("CSV seems empty or invalid (less than 2 rows).");
              setIsSyncing(false);
              return;
          }

          // Skip header row (index 0) and process
          await updateSupabase(rows.slice(1));

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
      const range = `${SHEET_TAB_NAME}!A2:G`; // Read A to G, starting row 2
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

      await updateSupabase(rows);

    } catch (error: any) {
      console.error("Sheet API Error:", error);
      alert(`Error fetching sheet: ${error.message}`);
      setIsSyncing(false);
    }
  };

  // 3. Match & Update Supabase OR Create New
  const updateSupabase = async (rows: any[]) => {
    let updatedCount = 0;
    let createdCount = 0;
    const newShoppersToInsert: any[] = [];

    // CRITICAL FIX: Fetch fresh DB data to ensure we don't duplicate existing users
    // or fail to update users that were just created.
    const { data: dbShoppers, error: fetchError } = await supabase.from('shoppers').select('*');
    
    if (fetchError) {
        alert("Error reading database. Sync aborted.");
        setIsSyncing(false);
        return;
    }

    const referenceShoppers = dbShoppers || [];

    // Map rows to object structure
    // Assumes structure: [Name, PN, ActiveWeeks, Absence, Late, Speed, Notes]
    const sheetData = rows.map(row => ({
      name: row[0] ? String(row[0]).trim() : '',
      pnNumber: row[1] ? String(row[1]).trim() : '',
      activeWeeks: row[2] || '',
      absence: row[3] || '',
      late: row[4] || '',
      speedAM: row[5] || '',
      notes: row[6] || ''
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

        // Merge notes logic
        let newNotes = currentDetails.notes;
        if (rowData.notes) {
             const noteText = String(rowData.notes).trim();
             if (!currentDetails.notes?.includes(noteText)) {
                 newNotes = `${currentDetails.notes || ''}\n[Sheet]: ${noteText}`.trim();
             }
        }

        const newDetails = {
          ...currentDetails,
          pnNumber: rowData.pnNumber || currentDetails.pnNumber,
          notes: newNotes,
          performance: {
            ...currentPerformance,
            ...performanceMetrics // Overwrite with non-undefined values
          }
        };

        const { error } = await supabase
          .from('shoppers')
          .update({ details: newDetails })
          .eq('id', shopper.id);

        if (!error) updatedCount++;

      } else {
        // --- PREPARE FOR CREATION (If not found) ---
        // We set 'isHiddenFromMainView' to true so they don't appear in the Scheduling Dashboard
        newShoppersToInsert.push({
            name: rowData.name,
            details: {
                isHiddenFromMainView: true,
                pnNumber: rowData.pnNumber,
                notes: rowData.notes ? `[Sheet Imported]: ${rowData.notes}` : '',
                performance: performanceMetrics,
                // Default required fields to avoid UI crashes if viewed elsewhere
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
        alert(`⚠️ Sync completed but no changes were made.\nParsed ${sheetData.length} rows from sheet.\nFound ${sheetData.filter(r => r.name).length} valid names.`);
    } else {
        alert(message);
        if (onCompleteRef) onCompleteRef();
    }
  };

  return { isSyncing, syncShoppers };
};
