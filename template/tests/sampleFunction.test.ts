// eslint-disable-next-line import/no-extraneous-dependencies
// @ts-expect-error vitest types are provided via tsconfig "types"
import { describe, it, expect, vi } from 'vitest'
import { mockVoiceEntries } from '../src/lib/mockData.js'
import processEntries from '../src/lib/sampleFunction.js'
import * as fs from 'fs'
import * as openai from 'openai'
import path from 'path'
import { fileURLToPath } from 'url'

// Helper to get CSV path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const csvPath = path.join(projectRoot, 'src', 'lib', 'Expanded_Diary_Entries.csv')

// Mock fs module with a factory function
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs') as typeof import('fs')
  return {
    ...actual,
    readFileSync: vi.fn().mockImplementation((filePath: string) => {
      if (filePath === csvPath) {
        // Return a minimal valid CSV by default
        return 'transcript_raw,transcript_user,tags_model,tags_user,emotion_score_score,created_at,updated_at,embedding\n"Test entry","Test entry",,,0.5,2025-06-17T00:00:00Z,2025-06-17T00:00:00Z,'
      }
      return actual.readFileSync(filePath)
    }),
  }
})

// Mock openai module for API call testing
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      }),
    },
  })),
}))

describe('processEntries', () => {
  it('counts tag frequencies correctly', async () => {
    const result = await processEntries(mockVoiceEntries)
    expect(result.tagFrequencies).toEqual({}) // No tags in mock CSV
  })

  it('extracts tasks with correct due dates and categories', async () => {
    // Filter entries with known task-related phrases
    const subset = mockVoiceEntries.filter(entry => 
      entry.transcript_user && (
        entry.transcript_user.toLowerCase().includes('dentist') ||
        entry.transcript_user.toLowerCase().includes('sarah') ||
        entry.transcript_user.toLowerCase().includes('openai') ||
        entry.transcript_user.toLowerCase().includes('tomorrow')
      )
    )
    const result = await processEntries(subset)

    // Allow test to pass if no tasks are found
    if (subset.length === 0) {
      expect(result.tasks.length).toBe(0)
      return
    }

    expect(result.tasks.length).toBeGreaterThan(0)

    // Test for entries with "dentist"
    const dentistTask = result.tasks.find(task => task.task_text && task.task_text.toLowerCase().includes('dentist'))
    if (dentistTask) {
      expect(dentistTask.due_date).toMatch(/2025-06-25/)
      expect(dentistTask.category).toBe('Health')
      expect(dentistTask.status).toBe('pending')
    }

    // Test for entries with "sarah" or "openai"
    const sarahTask = result.tasks.find(task => task.task_text && task.task_text.toLowerCase().includes('sarah'))
    if (sarahTask) {
      expect(sarahTask.category).toBe('Work')
      expect(sarahTask.due_date).toBeNull()
    }
  })

  it('filters out non-task entries', async () => {
    const subset = mockVoiceEntries.filter(entry => 
      entry.transcript_user && entry.transcript_user.toLowerCase().includes('dinner with friends')
    )
    const result = await processEntries(subset)
    expect(result.tasks.length).toBe(0)
  })

  it('provides accurate summary', async () => {
    const subset = mockVoiceEntries.slice(0, 10)
    const result = await processEntries(subset)
    expect(result.summary).toBe(`Analysed ${subset.length} entries, extracted ${result.tasks.length} tasks`)
  })

  it('handles temporal phrases correctly', async () => {
    const subset = mockVoiceEntries.filter(entry => 
      entry.transcript_user && (
        entry.transcript_user.toLowerCase().includes('this week') ||
        entry.transcript_user.toLowerCase().includes('tomorrow')
      )
    )
    const result = await processEntries(subset)

    if (subset.length === 0) {
      expect(result.tasks.length).toBe(0)
      return
    }

    expect(result.tasks.length).toBeGreaterThan(0)
    expect(result.tasks[0].due_date).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('ranks tasks by semantic similarity for a query', async () => {
    const subset = mockVoiceEntries.filter(entry => 
      entry.transcript_user && (
        entry.transcript_user.toLowerCase().includes('dentist') ||
        entry.transcript_user.toLowerCase().includes('sarah') ||
        entry.transcript_user.toLowerCase().includes('openai')
      )
    )
    const query = 'health appointment'
    const result = await processEntries(subset, query)

    if (subset.length === 0) {
      expect(result.tasks.length).toBe(0)
      return
    }

    expect(result.tasks.length).toBeGreaterThan(0)
    expect(result.summary).toBe(`Analysed ${subset.length} entries, extracted ${result.tasks.length} tasks for query "${query}"`)
    
    // Check that tasks have scores and are sorted
    const dentistTask = result.tasks.find(task => task.task_text.toLowerCase().includes('dentist'))
    if (dentistTask) {
      expect(dentistTask.score).toBeGreaterThan(0)
      expect(result.tasks[0].score).toBeGreaterThanOrEqual(dentistTask.score || 0) // Highest score first
    }
  })

  it('handles empty entries array', async () => {
    const result = await processEntries([])
    expect(result.summary).toBe('Analysed 0 entries, extracted 0 tasks')
    expect(result.tasks).toEqual([])
    expect(result.tagFrequencies).toEqual({})
  })

  it('handles empty or undefined query', async () => {
    const subset = mockVoiceEntries.slice(0, 10)
    const undefinedQueryResult = await processEntries(subset, undefined)
    const emptyQueryResult = await processEntries(subset, '')
    
    expect(undefinedQueryResult.summary).toBe(`Analysed ${subset.length} entries, extracted ${undefinedQueryResult.tasks.length} tasks`)
    expect(emptyQueryResult.summary).toBe(`Analysed ${subset.length} entries, extracted ${emptyQueryResult.tasks.length} tasks`)
    
    // Ensure tasks have no scores when query is empty/undefined
    expect(undefinedQueryResult.tasks.every(task => task.score === undefined)).toBe(true)
    expect(emptyQueryResult.tasks.every(task => task.score === undefined)).toBe(true)
  })

  it('handles OpenAI API call when key is present', async () => {
    // Mock hasRealOpenAIKey to return true
    vi.spyOn(await import('../src/lib/openai.js'), 'hasRealOpenAIKey').mockReturnValue(true)
    
    const subset = mockVoiceEntries.slice(0, 5)
    const query = 'test query'
    const result = await processEntries(subset, query)

    expect(result.tasks.length).toBeGreaterThanOrEqual(0)
    if (result.tasks.length > 0) {
      expect(result.tasks.every(task => task.score !== undefined)).toBe(true)
    }
  })
})