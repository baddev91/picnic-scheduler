# 🔧 Fix: Note Field Persistence Issue

## 🐛 Problema Identificato

Quando si aggiungeva una nota a una submission nell'Admin Data View, la nota rimaneva bloccata nel campo di input anche dopo il salvataggio e il reload. Inoltre, in alcuni casi il campo diventava non editabile.

### Causa Root

Il problema era causato da un ciclo di aggiornamenti non gestito correttamente:

1. **Campo Legacy Mantenuto**: Quando si salvava una nota, il campo `details.notes` veniva aggiornato con il nuovo valore invece di essere svuotato
2. **useEffect Problematico**: Il `useEffect` in `ShopperExpandedDetails` resettava il campo di input ogni volta che lo shopper veniva aggiornato
3. **Dipendenza Circolare**: Salvare → Aggiornare shopper → Reset campo input → Mostrare vecchia nota

```typescript
// PRIMA (PROBLEMATICO):
useEffect(() => {
    setNotes(shopper.details?.notes || ''); // ❌ Resettava sempre
}, [shopper.details?.firstDayStatus, shopper.id, shopper.details?.isFrozenEligible]);

// Quando salvavi:
notes: notes.trim() // ❌ Manteneva il valore
```

## ✅ Soluzione Implementata

### 1. **ShopperExpandedDetails.tsx**

#### A. Separazione degli useEffect
```typescript
// Reset solo per status changes (NON include notes)
useEffect(() => {
    setPendingStatus(null);
    setPendingFrozenToggle(false);
    setIsFrozenEligible(shopper.details?.isFrozenEligible || false);
    setEmailResent(false);
}, [shopper.details?.firstDayStatus, shopper.id, shopper.details?.isFrozenEligible]);

// Inizializza notes SOLO quando cambia shopper (nuovo shopper caricato)
useEffect(() => {
    setNotes(shopper.details?.notes || '');
}, [shopper.id]);
```

#### B. Svuotamento del Campo Legacy
```typescript
const newDetails = {
    ...shopper.details,
    noteHistory: updatedNoteHistory,
    notes: '' // ✅ Svuota il campo legacy dopo il salvataggio
};
```

### 2. **SERReportModal.tsx**

Aggiornato per usare `noteHistory` invece del campo legacy:

```typescript
const notes = shoppers
    .map(s => {
        // Usa la nota più recente da noteHistory
        const latestNote = s.details?.noteHistory?.[0]?.content?.trim();
        // Fallback al campo legacy se noteHistory è vuoto
        const note = latestNote || s.details?.notes?.trim();
        return note ? `${s.name}: ${note}` : '';
    })
    .filter(note => note !== '')
    .join('\n');
```

### 3. **AdminDataView.tsx**

Aggiornato l'export CSV per usare `noteHistory`:

```typescript
// Get latest note from noteHistory, fallback to legacy notes field
const latestNote = item.details?.noteHistory?.[0]?.content || item.details?.notes || '';
const notes = latestNote ? latestNote.replace(/"/g, '""') : '';
```

## 🔄 Script di Migrazione

Creato `scripts/migrate-notes-to-history.ts` per migrare i dati esistenti:

- Trova tutti gli shoppers con note nel campo legacy
- Sposta le note in `noteHistory` con metadata (author, timestamp)
- Svuota il campo legacy `notes`
- Gestisce duplicati (non migra se già presente in history)

### Come Eseguire la Migrazione

```bash
# Opzione 1: Esegui direttamente con ts-node
npx ts-node scripts/migrate-notes-to-history.ts

# Opzione 2: Compila e esegui
tsc scripts/migrate-notes-to-history.ts
node scripts/migrate-notes-to-history.js
```

## 📋 Comportamento Atteso

### Prima della Fix
1. ❌ Aggiungi nota → Salva → Nota rimane nel campo di input
2. ❌ Reload pagina → Nota ancora presente nel campo
3. ❌ Campo non editabile in alcuni casi

### Dopo la Fix
1. ✅ Aggiungi nota → Salva → Campo si svuota automaticamente
2. ✅ Reload pagina → Campo rimane vuoto, pronto per nuova nota
3. ✅ Note salvate visibili nella sezione "Note History"
4. ✅ SER Report raccoglie l'ultima nota da noteHistory
5. ✅ Export CSV include l'ultima nota

## 🧪 Test Consigliati

1. **Test Base**:
   - Aggiungi una nota a uno shopper
   - Verifica che il campo si svuoti dopo il salvataggio
   - Verifica che la nota appaia nella sezione "Note History"

2. **Test Reload**:
   - Aggiungi una nota e salva
   - Ricarica la pagina
   - Verifica che il campo di input sia vuoto

3. **Test SER Report**:
   - Aggiungi note a più shoppers
   - Apri il SER Report Modal
   - Verifica che le note siano raccolte correttamente

4. **Test Export CSV**:
   - Esporta i dati in CSV
   - Verifica che la colonna "Notes" contenga le note corrette

## 🔍 File Modificati

- ✅ `components/Admin/ShopperExpandedDetails.tsx`
- ✅ `components/SERReportModal.tsx`
- ✅ `components/AdminDataView.tsx`
- ➕ `scripts/migrate-notes-to-history.ts` (nuovo)

## 📝 Note Tecniche

- Il campo `details.notes` è mantenuto per backward compatibility ma viene svuotato dopo ogni salvataggio
- `noteHistory` è ora la fonte primaria per le note
- Ogni nota in `noteHistory` include: `id`, `content`, `author`, `timestamp`
- Il sistema gestisce automaticamente il fallback al campo legacy se `noteHistory` è vuoto

