
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShopperRecord } from '../types';
import { GOOGLE_CLIENT_ID, GOOGLE_SPREADSHEET_ID, SHEET_TAB_NAME } from '../constants';

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
  const [shoppersRef, setShoppersRef] = useState<ShopperRecord[]>([]);
  const [onCompleteRef, setOnCompleteRef] = useState<(() => void) | undefined>(undefined);

  // Initialize Google Token Client on Mount
  useEffect(() => {
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
  const syncShoppers = (shoppers: ShopperRecord[], onComplete?: () => void) => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('INSERISCI')) {
      alert("Please set GOOGLE_CLIENT_ID in constants.ts first!");
      return;
    }
    if (!tokenClient) {
      alert("Google Login Service not ready. Refresh page or check internet.");
      return;
    }

    setIsSyncing(true);
    setShoppersRef(shoppers); // Store current shoppers to use after async login
    setOnCompleteRef(() => onComplete);

    // Request Access Token (Triggers Popup)
    tokenClient.requestAccessToken();
  };

  // 2. Fetch Data using Token
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

  // 3. Match & Update Supabase
  const updateSupabase = async (rows: any[]) => {
    let updatedCount = 0;
    const matches: string[] = [];

    // Map rows to object structure
    // Assumes structure: [Name, PN, ActiveWeeks, Absence, Late, Speed, Notes]
    const sheetData = rows.map(row => ({
      name: row[0],
      pnNumber: row[1],
      activeWeeks: row[2],
      absence: row[3],
      late: row[4],
      speedAM: row[5],
      notes: row[6]
    }));

    for (const rowData of sheetData) {
      if (!rowData.name) continue;

      // Match shopper (Case Insensitive)
      const shopper = shoppersRef.find(s => s.name.trim().toLowerCase() === String(rowData.name).trim().toLowerCase());

      if (shopper) {
        const currentDetails = shopper.details || {};
        const currentPerformance = currentDetails.performance || {};

        // Merge logic
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
            activeWeeks: rowData.activeWeeks ? Number(rowData.activeWeeks) : currentPerformance.activeWeeks,
            absence: rowData.absence ? Number(rowData.absence) : currentPerformance.absence,
            late: rowData.late ? Number(rowData.late) : currentPerformance.late,
            speedAM: rowData.speedAM ? Number(rowData.speedAM) : currentPerformance.speedAM,
          }
        };

        const { error } = await supabase
          .from('shoppers')
          .update({ details: newDetails })
          .eq('id', shopper.id);

        if (!error) {
          updatedCount++;
          matches.push(shopper.name);
        }
      }
    }

    setIsSyncing(false);
    if (updatedCount > 0) {
      alert(`✅ Successfully synced ${updatedCount} shoppers from Google Sheets!`);
      if (onCompleteRef) onCompleteRef();
    } else {
      alert("⚠️ No matching shoppers found in the spreadsheet.");
    }
  };

  return { isSyncing, syncShoppers };
};
