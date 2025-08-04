import { env } from '@/lib/env'
import OpenAI from 'openai'
import { MULTI_LANGUAGE_PROMPTS } from './ai-conversation/prompts'
import {
  AIServiceConfig,
  AIServiceError,
  BalanceQueryIntent,
  ConversationIntent,
  ConversationParseResult,
  DEFAULT_AI_CONFIG,
  ExpenseCreationIntent,
  ExpenseHistoryIntent,
  FallbackResult,
  GroupManagementIntent,
  ReimbursementStatusIntent,
} from './ai-conversation/types'

// Initialize OpenAI client using existing environment configuration
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

// Re-export types for backward compatibility
export { AIServiceError, DEFAULT_AI_CONFIG }
export type {
  AIServiceConfig,
  BalanceQueryIntent,
  ConversationIntent,
  ConversationParseResult,
  ExpenseCreationIntent,
  ExpenseHistoryIntent,
  FallbackResult,
  GroupManagementIntent,
  ReimbursementStatusIntent,
}

// ============================================================================
// CULTURAL CONTEXT AND CURRENCY/DATE HANDLING
// ============================================================================

export const CURRENCY_PATTERNS = {
  'en-US': { symbols: ['$', 'USD'], format: 'YYYY-MM-DD' },
  es: { symbols: ['€', 'EUR'], format: 'DD/MM/YYYY' },
  'fr-FR': { symbols: ['€', 'EUR'], format: 'DD/MM/YYYY' },
  'de-DE': { symbols: ['€', 'EUR'], format: 'DD.MM.YYYY' },
  'zh-CN': { symbols: ['￥', 'CNY', '元'], format: 'YYYY年MM月DD日' },
  'zh-TW': { symbols: ['NT$', 'TWD', '元'], format: 'YYYY年MM月DD日' },
  'pl-PL': { symbols: ['zł', 'PLN'], format: 'DD.MM.YYYY' },
  'ru-RU': { symbols: ['₽', 'RUB'], format: 'DD.MM.YYYY' },
  'it-IT': { symbols: ['€', 'EUR'], format: 'DD/MM/YYYY' },
  'ua-UA': { symbols: ['₴', 'UAH'], format: 'DD.MM.YYYY' },
  ro: { symbols: ['lei', 'RON', 'L'], format: 'DD.MM.YYYY' },
  'tr-TR': { symbols: ['₺', 'TRY'], format: 'DD.MM.YYYY' },
  'pt-BR': { symbols: ['R$', 'BRL'], format: 'DD/MM/YYYY' },
  'nl-NL': { symbols: ['€', 'EUR'], format: 'DD-MM-YYYY' },
  fi: { symbols: ['€', 'EUR'], format: 'DD.MM.YYYY' },
} as const

export function parseAmountWithCulturalContext(
  amountString: string,
  language: string = 'en-US',
): number | null {
  const patterns =
    CURRENCY_PATTERNS[language as keyof typeof CURRENCY_PATTERNS] ||
    CURRENCY_PATTERNS['en-US']

  // Remove currency symbols specific to the language
  let cleanAmount = amountString
  for (const symbol of patterns.symbols) {
    cleanAmount = cleanAmount.replace(
      new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      '',
    )
  }

  // Handle different decimal separators by language
  if (['de-DE', 'nl-NL', 'fr-FR'].includes(language)) {
    // European style: 1.234,56 (dot for thousands, comma for decimals)
    cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.')
  } else {
    // US/UK style: 1,234.56 (comma for thousands, dot for decimals)
    cleanAmount = cleanAmount.replace(/,/g, '')
  }

  const amount = parseFloat(cleanAmount.trim())
  return isNaN(amount) ? null : Math.round(amount * 100)
}

export function formatCurrencyForLanguage(
  amountInCents: number,
  language: string = 'en-US',
  currency: string = 'USD',
): string {
  const localeMap: Record<string, string> = {
    'en-US': 'en-US',
    es: 'es-ES',
    'fr-FR': 'fr-FR',
    'de-DE': 'de-DE',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'pl-PL': 'pl-PL',
    'ru-RU': 'ru-RU',
    'it-IT': 'it-IT',
    'ua-UA': 'uk-UA',
    ro: 'ro-RO',
    'tr-TR': 'tr-TR',
    'pt-BR': 'pt-BR',
    'nl-NL': 'nl-NL',
    fi: 'fi-FI',
  }

  const locale = localeMap[language] || 'en-US'

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amountInCents / 100)
  } catch {
    // Fallback to USD formatting if currency not supported
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100)
  }
}

// ============================================================================
// CORE CONVERSATION PARSING FUNCTIONS
// ============================================================================

export async function parseConversationIntent(
  message: string,
  language: string = 'en-US',
  groupContext?: {
    participants: { name: string }[]
    currency: string
  },
): Promise<ConversationParseResult> {
  try {
    const prompt =
      MULTI_LANGUAGE_PROMPTS[language as keyof typeof MULTI_LANGUAGE_PROMPTS] ||
      MULTI_LANGUAGE_PROMPTS['en-US']

    const contextInfo = groupContext
      ? `
    
CURRENT GROUP CONTEXT:
- Participants: ${groupContext.participants.map((p) => p.name).join(', ')}
- Currency: ${groupContext.currency}
`
      : ''

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      temperature: 0.2, // Lower temperature for more consistent classification
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: prompt + contextInfo,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    const result = JSON.parse(responseContent) as ConversationParseResult

    // Validate the result structure
    if (!result.intent || typeof result.confidence !== 'number') {
      throw new Error('Invalid response structure from OpenAI')
    }

    return result
  } catch (error) {
    console.error('Error parsing conversation intent:', error)

    // Fallback for parsing errors
    return {
      intent: 'unclear',
      confidence: 0.0,
      extractedData: null,
      clarificationNeeded:
        'I had trouble understanding your request. Could you please rephrase it?',
    }
  }
}

// ============================================================================
// SPECIFIC INTENT CLASSIFICATION FUNCTIONS
// ============================================================================

export async function classifyExpenseCreationIntent(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  const expensePrompt = `You are specialized in detecting expense creation requests from natural language.

EXPENSE CREATION INDICATORS:
- "I spent", "I paid", "I bought", "cost", "bill", "invoice"
- Amounts with currency symbols
- Merchant/vendor names
- Date references (today, yesterday, last week)
- Category mentions (food, transport, entertainment, etc.)

EXTRACT:
- amount: Convert to cents (multiply by 100)
- title: Expense description/merchant name
- participants: Names mentioned or "all" for group split
- category: Match to existing categories if possible
- date: Parse date references
- splitMode: "EVENLY" unless specific split mentioned

If this is clearly an expense creation request, respond with JSON:
{
  "intent": "expense_creation",
  "confidence": 0.8-1.0,
  "extractedData": {
    "amount": number_in_cents,
    "title": "description",
    "participants": ["name1", "name2"] or [],
    "category": "category_name",
    "date": "YYYY-MM-DD",
    "splitMode": "EVENLY"
  }
}

If not an expense creation request, return confidence < 0.3.`

  return await parseWithSpecificPrompt(
    message,
    expensePrompt,
    language,
    groupContext,
  )
}

export async function classifyBalanceQueryIntent(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  // Import balance query patterns
  const { matchBalanceQueryPattern, FALLBACK_CLARIFICATIONS } = await import('./ai-conversation/balance-query-patterns')
  
  const participantNames = groupContext?.participants.map(p => p.name) || []
  
  // First try pattern matching for faster, more accurate classification
  const patternMatch = matchBalanceQueryPattern(message, participantNames)
  
  if (patternMatch && patternMatch.confidence > 0.7) {
    // High confidence pattern match - return immediately
    const extractedData: BalanceQueryIntent = {
      targetUser: patternMatch.extractedData.targetUser,
      groupContext: undefined, // Will be set by calling context
      timeRange: patternMatch.extractedData.timeRange ? {
        start: new Date(patternMatch.extractedData.timeRange.start),
        end: new Date(patternMatch.extractedData.timeRange.end)
      } : undefined,
      queryType: patternMatch.extractedData.queryType,
    }
    
    return {
      intent: 'balance_query',
      confidence: patternMatch.confidence,
      extractedData,
    }
  }
  
  // Fallback to AI classification for complex or ambiguous queries
  const balancePrompt = `You are specialized in detecting balance and debt queries with enhanced pattern recognition.

BALANCE QUERY INDICATORS:
- Direct balance queries: "How much does [name] owe me?", "What's my balance with [name]?"
- General balance checks: "Show me all balances", "Who owes money?"
- Reimbursement status: "Did [name] pay me back?", "Has [name] paid?"
- Settlement suggestions: "How should we settle up?", "What are the reimbursements?"
- Historical queries: "What was the balance last week?"

AVAILABLE PARTICIPANTS: ${participantNames.join(', ')}

ENHANCED EXTRACTION:
- targetUser: Specific person mentioned (validate against participant list)
- queryType: "specific_balance" | "general_balance" | "reimbursement_status" | "settlement_suggestions" | "historical_balance"
- timeRange: Date range if specified (last week, yesterday, etc.)
- confidence adjustment: Lower confidence for unknown participants

If this is clearly a balance query, respond with JSON:
{
  "intent": "balance_query",
  "confidence": 0.7-1.0,
  "extractedData": {
    "targetUser": "participant_name" or null,
    "queryType": "specific_balance",
    "timeRange": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} or null
  }
}

If participant name not recognized, respond with:
{
  "intent": "balance_query",
  "confidence": 0.4,
  "extractedData": {
    "targetUser": "unrecognized_name",
    "queryType": "specific_balance"
  },
  "clarificationNeeded": "I don't recognize '[name]' in this group. Current participants are: [list]"
}

If not a balance query, return confidence < 0.3.`

  const result = await parseWithSpecificPrompt(
    message,
    balancePrompt,
    language,
    groupContext,
  )
  
  // Post-process result to add clarification for unknown participants
  if (result.intent === 'balance_query' && result.extractedData) {
    const data = result.extractedData as BalanceQueryIntent
    if (data.targetUser && !participantNames.some(p => p.toLowerCase() === data.targetUser!.toLowerCase())) {
      result.clarificationNeeded = FALLBACK_CLARIFICATIONS.unknown_participant(
        data.targetUser,
        participantNames
      )
      result.confidence = Math.min(result.confidence, 0.4)
    }
  }
  
  return result
}

export async function classifyGroupManagementIntent(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  // Import group management patterns for faster, more accurate classification
  const { parseGroupManagementIntent } = await import('./ai-conversation/group-management-patterns')
  
  // First try pattern matching for faster, more accurate classification
  const patternMatch = parseGroupManagementIntent(message)
  
  if (patternMatch && patternMatch.confidence > 0.7) {
    // High confidence pattern match - return immediately
    return {
      intent: 'group_management',
      confidence: patternMatch.confidence,
      extractedData: patternMatch,
    }
  }
  
  // Fallback to AI classification for complex or ambiguous queries
  const groupPrompt = `You are specialized in detecting group management requests with enhanced pattern recognition.

GROUP MANAGEMENT INDICATORS:
- Group Creation: "create group", "new group", "start group", "make group"
- Participant Management: "add [person]", "invite", "remove [person]", "kick"
- Group Navigation: "switch to [group]", "go to [group]", "open [group]"
- Group Updates: "change currency", "update group", "modify group"
- Group Listing: "show groups", "list groups", "my groups"

ENHANCED EXTRACTION:
- action: "create_group" | "add_participant" | "remove_participant" | "update_group" | "switch_group" | "list_groups"  
- groupName: Extract group name, clean prefixes like "the", "our", "my"
- participants: Extract participant names, split by separators (comma, "and", etc.)
- currency: Extract currency mentions (USD, EUR, dollars, euros, etc.)
- confidence: Adjust based on clarity and pattern matching

If this is clearly group management, respond with JSON:
{
  "intent": "group_management",
  "confidence": 0.7-1.0,
  "extractedData": {
    "action": "create_group",
    "groupName": "clean_name",
    "participants": ["name1", "name2"],
    "currency": "USD",
    "confidence": 0.85
  }
}

If not group management, return confidence < 0.3.`

  const result = await parseWithSpecificPrompt(
    message,
    groupPrompt,
    language,
    groupContext,
  )
  
  // If AI classification has higher confidence than pattern matching, use it
  return result.confidence > (patternMatch?.confidence || 0) ? result : {
    intent: 'group_management',
    confidence: patternMatch?.confidence || 0,
    extractedData: patternMatch,
  }
}

export async function classifyExpenseHistoryIntent(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  const historyPrompt = `You are specialized in detecting expense history and analytics queries.

HISTORY QUERY INDICATORS:
- "show expenses", "list expenses", "history"
- "last month", "this week", "recent"
- "spent on [category]", "food expenses"
- "[person]'s expenses", "my spending"
- "total", "summary", "report"

EXTRACT:
- timeRange: Date range from natural language
- category: Category name if specified
- participant: Person name if specified
- minAmount/maxAmount: Amount ranges if mentioned

If this is clearly expense history, respond with JSON:
{
  "intent": "expense_history",
  "confidence": 0.8-1.0,
  "extractedData": {
    "timeRange": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} or null,
    "category": "category_name" or null,
    "participant": "name" or null,
    "minAmount": number_in_cents or null,
    "maxAmount": number_in_cents or null
  }
}

If not expense history, return confidence < 0.3.`

  return await parseWithSpecificPrompt(
    message,
    historyPrompt,
    language,
    groupContext,
  )
}

export async function classifyReimbursementStatusIntent(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  const reimbursementPrompt = `You are specialized in detecting reimbursement status queries.

REIMBURSEMENT INDICATORS:
- "payment status", "paid back", "reimbursed"
- "settled", "cleared", "paid off"
- "pending payments", "outstanding"
- "[person] paid me", "I paid [person]"

EXTRACT:
- targetUser: Person involved in payment
- groupContext: Group context if mentioned

If this is clearly reimbursement status, respond with JSON:
{
  "intent": "reimbursement_status",
  "confidence": 0.8-1.0,
  "extractedData": {
    "targetUser": "name" or null,
    "groupContext": "group_name" or null
  }
}

If not reimbursement status, return confidence < 0.3.`

  return await parseWithSpecificPrompt(
    message,
    reimbursementPrompt,
    language,
    groupContext,
  )
}

// ============================================================================
// ENHANCED INTENT CLASSIFICATION WITH CONFIDENCE SCORING
// ============================================================================

export async function classifyIntentWithConfidence(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  // Run all specialized classifiers in parallel
  const [
    expenseResult,
    balanceResult,
    groupResult,
    historyResult,
    reimbursementResult,
  ] = await Promise.all([
    classifyExpenseCreationIntent(message, language, groupContext),
    classifyBalanceQueryIntent(message, language, groupContext),
    classifyGroupManagementIntent(message, language, groupContext),
    classifyExpenseHistoryIntent(message, language, groupContext),
    classifyReimbursementStatusIntent(message, language, groupContext),
  ])

  // Find the result with highest confidence
  const results = [
    expenseResult,
    balanceResult,
    groupResult,
    historyResult,
    reimbursementResult,
  ]
  const bestResult = results.reduce((best, current) =>
    current.confidence > best.confidence ? current : best,
  )

  // If highest confidence is still low, fallback to general parsing
  if (bestResult.confidence < 0.7) {
    return await parseConversationIntent(message, language, groupContext)
  }

  return bestResult
}

// ============================================================================
// COMPREHENSIVE EXPENSE PARSING FROM NATURAL LANGUAGE
// ============================================================================

export interface ExpenseParseResult {
  success: boolean
  expenseData?: {
    amount: number
    title: string
    participants: string[]
    category?: string
    date?: string
    splitMode: 'EVENLY' | 'BY_SHARES' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
    paidBy?: string
  }
  confidence?: number
  clarificationNeeded?: string
  fallbackReason?:
    | 'timeout'
    | 'api_unavailable'
    | 'parse_error'
    | 'rate_limit'
    | 'unknown'
  validationErrors?: string[]
}

export interface ExpenseValidationResult {
  isValid: boolean
  errors: string[]
}

export async function parseExpenseFromNaturalLanguage(
  message: string,
  language: string = 'en-US',
  groupContext: {
    participants: { name: string; id: string }[]
    currency: string
  },
  categories: { id: number; name: string; grouping: string }[],
  config: Partial<AIServiceConfig> = {},
): Promise<ExpenseParseResult> {
  const finalConfig = { ...DEFAULT_AI_CONFIG, ...config }

  try {
    const contextInfo = `
CURRENT GROUP CONTEXT:
- Participants: ${groupContext.participants.map((p) => p.name).join(', ')}
- Currency: ${groupContext.currency}
- Available Categories: ${categories.map((c) => c.name).join(', ')}
`

    const expenseExtractionPrompt = `You are an expert at extracting expense information from natural language text.

TASK: Extract expense details from the user's message and return them in a structured JSON format.

EXTRACTION RULES:
1. AMOUNT: Extract monetary value and convert to cents (multiply by 100). Handle currency symbols for ${
      groupContext.currency
    }.
2. TITLE: Extract or infer expense description/merchant name
3. PARTICIPANTS: Extract mentioned names or use "all" for group split. Match against available participants: ${groupContext.participants
      .map((p) => p.name)
      .join(', ')}
4. CATEGORY: Match to existing categories if possible: ${categories
      .map((c) => c.name)
      .join(', ')}
5. DATE: Parse date references (today, yesterday, last week, specific dates) to YYYY-MM-DD format. Default to today if not specified.
6. SPLIT_MODE: Default to "EVENLY" unless specific split mentioned
7. PAID_BY: Infer who paid (usually the speaker) or use first mentioned participant

CULTURAL CONTEXT:
- Currency: ${groupContext.currency}
- Language: ${language}
- Decimal separator: ${
      ['de-DE', 'nl-NL', 'fr-FR'].includes(language)
        ? 'comma (1,50)'
        : 'dot (1.50)'
    }

RESPOND WITH JSON:
{
  "success": true,
  "confidence": 0.7-1.0,
  "expenseData": {
    "amount": number_in_cents,
    "title": "description",
    "participants": ["participant_name1", "participant_name2"] or [],
    "category": "category_name" or null,
    "date": "YYYY-MM-DD",
    "splitMode": "EVENLY",
    "paidBy": "participant_name" or null
  }
}

If extraction fails or confidence is low, respond with:
{
  "success": false,
  "confidence": 0.0-0.6,
  "clarificationNeeded": "What specific information is unclear or missing"
}

MESSAGE TO ANALYZE: "${message}"`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      temperature: 0.1, // Very low for consistent extraction
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: expenseExtractionPrompt + contextInfo,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      return {
        success: false,
        confidence: 0,
        clarificationNeeded: 'No response received from AI service',
        fallbackReason: 'unknown',
      }
    }

    const result = JSON.parse(responseContent) as ExpenseParseResult

    // Post-process and validate the extracted data
    if (result.success && result.expenseData) {
      // Validate amount
      if (!result.expenseData.amount || result.expenseData.amount <= 0) {
        return {
          success: false,
          confidence: 0.3,
          clarificationNeeded:
            'Could not extract a valid amount. Please specify how much was spent.',
          validationErrors: ['Invalid or missing amount'],
        }
      }

      // Validate title
      if (
        !result.expenseData.title ||
        result.expenseData.title.trim().length === 0
      ) {
        return {
          success: false,
          confidence: 0.3,
          clarificationNeeded:
            'Could not extract expense description. What was this expense for?',
          validationErrors: ['Missing expense description'],
        }
      }

      // Process participants - convert names to IDs
      const participantIds: string[] = []
      const missingParticipants: string[] = []

      if (result.expenseData.participants.length === 0) {
        // Default to all participants for "EVENLY" split
        participantIds.push(...groupContext.participants.map((p) => p.id))
      } else {
        for (const participantName of result.expenseData.participants) {
          const participant = groupContext.participants.find(
            (p) => p.name.toLowerCase() === participantName.toLowerCase(),
          )
          if (participant) {
            participantIds.push(participant.id)
          } else {
            missingParticipants.push(participantName)
          }
        }
      }

      if (missingParticipants.length > 0) {
        return {
          success: false,
          confidence: 0.4,
          clarificationNeeded: `Could not find participants: ${missingParticipants.join(
            ', ',
          )}. Available participants are: ${groupContext.participants
            .map((p) => p.name)
            .join(', ')}`,
          validationErrors: [
            `Unknown participants: ${missingParticipants.join(', ')}`,
          ],
        }
      }

      // Process paidBy
      let paidByParticipantId: string | undefined
      if (result.expenseData.paidBy) {
        const paidByParticipant = groupContext.participants.find(
          (p) =>
            p.name.toLowerCase() === result.expenseData!.paidBy!.toLowerCase(),
        )
        if (paidByParticipant) {
          paidByParticipantId = paidByParticipant.id
        }
      }

      // Process date - ensure valid format
      const today = new Date().toISOString().split('T')[0]
      const expenseDate = result.expenseData.date || today

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
        return {
          success: false,
          confidence: 0.4,
          clarificationNeeded:
            'Could not parse the date. Please specify a valid date.',
          validationErrors: ['Invalid date format'],
        }
      }

      // Return processed data with participant IDs
      return {
        success: true,
        confidence: result.confidence || 0.8,
        expenseData: {
          ...result.expenseData,
          participants: participantIds,
          paidBy: paidByParticipantId,
          date: expenseDate,
        },
      }
    }

    return result
  } catch (error) {
    console.error('Error parsing expense from natural language:', error)

    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        success: false,
        confidence: 0,
        clarificationNeeded:
          'The AI service is taking too long to respond. Please try again or use manual entry.',
        fallbackReason: 'timeout',
      }
    }

    return {
      success: false,
      confidence: 0,
      clarificationNeeded:
        'I had trouble understanding your expense request. Could you please rephrase it?',
      fallbackReason: 'parse_error',
    }
  }
}

export async function validateExpenseData(
  expenseData: {
    amount: number
    title: string
    participants: string[]
    category?: string
    date?: string
    splitMode: 'EVENLY' | 'BY_SHARES' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
    paidBy?: string
  },
  group: { participants: { id: string; name: string }[]; currency: string },
  categories: { id: number; name: string; grouping: string }[],
): Promise<ExpenseValidationResult> {
  const errors: string[] = []

  // Validate amount
  if (!expenseData.amount || expenseData.amount <= 0) {
    errors.push('Amount must be greater than zero')
  }

  if (expenseData.amount > 10_000_000_00) {
    // 10 million in cents
    errors.push('Amount exceeds maximum limit')
  }

  // Validate title
  if (!expenseData.title || expenseData.title.trim().length < 2) {
    errors.push('Title must be at least 2 characters long')
  }

  if (expenseData.title && expenseData.title.length > 100) {
    errors.push('Title is too long (maximum 100 characters)')
  }

  // Validate participants
  if (!expenseData.participants || expenseData.participants.length === 0) {
    errors.push('At least one participant is required')
  } else {
    const validParticipantIds = group.participants.map((p) => p.id)
    const invalidParticipants = expenseData.participants.filter(
      (participantId) => !validParticipantIds.includes(participantId),
    )
    if (invalidParticipants.length > 0) {
      errors.push(`Invalid participants: ${invalidParticipants.join(', ')}`)
    }
  }

  // Validate paidBy
  if (expenseData.paidBy) {
    const validParticipantIds = group.participants.map((p) => p.id)
    if (!validParticipantIds.includes(expenseData.paidBy)) {
      errors.push('Invalid payer participant')
    }
  }

  // Validate category
  if (expenseData.category) {
    const categoryExists = categories.some(
      (c) => c.name.toLowerCase() === expenseData.category!.toLowerCase(),
    )
    if (!categoryExists) {
      errors.push(`Invalid category: ${expenseData.category}`)
    }
  }

  // Validate date
  if (expenseData.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseData.date)) {
      errors.push('Invalid date format (expected YYYY-MM-DD)')
    } else {
      const expenseDate = new Date(expenseData.date)
      const today = new Date()
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(today.getFullYear() - 1)
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(today.getFullYear() + 1)

      if (expenseDate < oneYearAgo || expenseDate > oneYearFromNow) {
        errors.push('Date must be within one year of today')
      }
    }
  }

  // Validate split mode
  const validSplitModes = ['EVENLY', 'BY_SHARES', 'BY_AMOUNT', 'BY_PERCENTAGE']
  if (!validSplitModes.includes(expenseData.splitMode)) {
    errors.push('Invalid split mode')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// STRUCTURED DATA EXTRACTION HELPERS
// ============================================================================

export function extractAmountFromText(text: string): number | null {
  // Match various currency patterns: $25, 25.50, €30, £15.99
  const amountRegex = /[\$€£¥]?(\d+(?:[.,]\d{2})?)/g
  const matches = text.match(amountRegex)

  if (matches && matches.length > 0) {
    const amountStr = matches[0].replace(/[\$€£¥]/g, '')
    const amount = parseFloat(amountStr.replace(',', '.'))
    return Math.round(amount * 100) // Convert to cents
  }

  return null
}

export function extractNamesFromText(
  text: string,
  availableParticipants: string[],
): string[] {
  const foundNames: string[] = []

  for (const participant of availableParticipants) {
    const nameRegex = new RegExp(`\\b${participant}\\b`, 'i')
    if (nameRegex.test(text)) {
      foundNames.push(participant)
    }
  }

  return foundNames
}

export function extractDateFromText(text: string): Date | null {
  const today = new Date()

  // Handle relative dates
  if (/\btoday\b/i.test(text)) {
    return today
  }

  if (/\byesterday\b/i.test(text)) {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return yesterday
  }

  if (/\blast week\b/i.test(text)) {
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    return lastWeek
  }

  // Handle specific date patterns (MM/DD/YYYY, DD-MM-YYYY, etc.)
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
  const match = text.match(dateRegex)

  if (match) {
    const [, month, day, year] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  return null
}

// ============================================================================
// HELPER FUNCTION FOR SPECIFIC PROMPTS
// ============================================================================

async function parseWithSpecificPrompt(
  message: string,
  prompt: string,
  language: string,
  groupContext?: { participants: { name: string }[]; currency: string },
): Promise<ConversationParseResult> {
  try {
    const contextInfo = groupContext
      ? `
    
CURRENT GROUP CONTEXT:
- Participants: ${groupContext.participants.map((p) => p.name).join(', ')}
- Currency: ${groupContext.currency}
`
      : ''

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      temperature: 0.1, // Very low for consistent classification
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: prompt + contextInfo,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    const result = JSON.parse(responseContent) as ConversationParseResult
    return result
  } catch (error) {
    console.error('Error in specific intent classification:', error)

    return {
      intent: 'unclear',
      confidence: 0.0,
      extractedData: null,
      clarificationNeeded:
        'I had trouble understanding your request. Could you please rephrase it?',
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatAmountFromCents(
  cents: number,
  currency: string = 'USD',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100)
}

export function parseAmountToCents(amountString: string): number {
  // Remove currency symbols and parse to cents
  const cleanAmount = amountString.replace(/[^\d.,]/g, '')
  const amount = parseFloat(cleanAmount.replace(',', '.'))
  return Math.round(amount * 100)
}

export function isValidIntent(intent: string): intent is ConversationIntent {
  return [
    'expense_creation',
    'balance_query',
    'group_management',
    'expense_history',
    'reimbursement_status',
    'unclear',
  ].includes(intent)
}

// ============================================================================
// ERROR HANDLING AND FALLBACK MECHANISMS
// ============================================================================

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Enhanced conversation intent parsing with robust error handling
 */
export async function parseConversationIntentWithErrorHandling(
  message: string,
  language: string = 'en-US',
  groupContext?: { participants: { name: string }[]; currency: string },
  config: Partial<AIServiceConfig> = {},
): Promise<ConversationParseResult | FallbackResult> {
  const finalConfig = { ...DEFAULT_AI_CONFIG, ...config }

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new AIServiceError(
              `AI response timeout after ${finalConfig.timeout}ms`,
              'TIMEOUT',
              true,
            ),
          )
        }, finalConfig.timeout)
      })

      // Race between the AI call and timeout
      const resultPromise = classifyIntentWithConfidence(
        message,
        language,
        groupContext,
      )
      const result = await Promise.race([resultPromise, timeoutPromise])

      // Validate result structure
      if (!isValidConversationResult(result)) {
        throw new AIServiceError(
          'Invalid response structure from AI',
          'INVALID_RESPONSE',
          true,
        )
      }

      // Check for ambiguous intent detection
      if (result.confidence < 0.3) {
        return createAmbiguousFallback(message, language)
      }

      return result
    } catch (error) {
      console.warn(`AI service attempt ${attempt + 1} failed:`, error)

      // Determine if we should retry
      const shouldRetry =
        attempt < finalConfig.maxRetries && isRetryableError(error)

      if (!shouldRetry) {
        // Final attempt failed, return appropriate fallback
        return createErrorFallback(error, language, finalConfig.enableFallback)
      }

      // Exponential backoff for retries
      if (attempt < finalConfig.maxRetries) {
        const delay = finalConfig.baseRetryDelay * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  }

  // This should never be reached, but just in case
  return createGenericFallback(language)
}

/**
 * Detect if intent is ambiguous and provide clarification prompts
 */
function createAmbiguousFallback(
  message: string,
  language: string,
): FallbackResult {
  const clarificationPrompts = {
    'en-US':
      "I'm not sure what you'd like to do. Could you clarify if you want to add an expense, check balances, or manage your group?",
    es: 'No estoy seguro de lo que quieres hacer. ¿Podrías aclarar si quieres agregar un gasto, revisar saldos o gestionar tu grupo?',
    'fr-FR':
      'Je ne suis pas sûr de ce que vous voulez faire. Pourriez-vous préciser si vous voulez ajouter une dépense, vérifier les soldes ou gérer votre groupe?',
    'de-DE':
      'Ich bin nicht sicher, was Sie tun möchten. Könnten Sie klären, ob Sie eine Ausgabe hinzufügen, Salden prüfen oder Ihre Gruppe verwalten möchten?',
    'zh-CN':
      '我不确定您想做什么。您能澄清一下是想添加支出、查看余额还是管理群组吗？',
    'zh-TW':
      '我不確定您想做什麼。您能澄清一下是想新增支出、查看餘額還是管理群組嗎？',
    'pl-PL':
      'Nie jestem pewien, co chcesz zrobić. Czy mógłbyś wyjaśnić, czy chcesz dodać wydatek, sprawdzić salda, czy zarządzać grupą?',
    'ru-RU':
      'Я не уверен, что вы хотите сделать. Не могли бы вы уточнить, хотите ли вы добавить расход, проверить балансы или управлять группой?',
    'it-IT':
      'Non sono sicuro di cosa vuoi fare. Potresti chiarire se vuoi aggiungere una spesa, controllare i saldi o gestire il tuo gruppo?',
    'ua-UA':
      'Я не впевнений, що ви хочете зробити. Чи могли б ви уточнити, чи хочете ви додати витрату, перевірити баланси або керувати групою?',
    ro: 'Nu sunt sigur ce doriți să faceți. Ați putea clarifica dacă doriți să adăugați o cheltuială, să verificați soldurile sau să gestionați grupul?',
    'tr-TR':
      'Ne yapmak istediğinizden emin değilim. Bir gider eklemek, bakiyeleri kontrol etmek veya grubunuzu yönetmek isteyip istemediğinizi açıklayabilir misiniz?',
    'pt-BR':
      'Não tenho certeza do que você quer fazer. Você poderia esclarecer se quer adicionar uma despesa, verificar saldos ou gerenciar seu grupo?',
    'nl-NL':
      'Ik weet niet zeker wat u wilt doen. Kunt u verduidelijken of u een uitgave wilt toevoegen, saldi wilt controleren of uw groep wilt beheren?',
    fi: 'En ole varma, mitä haluat tehdä. Voisitko selventää, haluatko lisätä kulun, tarkistaa saldoja vai hallita ryhmääsi?',
  } as const

  return {
    intent: 'unclear',
    confidence: 0,
    extractedData: null,
    clarificationNeeded:
      clarificationPrompts[language as keyof typeof clarificationPrompts] ||
      clarificationPrompts['en-US'],
    fallbackReason: 'unknown',
  }
}

/**
 * Create fallback response based on error type
 */
function createErrorFallback(
  error: unknown,
  language: string,
  enableFallback: boolean,
): FallbackResult {
  if (!enableFallback) {
    throw error
  }

  let fallbackReason: FallbackResult['fallbackReason'] = 'unknown'
  let clarificationMessage =
    "I'm having trouble understanding your request right now. Please try again or use the manual options."

  if (error instanceof AIServiceError) {
    switch (error.code) {
      case 'TIMEOUT':
        fallbackReason = 'timeout'
        clarificationMessage =
          'The AI service is taking too long to respond. Please try again or use the manual entry options.'
        break
      case 'API_UNAVAILABLE':
        fallbackReason = 'api_unavailable'
        clarificationMessage =
          'The AI service is currently unavailable. Please use the manual entry options or try again later.'
        break
      case 'RATE_LIMIT':
        fallbackReason = 'rate_limit'
        clarificationMessage =
          'Too many requests. Please wait a moment and try again, or use the manual entry options.'
        break
      case 'PARSE_ERROR':
      case 'INVALID_RESPONSE':
        fallbackReason = 'parse_error'
        clarificationMessage =
          'I had trouble processing your request. Please rephrase it or use the manual entry options.'
        break
    }
  }

  // Translate clarification message based on language
  const localizedMessage = getLocalizedErrorMessage(
    clarificationMessage,
    language,
  )

  return {
    intent: 'unclear',
    confidence: 0,
    extractedData: null,
    clarificationNeeded: localizedMessage,
    fallbackReason,
  }
}

/**
 * Generic fallback when all else fails
 */
function createGenericFallback(language: string): FallbackResult {
  return {
    intent: 'unclear',
    confidence: 0,
    extractedData: null,
    clarificationNeeded: getLocalizedErrorMessage(
      'Something went wrong. Please use the manual entry options.',
      language,
    ),
    fallbackReason: 'unknown',
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AIServiceError) {
    return error.retry
  }

  // Check for common retryable error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('rate limit')
    )
  }

  return true // Default to retryable for unknown errors
}

/**
 * Validate conversation result structure
 */
function isValidConversationResult(
  result: any,
): result is ConversationParseResult {
  return (
    result &&
    typeof result === 'object' &&
    typeof result.intent === 'string' &&
    isValidIntent(result.intent) &&
    typeof result.confidence === 'number' &&
    result.confidence >= 0 &&
    result.confidence <= 1
  )
}

/**
 * Get localized error messages
 */
function getLocalizedErrorMessage(message: string, language: string): string {
  const errorMessages = {
    'en-US': {
      timeout:
        'The AI service is taking too long to respond. Please try again or use the manual entry options.',
      unavailable:
        'The AI service is currently unavailable. Please use the manual entry options or try again later.',
      rateLimit:
        'Too many requests. Please wait a moment and try again, or use the manual entry options.',
      parseError:
        'I had trouble processing your request. Please rephrase it or use the manual entry options.',
      generic: 'Something went wrong. Please use the manual entry options.',
    },
    es: {
      timeout:
        'El servicio de IA está tardando mucho en responder. Inténtalo de nuevo o usa las opciones manuales.',
      unavailable:
        'El servicio de IA no está disponible. Usa las opciones manuales o inténtalo más tarde.',
      rateLimit:
        'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo, o usa las opciones manuales.',
      parseError:
        'Tuve problemas procesando tu solicitud. Por favor, reformúlala o usa las opciones manuales.',
      generic: 'Algo salió mal. Por favor, usa las opciones manuales.',
    },
    'fr-FR': {
      timeout:
        'Le service IA prend trop de temps à répondre. Veuillez réessayer ou utiliser les options manuelles.',
      unavailable:
        "Le service IA n'est pas disponible. Veuillez utiliser les options manuelles ou réessayer plus tard.",
      rateLimit:
        'Trop de requêtes. Veuillez attendre un moment et réessayer, ou utiliser les options manuelles.',
      parseError:
        "J'ai eu du mal à traiter votre demande. Veuillez la reformuler ou utiliser les options manuelles.",
      generic:
        "Quelque chose s'est mal passé. Veuillez utiliser les options manuelles.",
    },
    // Add more languages as needed...
  } as const

  const languageMessages =
    errorMessages[language as keyof typeof errorMessages] ||
    errorMessages['en-US']

  // Simple message matching for fallback
  if (message.includes('timeout')) return languageMessages.timeout
  if (message.includes('unavailable')) return languageMessages.unavailable
  if (message.includes('rate limit')) return languageMessages.rateLimit
  if (message.includes('trouble')) return languageMessages.parseError

  return languageMessages.generic
}

/**
 * Check if AI service is available (health check)
 */
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    // Simple test with minimal token usage
    const testResult = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1,
    })

    return !!testResult.choices[0]?.message
  } catch {
    return false
  }
}

/**
 * Graceful degradation wrapper for any AI function
 */
export async function withGracefulDegradation<T>(
  aiFunction: () => Promise<T>,
  fallbackValue: T,
  config: Partial<AIServiceConfig> = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_AI_CONFIG, ...config }

  if (!finalConfig.enableFallback) {
    return await aiFunction()
  }

  try {
    return await aiFunction()
  } catch (error) {
    console.warn('AI function failed, using fallback:', error)
    return fallbackValue
  }
}
