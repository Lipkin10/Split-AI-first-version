import { 
  BALANCE_HELP_RESPONSES, 
  FALLBACK_CLARIFICATIONS,
  matchBalanceQueryPattern 
} from './balance-query-patterns'
import type { 
  ConversationMessage, 
  ConversationResponse, 
  ConversationAction,
  BalanceQueryIntent 
} from './types'

// Help command patterns
export const HELP_COMMANDS = {
  BALANCE_HELP: '/balance-help',
  SHOW_BALANCES: '/show-balances', 
  CLEAR_CONVERSATION: '/clear-conversation',
} as const

// Core conversational patterns for balance queries
export interface ConversationalPatternResult {
  response: ConversationResponse
  requiresData?: boolean
  actionType?: 'help' | 'clarification' | 'balance_query' | 'navigation'
}

export class ConversationalPatternHandler {
  private participants: string[]
  private groupId: string
  private locale: string

  constructor(participants: string[], groupId: string, locale: string = 'en-US') {
    this.participants = participants
    this.groupId = groupId
    this.locale = locale
  }

  /**
   * Process a user message and determine the appropriate conversational response
   */
  processMessage(message: string): ConversationalPatternResult {
    const cleanMessage = message.trim()

    // Handle help commands first
    if (this.isHelpCommand(cleanMessage)) {
      return this.handleHelpCommand(cleanMessage)
    }

    // Try to match balance query patterns
    const patternMatch = matchBalanceQueryPattern(cleanMessage, this.participants)
    
    if (patternMatch) {
      // Check if this is a low confidence query due to unknown participant  
      if (patternMatch.confidence < 0.5) {
        return this.handleLowConfidenceQuery(patternMatch.extractedData, patternMatch.rawMatch)
      }
      return this.handleBalanceQuery(patternMatch.extractedData, patternMatch.confidence)
    }

    // Handle unclear or ambiguous queries
    return this.handleUnclearQuery(cleanMessage)
  }

  /**
   * Check if message is a help command
   */
  private isHelpCommand(message: string): boolean {
    return message.toLowerCase().startsWith('/') && 
           (Object.values(HELP_COMMANDS).some(cmd => 
             message.toLowerCase().startsWith(cmd.toLowerCase())
           ) || message.toLowerCase().includes('help'))
  }

  /**
   * Handle help commands
   */
  private handleHelpCommand(message: string): ConversationalPatternResult {
    const command = message.toLowerCase()

    if (command.startsWith(HELP_COMMANDS.BALANCE_HELP)) {
      return {
        response: {
          message: {
            id: `help-${Date.now()}`,
            type: 'assistant',
            content: this.formatBalanceHelp(),
            timestamp: new Date(),
          },
          suggestions: BALANCE_HELP_RESPONSES.patterns,
        },
        actionType: 'help',
      }
    }

    if (command.startsWith(HELP_COMMANDS.SHOW_BALANCES)) {
      return {
        response: {
          message: {
            id: `nav-${Date.now()}`,
            type: 'assistant',
            content: 'Navigating to the traditional balance view...',
            timestamp: new Date(),
          },
          actions: [{
            type: 'navigate',
            label: 'View Balances',
            url: `/groups/${this.groupId}/balances`,
          }],
        },
        actionType: 'navigation',
      }
    }

    if (command.startsWith(HELP_COMMANDS.CLEAR_CONVERSATION)) {
      return {
        response: {
          message: {
            id: `clear-${Date.now()}`,
            type: 'system',
            content: 'Conversation cleared. How can I help you with balances?',
            timestamp: new Date(),
          },
          actions: [{
            type: 'navigate',
            label: 'Clear Context',
            data: { action: 'clear_conversation' },
          }],
        },
        actionType: 'help',
      }
    }

    // Default help response
    return {
      response: {
        message: {
          id: `help-default-${Date.now()}`,
          type: 'assistant',
          content: this.formatGeneralHelp(),
          timestamp: new Date(),
        },
        suggestions: this.getQuickSuggestions(),
      },
      actionType: 'help',
    }
  }

  /**
   * Handle balance query patterns
   */
  private handleBalanceQuery(
    extractedData: NonNullable<ReturnType<typeof matchBalanceQueryPattern>>['extractedData'],
    confidence: number
  ): ConversationalPatternResult {
    if (confidence < 0.4) {
      return this.handleLowConfidenceQuery(extractedData!)
    }

    // High confidence balance query - return structured response
    const balanceQuery: BalanceQueryIntent = {
      targetUser: extractedData!.targetUser,
      queryType: extractedData!.queryType,
      timeRange: extractedData!.timeRange ? {
        start: new Date(extractedData!.timeRange.start),
        end: new Date(extractedData!.timeRange.end)
      } : undefined,
    }

    return {
      response: {
        message: {
          id: `balance-query-${Date.now()}`,
          type: 'assistant',
          content: this.formatBalanceQueryResponse(balanceQuery),
          timestamp: new Date(),
          metadata: { balanceQuery },
        },
        suggestions: this.getBalanceQuerySuggestions(balanceQuery),
      },
      requiresData: true,
      actionType: 'balance_query',
    }
  }

  /**
   * Handle low confidence balance queries
   */
  private handleLowConfidenceQuery(
    extractedData: NonNullable<ReturnType<typeof matchBalanceQueryPattern>>['extractedData'], 
    rawMatch?: string
  ): ConversationalPatternResult {
    // Use the raw matched name if available, otherwise use a generic message
    const unknownName = rawMatch || 'the mentioned person'
    
    return {
      response: {
        message: {
          id: `clarify-participant-${Date.now()}`,
          type: 'assistant',
          content: FALLBACK_CLARIFICATIONS.unknown_participant(
            unknownName,
            this.participants
          ),
          timestamp: new Date(),
        },
        actions: this.participants.map(participant => ({
          type: 'retry' as const,
          label: participant,
          data: { 
            suggestedQuery: `How much does ${participant} owe me?`,
            targetUser: participant 
          },
        })),
      },
      actionType: 'clarification',
    }
  }

  /**
   * Handle unclear or ambiguous queries
   */
  private handleUnclearQuery(message: string): ConversationalPatternResult {
    return {
      response: {
        message: {
          id: `unclear-${Date.now()}`,
          type: 'assistant',
          content: FALLBACK_CLARIFICATIONS.ambiguous_query(),
          timestamp: new Date(),
        },
        suggestions: [
          `How much does ${this.participants[0] || '[name]'} owe me?`,
          'Show me all balances',
          'Who owes money?',
          'How should we settle up?',
        ],
        actions: [{
          type: 'navigate',
          label: 'View Traditional Balance Page',
          url: `/groups/${this.groupId}/balances`,
        }],
      },
      actionType: 'clarification',
    }
  }

  /**
   * Format balance help response
   */
  private formatBalanceHelp(): string {
    return `Here are the balance queries I can help you with:

**Query Examples:**
${BALANCE_HELP_RESPONSES.patterns.map(pattern => `• ${pattern}`).join('\n')}

**Available Commands:**
${BALANCE_HELP_RESPONSES.commands.map(cmd => `• ${cmd}`).join('\n')}

**Current Participants:** ${this.participants.join(', ')}`
  }

  /**
   * Format general help response
   */
  private formatGeneralHelp(): string {
    return `I can help you with balance queries and expense management. Here are some things you can ask:

• Check individual balances
• View all group balances  
• Ask about reimbursement status
• Get settlement suggestions
• Navigate to different views

Type \`${HELP_COMMANDS.BALANCE_HELP}\` for specific balance query examples.`
  }

  /**
   * Format balance query response text
   */
  private formatBalanceQueryResponse(query: BalanceQueryIntent): string {
    switch (query.queryType) {
      case 'specific_balance':
        return query.targetUser 
          ? `Let me check the balance between you and ${query.targetUser}...`
          : 'Let me show you the individual balance details...'
          
      case 'general_balance':
        return 'Here are all the current balances in your group...'
        
      case 'settlement_suggestions':
        return 'Here are the optimal reimbursement suggestions to settle all balances...'
        
      case 'reimbursement_status':
        return query.targetUser
          ? `Let me check the reimbursement status with ${query.targetUser}...`
          : 'Let me check the current reimbursement statuses...'
          
      case 'historical_balance':
        return 'Historical balance data is coming soon. Here are your current balances...'
        
      default:
        return 'Let me get the balance information for you...'
    }
  }

  /**
   * Get suggestions based on balance query type
   */
  private getBalanceQuerySuggestions(query: BalanceQueryIntent): string[] {
    const suggestions: string[] = []

    switch (query.queryType) {
      case 'specific_balance':
        suggestions.push('Show me all balances', 'How should we settle up?')
        // Add other participants as suggestions
        this.participants.forEach(participant => {
          if (participant !== query.targetUser) {
            suggestions.push(`How much does ${participant} owe me?`)
          }
        })
        break
        
      case 'general_balance':
        suggestions.push('How should we settle up?')
        // Add individual balance checks
        this.participants.forEach(participant => {
          suggestions.push(`How much does ${participant} owe me?`)
        })
        break
        
      case 'settlement_suggestions':
        suggestions.push('Show me all balances')
        break
        
      case 'reimbursement_status':
        suggestions.push('Show me all balances', 'How should we settle up?')
        break
        
      default:
        suggestions.push('Show me all balances', 'How should we settle up?')
    }

    return suggestions.slice(0, 4) // Limit to 4 suggestions
  }

  /**
   * Get quick suggestions for unclear queries
   */
  private getQuickSuggestions(): string[] {
    const suggestions = [
      'Show me all balances',
      'How should we settle up?',
      'Who owes money?',
    ]

    // Add participant-specific suggestions if we have participants
    if (this.participants.length > 0) {
      suggestions.unshift(`How much does ${this.participants[0]} owe me?`)
    }

    return suggestions
  }

  /**
   * Update participants list (useful when group membership changes)
   */
  updateParticipants(participants: string[]): void {
    this.participants = participants
  }

  /**
   * Update group context
   */
  updateGroupContext(groupId: string, locale?: string): void {
    this.groupId = groupId
    if (locale) {
      this.locale = locale
    }
  }

  /**
   * Check if a message likely contains a balance query intent
   */
  static containsBalanceIntent(message: string): boolean {
    const balanceKeywords = [
      'balance', 'owe', 'owes', 'debt', 'pay', 'paid', 'payment',
      'settle', 'settlement', 'reimburse', 'reimbursement',
      'who needs', 'how much', 'money', 'amount'
    ]

    const lowerMessage = message.toLowerCase()
    return balanceKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  /**
   * Extract potential participant names from a message
   */
  static extractMentionedParticipants(message: string, availableParticipants: string[]): string[] {
    const mentioned: string[] = []
    const lowerMessage = message.toLowerCase()

    for (const participant of availableParticipants) {
      const lowerParticipant = participant.toLowerCase()
      if (lowerMessage.includes(lowerParticipant)) {
        mentioned.push(participant)
      }
    }

    return mentioned
  }
}