import { create } from 'zustand'
import type { HistoryRecord } from '../types'
import { historyAdd, historyGetAll, historyDelete, historyClear } from '../services/db'

interface HistoryState {
  records: HistoryRecord[]
  isLoading: boolean
  load: () => Promise<void>
  add: (record: Omit<HistoryRecord, 'id'>) => Promise<number>
  delete: (id: number) => Promise<void>
  clear: () => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set) => ({
  records: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true })
    const records = await historyGetAll<HistoryRecord>()
    set({ records, isLoading: false })
  },

  add: async (record) => {
    const id = await historyAdd(record)
    set(state => ({
      records: [{ ...record, id } as HistoryRecord, ...state.records],
    }))
    return id
  },

  delete: async (id) => {
    await historyDelete(id)
    set(state => ({ records: state.records.filter(r => r.id !== id) }))
  },

  clear: async () => {
    await historyClear()
    set({ records: [] })
  },
}))
