import {
  ConversationIntent,
  DEFAULT_AI_CONFIG,
  checkAIServiceHealth,
  parseConversationIntentWithErrorHandling,
  parseExpenseFromNaturalLanguage,
  validateExpenseData,
} from '@/lib/ai-conversation'
import { baseProcedure, createTRPCRouter } from '@/trpc/init'
import { z } from 'zod'

// ============================================================================
// INPUT/OUTPUT SCHEMAS
// ============================================================================

const conversationInputSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message too long'),
  groupId: z.string().optional(),
  language: z.string().default('en-US'),
  enableFallback: z.boolean().default(true),
})

const expenseCreationInputSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message too long'),
  groupId: z.string().min(1, 'Group ID is required for expense creation'),
  language: z.string().default('en-US'),
  enableFallback: z.boolean().default(true),
})

const conversationOutputSchema = z.object({
  intent: z.enum([
    'expense_creation',
    'balance_query',
    'group_management',
    'expense_history',
    'reimbursement_status',
    'unclear',
  ]),
  confidence: z.number().min(0).max(1),
  extractedData: z.any().nullable(),
  clarificationNeeded: z.string().optional(),
  fallbackReason: z
    .enum([
      'timeout',
      'api_unavailable',
      'parse_error',
      'rate_limit',
      'unknown',
    ])
    .optional(),
})

const expenseCreationOutputSchema = z.object({
  success: z.boolean(),
  expenseData: z
    .object({
      amount: z.number(),
      title: z.string(),
      participants: z.array(z.string()),
      category: z.string().optional(),
      date: z.string().optional(),
      splitMode: z
        .enum(['EVENLY', 'BY_SHARES', 'BY_AMOUNT', 'BY_PERCENTAGE'])
        .default('EVENLY'),
      paidBy: z.string().optional(),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
  clarificationNeeded: z.string().optional(),
  fallbackReason: z
    .enum([
      'timeout',
      'api_unavailable',
      'parse_error',
      'rate_limit',
      'unknown',
      'validation_error',
    ])
    .optional(),
  validationErrors: z.array(z.string()).optional(),
})

const healthCheckOutputSchema = z.object({
  isHealthy: z.boolean(),
  timestamp: z.string(),
  responseTime: z.number().optional(),
})

// ============================================================================
// CONVERSATION ROUTER
// ============================================================================

export const conversationRouter = createTRPCRouter({
  /**
   * Parse user's natural language input and classify intent
   */
  parseIntent: baseProcedure
    .input(conversationInputSchema)
    .output(conversationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const startTime = Date.now()

        // Get group context if groupId provided
        let groupContext:
          | { participants: { name: string }[]; currency: string }
          | undefined

        if (input.groupId) {
          try {
            // Import and use existing group API function
            const { getGroup } = await import('@/lib/api')
            const group = await getGroup(input.groupId)

            if (group) {
              groupContext = {
                participants: group.participants.map((p) => ({ name: p.name })),
                currency: group.currency,
              }
            }
          } catch (error) {
            console.warn('Failed to fetch group context:', error)
            // Continue without group context
          }
        }

        // Parse the conversation intent
        const result = await parseConversationIntentWithErrorHandling(
          input.message,
          input.language,
          groupContext,
          {
            enableFallback: input.enableFallback,
            timeout: 3000, // Enforce 3-second limit
          },
        )

        const responseTime = Date.now() - startTime

        // Log metrics for monitoring
        console.log(`AI conversation parsing completed in ${responseTime}ms`, {
          intent: result.intent,
          confidence: result.confidence,
          hasGroupContext: !!groupContext,
          language: input.language,
        })

        return result
      } catch (error) {
        console.error('Error in conversation parsing endpoint:', error)

        // Return fallback result for any unhandled errors
        return {
          intent: 'unclear' as ConversationIntent,
          confidence: 0,
          extractedData: null,
          clarificationNeeded:
            'I had trouble processing your request. Please try again or use the manual entry options.',
          fallbackReason: 'unknown' as const,
        }
      }
    }),

  /**
   * Create expense from natural language text with comprehensive validation
   */
  createExpenseFromText: baseProcedure
    .input(expenseCreationInputSchema)
    .output(expenseCreationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const startTime = Date.now()

        // Get group context (required for expense creation)
        const { getGroup, getCategories } = await import('@/lib/api')
        const [group, categories] = await Promise.all([
          getGroup(input.groupId),
          getCategories(),
        ])

        if (!group) {
          return {
            success: false,
            confidence: 0,
            clarificationNeeded:
              'Could not find the specified group. Please check the group and try again.',
            fallbackReason: 'validation_error' as const,
            validationErrors: ['Invalid group ID'],
          }
        }

        const groupContext = {
          participants: group.participants.map((p) => ({
            name: p.name,
            id: p.id,
          })),
          currency: group.currency,
        }

        // Parse expense from natural language
        const parseResult = await parseExpenseFromNaturalLanguage(
          input.message,
          input.language,
          groupContext,
          categories,
          {
            enableFallback: input.enableFallback,
            timeout: 3000,
          },
        )

        if (!parseResult.success) {
          return {
            success: false,
            confidence: parseResult.confidence || 0,
            clarificationNeeded:
              parseResult.clarificationNeeded ||
              'I had trouble understanding your expense request. Could you please provide more details?',
            fallbackReason: parseResult.fallbackReason || 'parse_error',
            validationErrors: parseResult.validationErrors,
          }
        }

        // Validate extracted expense data
        const validationResult = await validateExpenseData(
          parseResult.expenseData!,
          group,
          categories,
        )

        if (!validationResult.isValid) {
          return {
            success: false,
            confidence: parseResult.confidence || 0,
            clarificationNeeded: `I extracted the expense information, but found some issues: ${validationResult.errors.join(
              ', ',
            )}. Could you please clarify?`,
            fallbackReason: 'validation_error' as const,
            validationErrors: validationResult.errors,
          }
        }

        const responseTime = Date.now() - startTime

        // Log metrics for monitoring
        console.log(
          `AI expense creation parsing completed in ${responseTime}ms`,
          {
            success: true,
            confidence: parseResult.confidence,
            extractedAmount: parseResult.expenseData?.amount,
            language: input.language,
          },
        )

        return {
          success: true,
          expenseData: parseResult.expenseData!,
          confidence: parseResult.confidence || 0.8,
        }
      } catch (error) {
        console.error('Error in expense creation from text:', error)

        return {
          success: false,
          confidence: 0,
          clarificationNeeded:
            'I had trouble processing your expense request. Please try again or use the manual entry form.',
          fallbackReason: 'unknown' as const,
        }
      }
    }),

  /**
   * Health check for AI service availability
   */
  healthCheck: baseProcedure.output(healthCheckOutputSchema).query(async () => {
    const startTime = Date.now()

    try {
      const isHealthy = await checkAIServiceHealth()
      const responseTime = Date.now() - startTime

      return {
        isHealthy,
        timestamp: new Date().toISOString(),
        responseTime,
      }
    } catch (error) {
      console.error('AI service health check failed:', error)

      return {
        isHealthy: false,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      }
    }
  }),

  /**
   * Get AI service configuration
   */
  getConfig: baseProcedure
    .output(
      z.object({
        timeout: z.number(),
        maxRetries: z.number(),
        baseRetryDelay: z.number(),
        enableFallback: z.boolean(),
      }),
    )
    .query(() => {
      return DEFAULT_AI_CONFIG
    }),
})

export type ConversationRouter = typeof conversationRouter
