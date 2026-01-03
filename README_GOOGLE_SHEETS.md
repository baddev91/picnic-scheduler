# Google Sheets Sync Setup

To enable the "Sync to Google Drive" feature, follow these steps exactly:

### 1. Create the Google Sheet
1. Go to [Google Sheets](https://sheets.google.com) and create a new blank sheet.
2. Name it "Picnic Shifts" (or whatever you like).
3. Set up the **Header Row** (Row 1) with these exact values:
   - Cell A1: `Name`
   - Cell B1: `First Working Day`
   - Cell C1: `Bus`
   - Cell D1: `Civil Status`
   - Cell E1: `Clothing`
   - Cell F1: `Shoe`
   - Cell G1: `Glove`
   - Cell H1: `Randstad`
   - Cell I1: `Address`
   - Cell J1 -> U1: `Shift 1`, `Shift 2`, `Shift 3` ... up to `Shift 12`

### 2. Add the Script
1. In the Google Sheet, click on **Extensions** > **Apps Script** in the top menu.
2. Delete any code currently in the `Code.gs` file.
3. Paste the code below:

```javascript
// --- CONFIGURAZIONE ---
var SHEET_ID = ""; // Optional: Leave empty if script is bound to the sheet
var AVAILABILITY_TAB_NAME = "Availability";
var OUTPUT_TAB_NAME = "Sheet1"; // Or the name of the tab where you want to save shifts

// --- READ AVAILABILITY (GET) ---
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AVAILABILITY_TAB_NAME);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({error: "Tab 'Availability' not found"})).setMimeType(ContentService.MimeType.JSON);
  }

  // Expects Col A = Date (YYYY-MM-DD), Col B = Time (e.g., "Morning"), Col C = Type ("AA", "Standard")
  var data = sheet.getDataRange().getValues();
  var availability = {};

  // Skip header row (start at 1)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dateStr = formatDate(row[0]); 
    var shiftName = row[1]; 
    var type = row[2];

    if (!availability[dateStr]) availability[dateStr] = {};
    if (!availability[dateStr][shiftName]) availability[dateStr][shiftName] = [];
    
    availability[dateStr][shiftName].push(type);
  }

  return ContentService.createTextOutput(JSON.stringify(availability)).setMimeType(ContentService.MimeType.JSON);
}

// --- WRITE SHIFTS (POST) ---
function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var payload = JSON.parse(jsonString);
    var rows = payload.data; // Array of shopper objects

    if (!rows || rows.length === 0) {
      return ContentService.createTextOutput("No data received");
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OUTPUT_TAB_NAME);
    if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Map object to array based on the new header structure
    // Columns: Name, FWD, Bus, Civil, Clothing, Shoe, Glove, Randstad, Address, Shift 1...12
    var valuesToAdd = rows.map(function(r) {
      return [
        r.name,
        r.firstWorkingDay,
        r.bus,
        r.civilStatus,
        r.clothing,
        r.shoe,
        r.glove,
        r.randstad,
        r.address,
        r.shift_1 || "",
        r.shift_2 || "",
        r.shift_3 || "",
        r.shift_4 || "",
        r.shift_5 || "",
        r.shift_6 || "",
        r.shift_7 || "",
        r.shift_8 || "",
        r.shift_9 || "",
        r.shift_10 || "",
        r.shift_11 || "",
        r.shift_12 || ""
      ];
    });

    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, valuesToAdd.length, valuesToAdd[0].length).setValues(valuesToAdd);
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function formatDate(date) {
  if (!date) return "";
  if (typeof date === 'string') return date;
  var d = new Date(date);
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}
```

### 3. Deploy as Web App
1. Click the blue **Deploy** button (top right) > **New deployment**.
2. Click the gear icon (Select type) > **Web app**.
3. **Description**: "Shift Sync v2"
4. **Execute as**: `Me` (your email).
5. **Who has access**: **Anyone** (Crucial!).
6. Click **Deploy**.
7. Copy the **Web App URL**.

### 4. Configure App
1. Update the URL in the Admin section of your web app.
