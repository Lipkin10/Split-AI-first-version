// ============================================================================
// TYPE DEFINITIONS FOR CONVERSATIONAL INTENT PARSING
// ============================================================================

export type ConversationIntent =
  | 'expense_creation'
  | 'balance_query'
  | 'group_management'
  | 'expense_history'
  | 'reimbursement_status'
  | 'unclear'

export interface ExpenseCreationIntent {
  amount: number // In cents, matching existing schema
  title: string
  participants: string[] // Participant names
  category?: string
  date?: Date
  splitMode?: 'EVENLY' | 'BY_SHARES' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
}

export interface BalanceQueryIntent {
  targetUser?: string
  groupContext?: string
  timeRange?: { start: Date; end: Date }
  queryType?: 'specific_balance' | 'general_balance' | 'reimbursement_status' | 'settlement_suggestions' | 'historical_balance'
}

export interface GroupManagementIntent {
  action: 'create_group' | 'add_participant' | 'remove_participant' | 'update_group' | 'switch_group' | 'list_groups'
  groupName?: string
  participants?: string[]
  currency?: string
  groupId?: string
  settings?: {
    information?: string
    currency?: string
  }
  confidence: number
}

export interface ExpenseHistoryIntent {
  timeRange?: { start: Date; end: Date }
  category?: string
  participant?: string
  minAmount?: number
  maxAmount?: number
}

export interface ReimbursementStatusIntent {
  targetUser?: string
  groupContext?: string
}

export interface ConversationParseResult {
  intent: ConversationIntent
  confidence: number
  extractedData:
    | ExpenseCreationIntent
    | BalanceQueryIntent
    | GroupManagementIntent
    | ExpenseHistoryIntent
    | ReimbursementStatusIntent
    | null
  clarificationNeeded?: string
}

export interface AIServiceConfig {
  timeout: number // 3 seconds as per NFR requirements
  maxRetries: number
  baseRetryDelay: number // in milliseconds
  enableFallback: boolean
}

export interface FallbackResult {
  intent: 'unclear'
  confidence: 0
  extractedData: null
  clarificationNeeded: string
  fallbackReason:
    | 'timeout'
    | 'api_unavailable'
    | 'parse_error'
    | 'rate_limit'
    | 'unknown'
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retry: boolean = false,
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

export const DEFAULT_AI_CONFIG: AIServiceConfig = {
  timeout: 3000, // 3 seconds
  maxRetries: 3,
  baseRetryDelay: 500, // 500ms base delay
  enableFallback: true,
}

// ============================================================================
// CONVERSATIONAL UI TYPES
// ============================================================================

export interface ConversationMessage {
  id: string
  type: 'user' | 'assistant' | 'error' | 'system'
  content: string
  timestamp: Date
  actions?: ConversationAction[]
  metadata?: Record<string, any>
}

export interface ConversationAction {
  type:
    | 'create_expense'
    | 'view_balances'
    | 'create_group'
    | 'edit_expense'
    | 'navigate'
    | 'retry'
  label: string
  data?: Record<string, any>
  url?: string
}

export interface ConversationState {
  messages: ConversationMessage[]
  isLoading: boolean
  error: string | null
  sessionId?: string
  metadata?: Record<string, any>
}

export interface ConversationContext {
  groupId?: string
  currentPage?: string
  activeUser?: string
  locale: string
}

export interface ConversationResponse {
  message: ConversationMessage
  actions?: ConversationAction[]
  suggestions?: string[]
  requiresConfirmation?: boolean
  confirmationData?: Record<string, any>
}
