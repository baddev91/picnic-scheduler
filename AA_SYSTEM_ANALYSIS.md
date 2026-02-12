# 🔍 ANALISI APPROFONDITA SISTEMA AA (Agreed Availability)

## 📋 EXECUTIVE SUMMARY

**PROBLEMA IDENTIFICATO**: In alcuni casi, gli shopper risultano avere solo 1 giorno AA invece dei 2 richiesti.

**ROOT CAUSE PRINCIPALE**: **Filtro di disponibilità in `finalizeAASubmission()` che può escludere shift AA validi**

---

## 🎯 FLUSSO COMPLETO DEL SISTEMA AA

### 1️⃣ **SELEZIONE AA (ShopperAAWizard.tsx)**

**Stato**: `aaSelections: { dayIndex: number; time: ShiftTime | null }[]`

**Validazione UI**:
- ✅ Massimo 2 giorni totali (linea 61)
- ✅ Massimo 1 giorno infrasettimanale (linea 65)
- ✅ Almeno 1 giorno weekend richiesto (linea 309)
- ✅ Rest Rule tra giorni adiacenti (linee 94-101)
- ✅ Template availability check (linee 50-54, 72-75)

**Validazione Submit** (`handleAAWizardSubmit` - ShopperApp.tsx:286-347):
```typescript
// Linea 288-291: Verifica esattamente 2 giorni
if (aaSelections.length !== 2) { 
    alert("Please select exactly 2 days for your AA pattern."); 
    return; 
}

// Linea 294-297: Verifica che tutti abbiano un time
if (aaSelections.some(s => !s.time)) {
    alert("Please select a shift time for every selected day.");
    return;
}

// Linea 300-311: Verifica regole weekday/weekend
const weekdays = aaSelections.filter(s => s.dayIndex >= 1 && s.dayIndex <= 5);
const weekends = aaSelections.filter(s => s.dayIndex === 0 || s.dayIndex === 6);

if (weekdays.length > 1) {
    alert("You can select a maximum of 1 Weekday (Mon-Fri).");
    return;
}

if (weekends.length === 0) {
     alert("You must select at least 1 Weekend day.");
     return;
}
```

**✅ CONCLUSIONE STEP 1**: La validazione è ROBUSTA. Non è possibile procedere senza 2 giorni validi.

---

### 2️⃣ **FINALIZZAZIONE AA (finalizeAASubmission - ShopperApp.tsx:350-396)**

**⚠️ CRITICAL SECTION - QUI SI VERIFICA IL PROBLEMA**

```typescript
const finalizeAASubmission = () => {
    const range = getShopperAllowedRange();  // Range di 8 settimane
    const newShifts: ShopperShift[] = [];
    let currentDate = range.start;
    const minDate = getShopperMinDate();     // Data minima basata su nazionalità
    
    while (currentDate <= range.end) {
        if (isBefore(currentDate, minDate)) { 
            currentDate = addDays(currentDate, 1); 
            continue;  // ⚠️ SKIP: Date prima del minDate
        }
        
        const dayIndex = getDay(currentDate);
        const dateStr = formatDateKey(currentDate);
        
        const selectionForDay = aaSelections.find(s => s.dayIndex === dayIndex);

        if (selectionForDay && selectionForDay.time) {
            // 🔥 AVAILABILITY CHECK - POTENZIALE FILTRO
            const checkAvailability = (t: ShiftTime) => {
                if (adminAvailability[dateStr]) {
                    const config = adminAvailability[dateStr];
                    return (!config[t] || config[t]?.includes(ShiftType.AA));
                }
                // Fallback to Template
                if (savedCloudTemplate && savedCloudTemplate[dayIndex]) {
                    return savedCloudTemplate[dayIndex][t]?.includes(ShiftType.AA);
                }
                return true;
            };
            
            // ⚠️ FILTRO: Se checkAvailability ritorna false, lo shift NON viene aggiunto
            if (checkAvailability(selectionForDay.time)) {
                newShifts.push({ date: dateStr, time: selectionForDay.time, type: ShiftType.AA });
            }
        }
        currentDate = addDays(currentDate, 1);
    }
    
    // Salva gli shift (potenzialmente filtrati)
    setSelections([{ name: shopperName, shifts: newShifts, details: newDetails }]);
    setStep(ShopperStep.FWD_SELECTION);
};
```

---

## 🚨 SCENARI PROBLEMATICI IDENTIFICATI

### **SCENARIO 1: Disponibilità Admin Specifica Blocca un Giorno AA**

**Esempio**:
- Shopper seleziona: **Sabato Morning** + **Domenica Afternoon**
- Admin ha impostato `adminAvailability["2026-02-15"][ShiftTime.MORNING] = [ShiftType.STANDARD]` (solo STANDARD, no AA)
- Il 15 Febbraio è un Sabato
- **RISULTATO**: Il Sabato viene FILTRATO, rimane solo Domenica → **1 AA invece di 2**

**Codice Responsabile** (linee 369-372):
```typescript
if (adminAvailability[dateStr]) {
    const config = adminAvailability[dateStr];
    return (!config[t] || config[t]?.includes(ShiftType.AA));  // ❌ Ritorna false se AA non è incluso
}
```

---

### **SCENARIO 2: Template Globale Blocca un Giorno AA**

**Esempio**:
- Shopper seleziona: **Lunedì Morning** + **Sabato Afternoon**
- Template globale: `savedCloudTemplate[1][ShiftTime.MORNING] = [ShiftType.STANDARD]` (Lunedì Morning solo STANDARD)
- **RISULTATO**: Lunedì viene FILTRATO → **1 AA invece di 2**

**Codice Responsabile** (linee 374-376):
```typescript
if (savedCloudTemplate && savedCloudTemplate[dayIndex]) {
    return savedCloudTemplate[dayIndex][t]?.includes(ShiftType.AA);  // ❌ Ritorna false se AA non è incluso
}
```

---

### **SCENARIO 3: Range Date Troppo Ristretto**

**Esempio**:
- Shopper con nazionalità non-EU seleziona AA
- `getShopperMinDate()` ritorna una data molto avanti (es. +3 settimane)
- Le prime 3 settimane vengono SKIPPATE (linea 357)
- Se il range è di 8 settimane e skippiamo 3, rimangono solo 5 settimane
- Se uno dei 2 giorni AA cade solo nelle prime 3 settimane → **1 AA invece di 2**

**Codice Responsabile** (linee 357-358):
```typescript
if (isBefore(currentDate, minDate)) { 
    currentDate = addDays(currentDate, 1); 
    continue;  // ⚠️ SKIP
}
```

---

## 🔍 ALTRI PUNTI CRITICI

### **3️⃣ PERSISTENZA DATABASE (handleSubmitData - ShopperApp.tsx:608-620)**

```typescript
let finalShifts = shopper.shifts;
if (shopper.details?.firstWorkingDay) {
    const limitKey = formatDateKey(endOfWeek(addWeeks(getSafeDateFromKey(shopper.details.firstWorkingDay), 1), { weekStartsOn: 1 }));
    finalShifts = finalShifts.filter(s => s.date >= shopper.details!.firstWorkingDay! && s.date <= limitKey);
}
```

**⚠️ POTENZIALE PROBLEMA**: 
- Gli shift AA vengono ULTERIORMENTE FILTRATI per rientrare nelle 2 settimane dopo il FWD
- Se un giorno AA cade DOPO questo limite → viene RIMOSSO

**Esempio**:
- FWD: 2026-02-10 (Martedì)
- Limite: 2026-02-22 (Domenica, fine della settimana successiva)
- AA selezionati: Sabato + Domenica
- Se il primo Sabato è il 2026-02-08 (PRIMA del FWD) → viene filtrato
- Se il primo Sabato è il 2026-02-28 (DOPO il limite) → viene filtrato
- **RISULTATO**: Solo Domenica rimane → **1 AA invece di 2**

---

### **4️⃣ OPENING SHIFT ADJUSTMENT (handleStandardShiftToggle - ShopperApp.tsx:529-544)**

```typescript
const finalShifts = newShifts.map((s) => {
    if (s.type === ShiftType.AA && s.date >= fwd) {
        const dayIndex = getDay(getSafeDateFromKey(s.date));
        const originalIntent = aaSelections.find(aa => aa.dayIndex === dayIndex);
        const shiftIndex = workingShifts.findIndex(ws => ws.date === s.date);

        if (originalIntent && originalIntent.time === ShiftTime.OPENING) {
            if (shiftIndex < 2) {
                return { ...s, time: ShiftTime.MORNING };  // ⚠️ MODIFICA IL TIME
            } else {
                return { ...s, time: ShiftTime.OPENING };
            }
        }
    }
    return s;
});
```

**⚠️ POTENZIALE PROBLEMA**:
- Se lo shopper seleziona OPENING come AA time
- I primi 2 shift vengono convertiti a MORNING
- Questo NON causa perdita di giorni, ma può creare confusione nella validazione

---

## 📊 VALIDAZIONE ADMIN (validateShopperSchedule - validation.ts:143-154)

```typescript
export const validateShopperSchedule = (shifts: ShopperShift[]): string[] => {
    const issues: string[] = [];
    if (!shifts || shifts.length === 0) return ["No shifts assigned."];

    // 1. AA Pattern Check
    const aaShifts = shifts.filter(s => s.type === ShiftType.AA);
    const uniqueDaysOfWeek = new Set(aaShifts.map(s => getDay(getSafeDateFromKey(s.date))));
    
    if (uniqueDaysOfWeek.size < 2) {
        issues.push(`Invalid AA Pattern: Found ${uniqueDaysOfWeek.size} distinct weekday(s), expected at least 2.`);
    }
    
    return issues;
}
```

**✅ QUESTA VALIDAZIONE FUNZIONA CORRETTAMENTE**:
- Conta i giorni UNICI della settimana (0-6)
- Se < 2 → segnala errore

---

## 🎨 DISPLAY ADMIN (renderAAPatternCell - ShopperTableRow.tsx:43-81)

```typescript
const renderAAPatternCell = (shifts: any[]) => {
    const aaShifts = shifts.filter(s => s.type === ShiftType.AA || s.type === 'AA');
    if (aaShifts.length === 0) return <span className="text-gray-300">-</span>;
    
    const uniqueDaysMap = new Map<string, string>();
    const sortedAA = [...aaShifts].sort((a, b) => a.date.localeCompare(b.date));

    sortedAA.forEach((s: any) => {
        const dateObj = getSafeDateFromKey(s.date);
        const dayName = format(dateObj, 'EEE');  // "Sun", "Mon", etc.
        const timeShort = s.time.split('(')[0].trim();
        uniqueDaysMap.set(dayName, `${dayName} ${timeShort}`);
    });
    
    const patterns = Array.from(uniqueDaysMap.values());
    return patterns.map(p => <span>{p}</span>);
};
```

**✅ DISPLAY CORRETTO**: Mostra solo i giorni UNICI presenti nel database.

---

## 🎯 CONCLUSIONI E RACCOMANDAZIONI

### **ROOT CAUSES CONFERMATE**:

1. **🔥 PRINCIPALE**: `checkAvailability()` in `finalizeAASubmission()` filtra shift AA se:
   - `adminAvailability` per quella data specifica esclude AA
   - `savedCloudTemplate` per quel giorno della settimana esclude AA

2. **⚠️ SECONDARIO**: Filtro date range in `handleSubmitData()` può rimuovere shift AA fuori dalle 2 settimane

3. **⚠️ EDGE CASE**: `minDate` troppo avanti può skippare settimane intere

### **SOLUZIONI PROPOSTE**:

#### **SOLUZIONE 1: Rimuovere il Filtro di Disponibilità per AA**
```typescript
// In finalizeAASubmission(), NON applicare checkAvailability per AA
// Gli AA sono GARANTITI dallo shopper, non soggetti a disponibilità admin
if (selectionForDay && selectionForDay.time) {
    newShifts.push({ date: dateStr, time: selectionForDay.time, type: ShiftType.AA });
    // ✅ Nessun filtro
}
```

#### **SOLUZIONE 2: Warning Pre-Submit**
```typescript
// In handleAAWizardSubmit(), verificare PRIMA se i giorni selezionati saranno filtrati
const willBeFiltered = aaSelections.some(sel => {
    // Simula il check di finalizeAASubmission
    // Se ritorna false, mostra warning
});
if (willBeFiltered) {
    alert("⚠️ Uno dei giorni selezionati non è disponibile nel template. Contatta l'admin.");
    return;
}
```

#### **SOLUZIONE 3: Garantire Almeno 2 Occorrenze per Giorno**
```typescript
// In finalizeAASubmission(), assicurarsi che ogni dayIndex abbia almeno 2 occorrenze
const dayIndexCounts = new Map<number, number>();
aaSelections.forEach(sel => dayIndexCounts.set(sel.dayIndex, 0));

// Dopo il loop, verificare
aaSelections.forEach(sel => {
    const count = newShifts.filter(s => getDay(getSafeDateFromKey(s.date)) === sel.dayIndex).length;
    if (count < 2) {
        throw new Error(`Insufficient AA shifts for day ${sel.dayIndex}`);
    }
});
```

---

## 📝 CHECKLIST PER DEBUGGING

Quando un shopper ha solo 1 AA, verificare:

- [ ] Controllare `adminAvailability` per le date specifiche
- [ ] Controllare `savedCloudTemplate` per i giorni della settimana
- [ ] Verificare `firstWorkingDay` e il range di 2 settimane
- [ ] Controllare `minDate` per la nazionalità dello shopper
- [ ] Verificare se ci sono shift AA nel database con `type = 'AA'`
- [ ] Controllare i log di `finalizeAASubmission()` per vedere quanti shift vengono creati

---

**FINE ANALISI**

