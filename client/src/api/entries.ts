import { apiRequest } from './client'
import type { BookkeepingEntry, CreateEntryInput } from './types'

export function listEntries(params?: { from?: string; to?: string; limit?: number }) {
  return apiRequest<{ entries: BookkeepingEntry[] }>('/api/entries', { query: params })
}

export function createEntry(input: CreateEntryInput) {
  return apiRequest<{ entry: BookkeepingEntry }>('/api/entries', {
    method: 'POST',
    body: input,
  })
}

export function updateEntry(id: string, input: Partial<CreateEntryInput>) {
  return apiRequest<{ entry: BookkeepingEntry }>(`/api/entries/${id}`, {
    method: 'PUT',
    body: input,
  })
}

export function deleteEntry(id: string) {
  return apiRequest<{ success: boolean }>(`/api/entries/${id}`, {
    method: 'DELETE',
  })
}
