import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embed } from './openai.ts';
import { VoiceEntry } from './types.ts';


// Helper to get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

/**
 * Parses the provided CSV content into an array of VoiceEntry objects.
 * Handles comma-separated values and missing fields robustly.
 * Precomputes embeddings for transcripts to ensure deterministic behavior.
 */
async function parseCsv(csvContent: string): Promise<VoiceEntry[]> {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim());
  const entries: VoiceEntry[] = [];

  // Expected header indices
  const headerIndices: Record<string, number> = {
    transcript_raw: headers.indexOf('transcript_raw'),
    transcript_user: headers.indexOf('transcript_user'),
    tags_model: headers.indexOf('tags_model'),
    tags_user: headers.indexOf('tags_user'),
    emotion_score_score: headers.indexOf('emotion_score_score'),
    created_at: headers.indexOf('created_at'),
    updated_at: headers.indexOf('updated_at'),
    embedding: headers.indexOf('embedding'),
  };

  for (let i = 1; i < lines.length; i++) {
    // Handle potential commas in transcript text by joining excess values
    const values = lines[i].split(',').map(v => v.trim());
    const entry: Partial<VoiceEntry> = {
      id: `mock-id-${i}`,
      user_id: 'mock-user-id',
      audio_url: null,
      transcript_raw: '',
      transcript_user: '',
      language_detected: 'en',
      language_rendered: 'en',
      tags_model: [],
      tags_user: [],
      category: null,
      created_at: '',
      updated_at: '',
      emotion_score_score: null,
      embedding: null,
      emotion_score_log: null,
      tags_log: null,
      tags_log_user_original: null,
      entry_emoji: null,
      emoji_source: null,
      emoji_log: null,
      reminder_date: null,
      idea_status: null,
    };

    // Assign values based on header indices
    if (headerIndices.transcript_raw >= 0 && headerIndices.transcript_raw < values.length) {
      entry.transcript_raw = values[headerIndices.transcript_raw] || '';
    }
    if (headerIndices.transcript_user >= 0 && headerIndices.transcript_user < values.length) {
      entry.transcript_user = values[headerIndices.transcript_user] || '';
    }
    if (headerIndices.tags_model >= 0 && headerIndices.tags_model < values.length) {
      entry.tags_model = values[headerIndices.tags_model]
        ? values[headerIndices.tags_model].split(';').filter(tag => tag.trim())
        : [];
    }
    if (headerIndices.tags_user >= 0 && headerIndices.tags_user < values.length) {
      entry.tags_user = values[headerIndices.tags_user]
        ? values[headerIndices.tags_user].split(';').filter(tag => tag.trim())
        : [];
    }
    if (headerIndices.emotion_score_score >= 0 && headerIndices.emotion_score_score < values.length) {
      entry.emotion_score_score = values[headerIndices.emotion_score_score]
        ? parseFloat(values[headerIndices.emotion_score_score])
        : null;
    }
    if (headerIndices.created_at >= 0 && headerIndices.created_at < values.length) {
      entry.created_at = values[headerIndices.created_at] || new Date().toISOString();
    }
    if (headerIndices.updated_at >= 0 && headerIndices.updated_at < values.length) {
      entry.updated_at = values[headerIndices.updated_at] || new Date().toISOString();
    }
    if (headerIndices.embedding >= 0 && headerIndices.embedding < values.length) {
      entry.embedding = values[headerIndices.embedding]
        ? values[headerIndices.embedding].split(',').map(Number)
        : null;
    }

    // Ensure required fields have defaults
    entry.transcript_raw = entry.transcript_raw || '';
    entry.transcript_user = entry.transcript_user || '';
    entry.created_at = entry.created_at || new Date().toISOString();
    entry.updated_at = entry.updated_at || new Date().toISOString();

    // Precompute embedding if not provided
    if (!entry.embedding && entry.transcript_user) {
      entry.embedding = await embed(entry.transcript_user);
    }

    entries.push(entry as VoiceEntry);
  }


  return entries;
}

// Load the CSV data from the root of the template directory
const csvPath = path.join(projectRoot, 'src', 'lib', 'Expanded_Diary_Entries.csv');
let csvData: string;
try {
  csvData = fs.readFileSync(csvPath, 'utf-8');
} catch (error) {
  console.error('Error reading CSV file:', error);
  csvData = '';
}

export const mockVoiceEntries: VoiceEntry[] = await parseCsv(csvData);