/**
 * Migration Script: Move legacy notes to noteHistory
 *
 * This script migrates any existing notes in the legacy 'notes' field
 * to the new 'noteHistory' structure, then clears the legacy field.
 *
 * Run this once to clean up existing data.
 *
 * HOW TO RUN:
 * 1. Open browser console on your app
 * 2. Copy and paste this entire file
 * 3. Call: migrateNotes()
 */

import { supabase } from '../supabaseClient';

interface NoteEntry {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

export async function migrateNotes() {
  console.log('🔄 Starting notes migration...');

  try {
    // Fetch all shoppers with notes
    const { data: shoppers, error } = await supabase
      .from('shoppers')
      .select('*')
      .not('details->notes', 'is', null);

    if (error) {
      console.error('❌ Error fetching shoppers:', error);
      return;
    }

    if (!shoppers || shoppers.length === 0) {
      console.log('✅ No shoppers with legacy notes found. Migration complete!');
      return;
    }

    console.log(`📝 Found ${shoppers.length} shoppers with legacy notes`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const shopper of shoppers) {
      const legacyNote = shopper.details?.notes?.trim();
      
      // Skip if no legacy note or if it's empty
      if (!legacyNote) {
        skippedCount++;
        continue;
      }

      // Check if this note already exists in noteHistory
      const existingNoteHistory = shopper.details?.noteHistory || [];
      const noteAlreadyMigrated = existingNoteHistory.some(
        (note: NoteEntry) => note.content === legacyNote
      );

      if (noteAlreadyMigrated) {
        console.log(`⏭️  Skipping ${shopper.name} - note already in history`);
        
        // Just clear the legacy field
        const updatedDetails = {
          ...shopper.details,
          notes: ''
        };

        await supabase
          .from('shoppers')
          .update({ details: updatedDetails })
          .eq('id', shopper.id);

        skippedCount++;
        continue;
      }

      // Create a new note entry for the legacy note
      const migratedNoteEntry: NoteEntry = {
        id: crypto.randomUUID(),
        content: legacyNote,
        author: 'System (Migrated)',
        timestamp: shopper.created_at || new Date().toISOString()
      };

      // Add to noteHistory and clear legacy field
      const updatedNoteHistory = [...existingNoteHistory, migratedNoteEntry];
      const updatedDetails = {
        ...shopper.details,
        noteHistory: updatedNoteHistory,
        notes: '' // Clear legacy field
      };

      const { error: updateError } = await supabase
        .from('shoppers')
        .update({ details: updatedDetails })
        .eq('id', shopper.id);

      if (updateError) {
        console.error(`❌ Error migrating note for ${shopper.name}:`, updateError);
        continue;
      }

      console.log(`✅ Migrated note for ${shopper.name}`);
      migratedCount++;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📝 Total: ${shoppers.length}`);
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Auto-run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateNotes().then(() => {
    console.log('✨ Script execution complete');
    process.exit(0);
  }).catch((err) => {
    console.error('💥 Script failed:', err);
    process.exit(1);
  });
}

