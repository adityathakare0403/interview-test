import { embed } from './openai.ts'
import { VoiceEntry, ProcessedResult } from './types.ts'


/**
 * processEntries
 * --------------
 * PURE function — no IO, no mutation, deterministic.
 * Extracts tasks from transcript_user, categorizes them, counts tag frequencies,
 * and ranks tasks by semantic similarity to a query if provided.
 * Uses regex for intent detection and embeddings for semantic matching.
 * @param entries - Array of VoiceEntry objects to process.
 * @param query - Optional natural language query to filter and rank tasks.
 * @returns ProcessedResult with tasks, tag frequencies, and summary.
 */
export async function processEntries(entries: VoiceEntry[], query?: string): Promise<ProcessedResult> {
  const tagFrequencies: Record<string, number> = {}
  const tasks: { task_text: string; due_date: string | null; status: string; category: string; score?: number }[] = []

  // Expanded regex to match more verb forms and task patterns
  const taskVerbs = /\b(plan|planning|planned|need|needs|needing|want|wants|wanting|schedule|scheduling|scheduled|going to|tomorrow|today|yesterday|this week|next week|start|starting|started|finish|finishing|finished|call|calling|called|buy|buying|bought|reply|replying|replied|send|sending|sent|clean|cleaning|cleaned|organize|organizing|organized|submit|submitting|submitted|book|booking|booked)\b/i
  const timePhrases = /\b(tomorrow|today|yesterday|this week|next week|by \w+|sometime \w+|later \w+|before \w+)\b/i

  // Category keywords
  const categories: Record<string, string[]> = {
    Work: ['job', 'work', 'proposal', 'report', 'meeting', 'interview', 'resume', 'email', 'slides', 'application'],
    Personal: ['mom', 'grandpa', 'aunt', 'friends', 'call', 'coffee', 'family', 'grandmother', 'catch up'],
    Health: ['health', 'caffeine', 'sugar', 'run', 'workout', 'dentist', 'doctor', 'no-sugar'],
    Home: ['clean', 'organize', 'declutter', 'kitchen', 'bathroom', 'garage', 'paint', 'room', 'closet'],
    Other: []
  }

  // Compute query embedding if provided
  let queryEmbedding: number[] | null = null
  if (query && query.trim()) {
    queryEmbedding = await embed(query);
  }

  /**
   * Computes cosine similarity between two vectors.
   * @param a - First vector.
   * @param b - Second vector.
   * @returns Cosine similarity score (0 to 1).
   */
  function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return normB === 0 || normA === 0 ? 0 : dotProduct / (normA * normB);
  }

  for (const entry of entries) {
    // Debug: Inspect tags_user input (remove before submission)
    if (entry.tags_user.length > 0) {
      console.log(`Entry ${entry.id} tags_user:`, entry.tags_user);
    }

    // Count user tags, skipping empty or malformed tags
    for (const tag of entry.tags_user) {
      if (tag && tag.trim() && !tag.includes('"')) { // Skip tags with quotes (likely transcript fragments)
        tagFrequencies[tag] = (tagFrequencies[tag] || 0) + 1
      }
    }

    // Extract tasks from transcript_user
    const transcript = entry.transcript_user ? entry.transcript_user.toLowerCase() : ''
    if (transcript && taskVerbs.test(transcript)) {
      const taskText = entry.transcript_user || ''
      let dueDate: string | null = null
      let category = 'Other'
      let score: number | undefined = undefined

      // Extract due date
      const timeMatch = transcript.match(timePhrases)
      if (timeMatch) {
        dueDate = timeMatch[0]
        const created = new Date(entry.created_at || new Date().toISOString())
        if (dueDate.includes('tomorrow')) {
          created.setDate(created.getDate() + 1)
          dueDate = created.toISOString().split('T')[0]
        } else if (dueDate.includes('today')) {
          dueDate = entry.created_at.split(' ')[0]
        } else if (dueDate.includes('yesterday')) {
          created.setDate(created.getDate() - 1)
          dueDate = created.toISOString().split('T')[0]
        } else if (dueDate.includes('this week') || dueDate.includes('next week')) {
          created.setDate(created.getDate() + (dueDate.includes('next') ? 7 : 0))
          dueDate = created.toISOString().split('T')[0]
        }
      }

      // Assign category
      for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => transcript.includes(keyword))) {
          category = cat
          break
        }
      }

      // Compute similarity score if query and embedding exist
      if (queryEmbedding && entry.embedding) {
        score = cosineSimilarity(queryEmbedding, entry.embedding);
      }

      tasks.push({
        task_text: taskText,
        due_date: dueDate,
        status: 'pending',
        category,
        score
      })
    }
  }

  // Sort tasks by score (descending) if query is provided
  if (query && query.trim()) {
    tasks.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return {
    summary: `Analysed ${entries.length} entries, extracted ${tasks.length} tasks${query ? ` for query "${query}"` : ''}`,
    tagFrequencies,
    tasks
  }
}

export default processEntries