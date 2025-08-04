import { createClient } from '@supabase/supabase-js'

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

// Build-time environment variable injection with fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://smqlrzponrleuwonyapg.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcWxyenBvbnJsZXV3b255YXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjg5NzgsImV4cCI6MjA2ODkwNDk3OH0.BdMCdL3ypPQg8kmXIBd7LzYh5mhLsfLrOxaadqhWGsU'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Admin client for server usage (with service role) - only create server-side
function createAdminClient() {
  if (typeof window !== 'undefined') {
    // On client-side, return a dummy client that throws helpful errors
    return new Proxy({} as ReturnType<typeof createClient<Database>>, {
      get() {
        throw new Error('supabaseAdmin should only be used server-side')
      }
    })
  }

  const supabaseServerUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseServerUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseServiceRole) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE environment variable for admin client')
  }

  return createClient<Database>(
    supabaseServerUrl,
    supabaseServiceRole,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export const supabaseAdmin = createAdminClient()

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
