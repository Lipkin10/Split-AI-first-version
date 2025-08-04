import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Database types aligned with current codebase structure
export interface Database {
  public: {
    Tables: {
      Group: {
        Row: {
          id: string
          name: string
          information: string | null
          currency: string
          createdAt: string
        }
        Insert: {
          id: string
          name: string
          information?: string | null
          currency?: string
          createdAt?: string
        }
        Update: {
          id?: string
          name?: string
          information?: string | null
          currency?: string
          createdAt?: string
        }
      }
      Participant: {
        Row: {
          id: string
          name: string
          groupId: string
        }
        Insert: {
          id: string
          name: string
          groupId: string
        }
        Update: {
          id?: string
          name?: string
          groupId?: string
        }
      }
      Category: {
        Row: {
          id: number
          grouping: string
          name: string
        }
        Insert: {
          id?: number
          grouping: string
          name: string
        }
        Update: {
          id?: number
          grouping?: string
          name?: string
        }
      }
      Expense: {
        Row: {
          id: string
          groupId: string
          expenseDate: string
          title: string
          categoryId: number
          amount: number
          paidById: string
          isReimbursement: boolean
          splitMode: string
          createdAt: string
          notes: string | null
          recurrenceRule: string | null
          recurringExpenseLinkId: string | null
        }
        Insert: {
          id: string
          groupId: string
          expenseDate?: string
          title: string
          categoryId?: number
          amount: number
          paidById: string
          isReimbursement?: boolean
          splitMode?: string
          createdAt?: string
          notes?: string | null
          recurrenceRule?: string | null
          recurringExpenseLinkId?: string | null
        }
        Update: {
          id?: string
          groupId?: string
          expenseDate?: string
          title?: string
          categoryId?: number
          amount?: number
          paidById?: string
          isReimbursement?: boolean
          splitMode?: string
          createdAt?: string
          notes?: string | null
          recurrenceRule?: string | null
          recurringExpenseLinkId?: string | null
        }
      }
      ExpensePaidFor: {
        Row: {
          expenseId: string
          participantId: string
          shares: number
        }
        Insert: {
          expenseId: string
          participantId: string
          shares?: number
        }
        Update: {
          expenseId?: string
          participantId?: string
          shares?: number
        }
      }
      ExpenseDocument: {
        Row: {
          id: string
          url: string
          width: number
          height: number
          expenseId: string | null
        }
        Insert: {
          id: string
          url: string
          width: number
          height: number
          expenseId?: string | null
        }
        Update: {
          id?: string
          url?: string
          width?: number
          height?: number
          expenseId?: string | null
        }
      }
      Activity: {
        Row: {
          id: string
          groupId: string
          time: string
          activityType: string
          participantId: string | null
          expenseId: string | null
          data: string | null
        }
        Insert: {
          id: string
          groupId: string
          time?: string
          activityType: string
          participantId?: string | null
          expenseId?: string | null
          data?: string | null
        }
        Update: {
          id?: string
          groupId?: string
          time?: string
          activityType?: string
          participantId?: string | null
          expenseId?: string | null
          data?: string | null
        }
      }
      RecurringExpenseLink: {
        Row: {
          id: string
          groupId: string
          currentFrameExpenseId: string
          nextExpenseCreatedAt: string | null
          nextExpenseDate: string
        }
        Insert: {
          id: string
          groupId: string
          currentFrameExpenseId: string
          nextExpenseCreatedAt?: string | null
          nextExpenseDate: string
        }
        Update: {
          id?: string
          groupId?: string
          currentFrameExpenseId?: string
          nextExpenseCreatedAt?: string | null
          nextExpenseDate?: string
        }
      }
    }
  }
}

// Client for browser usage (with anon key)
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_API_ANON_KEY,
)

// Admin client for server usage (with service role)
export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// Export types for use in the app
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Helper function to handle Supabase relationship data
export function normalizeRelation<T>(data: T | T[]): T | null {
  if (Array.isArray(data)) {
    return data.length > 0 ? data[0] : null
  }
  return data || null
}
