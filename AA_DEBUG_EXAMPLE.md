# 🐛 ESEMPIO PRATICO DI DEBUGGING: Shopper con 1 AA invece di 2

## 📊 SCENARIO REALE

**Shopper**: Mario Rossi  
**Nazionalità**: Poland (EU)  
**AA Selezionati**: Sabato Morning + Domenica Afternoon  
**Problema**: Admin vede solo "Sun Afternoon" nella colonna AA Pattern

---

## 🔍 STEP-BY-STEP DEBUGGING

### **STEP 1: Verificare localStorage**

**Azione**: Aprire DevTools → Console → Eseguire:
```javascript
JSON.parse(localStorage.getItem('picnic_shopper_session'))
```

**Output Atteso**:
```json
{
  "name": "Mario Rossi",
  "step": 2,
  "selections": [...],
  "aaSelections": [
    { "dayIndex": 6, "time": "Morning (06:00 - 14:00)" },
    { "dayIndex": 0, "time": "Afternoon (14:00 - 22:00)" }
  ]
}
```

**✅ VERIFICA**: `aaSelections` contiene 2 elementi con `dayIndex` 6 (Sabato) e 0 (Domenica)

**❌ SE MANCA**: Il problema è nella selezione iniziale (improbabile, validazione è robusta)

---

### **STEP 2: Verificare savedCloudTemplate**

**Azione**: In `App.tsx`, aggiungere temporaneamente:
```typescript
console.log('savedCloudTemplate:', savedCloudTemplate);
```

**Output da Controllare**:
```json
{
  "6": {
    "Morning (06:00 - 14:00)": ["STANDARD"],  // ❌ PROBLEMA: Manca "AA"
    "Afternoon (14:00 - 22:00)": ["AA", "STANDARD"]
  },
  "0": {
    "Morning (06:00 - 14:00)": ["AA", "STANDARD"],
    "Afternoon (14:00 - 22:00)": ["AA", "STANDARD"]
  }
}
```

**🔥 ROOT CAUSE IDENTIFICATA**: 
- Sabato Morning ha solo `["STANDARD"]`
- Domenica Afternoon ha `["AA", "STANDARD"]` ✅
- Risultato: Sabato viene filtrato, Domenica passa

---

### **STEP 3: Verificare adminAvailability**

**Azione**: In `finalizeAASubmission()`, aggiungere:
```typescript
while (currentDate <= range.end) {
    if (isBefore(currentDate, minDate)) { currentDate = addDays(currentDate, 1); continue; }
    const dayIndex = getDay(currentDate);
    const dateStr = formatDateKey(currentDate);
    
    const selectionForDay = aaSelections.find(s => s.dayIndex === dayIndex);
    
    if (selectionForDay && selectionForDay.time) {
        console.log(`[AA DEBUG] Date: ${dateStr}, Day: ${dayIndex}, Time: ${selectionForDay.time}`);
        console.log(`[AA DEBUG] adminAvailability[${dateStr}]:`, adminAvailability[dateStr]);
        
        const checkAvailability = (t: ShiftTime) => {
            if (adminAvailability[dateStr]) {
                const config = adminAvailability[dateStr];
                const result = (!config[t] || config[t]?.includes(ShiftType.AA));
                console.log(`[AA DEBUG] Admin check result: ${result}`);
                return result;
            }
            if (savedCloudTemplate && savedCloudTemplate[dayIndex]) {
                const result = savedCloudTemplate[dayIndex][t]?.includes(ShiftType.AA);
                console.log(`[AA DEBUG] Template check result: ${result}`);
                return result;
            }
            console.log(`[AA DEBUG] Default: true`);
            return true;
        };
        
        if (checkAvailability(selectionForDay.time)) {
            console.log(`[AA DEBUG] ✅ ADDED to newShifts`);
            newShifts.push({ date: dateStr, time: selectionForDay.time, type: ShiftType.AA });
        } else {
            console.log(`[AA DEBUG] ❌ FILTERED OUT`);
        }
    }
    currentDate = addDays(currentDate, 1);
}
```

**Output Console Atteso**:
```
[AA DEBUG] Date: 2026-02-08, Day: 6, Time: Morning (06:00 - 14:00)
[AA DEBUG] adminAvailability[2026-02-08]: undefined
[AA DEBUG] Template check result: false
[AA DEBUG] ❌ FILTERED OUT

[AA DEBUG] Date: 2026-02-09, Day: 0, Time: Afternoon (14:00 - 22:00)
[AA DEBUG] adminAvailability[2026-02-09]: undefined
[AA DEBUG] Template check result: true
[AA DEBUG] ✅ ADDED to newShifts

[AA DEBUG] Date: 2026-02-15, Day: 6, Time: Morning (06:00 - 14:00)
[AA DEBUG] adminAvailability[2026-02-15]: undefined
[AA DEBUG] Template check result: false
[AA DEBUG] ❌ FILTERED OUT

[AA DEBUG] Date: 2026-02-16, Day: 0, Time: Afternoon (14:00 - 22:00)
[AA DEBUG] adminAvailability[2026-02-16]: undefined
[AA DEBUG] Template check result: true
[AA DEBUG] ✅ ADDED to newShifts

... (continua per 8 settimane)
```

**🔥 CONFERMA**: Sabato viene filtrato OGNI settimana, Domenica passa OGNI settimana

---

### **STEP 4: Verificare lo stato finale prima del submit**

**Azione**: In `handleSubmitData()`, aggiungere:
```typescript
const handleSubmitData = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
        const shopper = selections[0];
        
        console.log('[SUBMIT DEBUG] Total shifts:', shopper.shifts.length);
        console.log('[SUBMIT DEBUG] AA shifts:', shopper.shifts.filter(s => s.type === ShiftType.AA));
        
        const aaShifts = shopper.shifts.filter(s => s.type === ShiftType.AA);
        const uniqueDays = new Set(aaShifts.map(s => getDay(getSafeDateFromKey(s.date))));
        console.log('[SUBMIT DEBUG] Unique AA days:', Array.from(uniqueDays));
        
        // ... resto del codice
```

**Output Console Atteso**:
```
[SUBMIT DEBUG] Total shifts: 10
[SUBMIT DEBUG] AA shifts: [
  { date: '2026-02-09', time: 'Afternoon (14:00 - 22:00)', type: 'AA' },
  { date: '2026-02-16', time: 'Afternoon (14:00 - 22:00)', type: 'AA' },
  { date: '2026-02-23', time: 'Afternoon (14:00 - 22:00)', type: 'AA' },
  ...
]
[SUBMIT DEBUG] Unique AA days: [0]  // ❌ Solo Domenica (0)
```

**🔥 CONFERMA**: Solo 1 giorno AA unico (Domenica) invece di 2

---

### **STEP 5: Verificare il database**

**Azione**: Dopo il submit, controllare Supabase:
```sql
SELECT id, name, details->>'firstWorkingDay' as fwd 
FROM shoppers 
WHERE name = 'Mario Rossi';

-- Assumendo id = 123
SELECT date, time, type 
FROM shifts 
WHERE shopper_id = 123 
ORDER BY date;
```

**Output Atteso**:
```
| date       | time                        | type     |
|------------|-----------------------------|----------|
| 2026-02-10 | Morning (06:00 - 14:00)     | STANDARD |
| 2026-02-09 | Afternoon (14:00 - 22:00)   | AA       |
| 2026-02-16 | Afternoon (14:00 - 22:00)   | AA       |
| 2026-02-23 | Afternoon (14:00 - 22:00)   | AA       |
| ...        | ...                         | ...      |
```

**Verifica giorni AA unici**:
```sql
SELECT DISTINCT EXTRACT(DOW FROM date::date) as day_of_week
FROM shifts
WHERE shopper_id = 123 AND type = 'AA';
```

**Output**:
```
| day_of_week |
|-------------|
| 0           |  -- Solo Domenica
```

**🔥 CONFERMA FINALE**: Nel database c'è solo 1 giorno AA (Domenica)

---

## 🎯 CONCLUSIONE

**ROOT CAUSE CONFERMATA**:
1. `savedCloudTemplate[6]["Morning (06:00 - 14:00)"]` = `["STANDARD"]` (manca "AA")
2. `finalizeAASubmission()` filtra tutti i Sabati Morning
3. Solo le Domeniche Afternoon vengono salvate
4. Risultato: 1 giorno AA invece di 2

**SOLUZIONE**:
Rimuovere il filtro di disponibilità per AA in `finalizeAASubmission()` come descritto in `AA_SYSTEM_FIXES.md`

---

## 🛠️ QUICK FIX PER QUESTO SHOPPER

**Opzione 1: Correggere il Template**
```typescript
// In Admin, modificare il template:
savedCloudTemplate[6]["Morning (06:00 - 14:00)"] = ["AA", "STANDARD"];
```

**Opzione 2: Modificare Manualmente il Database**
```sql
-- Aggiungere shift AA per i Sabati mancanti
INSERT INTO shifts (shopper_id, date, time, type)
VALUES 
  (123, '2026-02-08', 'Morning (06:00 - 14:00)', 'AA'),
  (123, '2026-02-15', 'Morning (06:00 - 14:00)', 'AA'),
  (123, '2026-02-22', 'Morning (06:00 - 14:00)', 'AA');
```

**Opzione 3: Usare Edit Modal**
- Aprire Edit Shopper Modal per Mario Rossi
- Aggiungere manualmente gli shift AA per Sabato
- Salvare

---

**FINE DOCUMENTO**

