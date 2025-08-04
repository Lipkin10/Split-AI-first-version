// ============================================================================
// BALANCE QUERY PATTERNS FOR CONVERSATIONAL AI
// ============================================================================

export interface BalanceQueryPattern {
  pattern: RegExp
  extractData: (match: RegExpMatchArray, participants: string[]) => {
    targetUser?: string
    queryType: 'specific_balance' | 'general_balance' | 'reimbursement_status' | 'settlement_suggestions' | 'historical_balance'
    timeRange?: { start: string; end: string }
  }
  confidence: number
}

export const BALANCE_QUERY_PATTERNS: BalanceQueryPattern[] = [
  // Pattern 1: Direct Balance Query - "How much does John owe me?"
  {
    pattern: /(?:how much|what.*amount).*(?:does|do)\s+([^\s]+)\s+owe(?:\s+me)?/i,
    extractData: (match, participants) => ({
      targetUser: findParticipant(match[1], participants),
      queryType: 'specific_balance',
    }),
    confidence: 0.9,
  },

  // Pattern 2: Reverse Balance Query - "How much do I owe John?"
  {
    pattern: /(?:how much|what.*amount).*(?:do|did)\s+I\s+owe\s+([^\s]+)/i,
    extractData: (match, participants) => ({
      targetUser: findParticipant(match[1], participants),
      queryType: 'specific_balance',
    }),
    confidence: 0.9,
  },

  // Pattern 3: General Balance Check - "Show me all balances"
  {
    pattern: /(?:show|display|what.*are?).*(?:all\s+)?balanc(?:es?|ing)/i,
    extractData: () => ({
      queryType: 'general_balance',
    }),
    confidence: 0.8,
  },

  // Pattern 4: Reimbursement Status - "Did John pay me back?"
  {
    pattern: /(?:did|has)\s+([^\s]+)\s+(?:pay.*back|paid.*me|reimburse)/i,
    extractData: (match, participants) => ({
      targetUser: findParticipant(match[1], participants),
      queryType: 'reimbursement_status',
    }),
    confidence: 0.9,
  },

  // Pattern 5: Who owes money - "Who owes money?"
  {
    pattern: /who.*(?:owes?|needs? to pay|should pay)/i,
    extractData: () => ({
      queryType: 'general_balance',
    }),
    confidence: 0.8,
  },

  // Pattern 6: Settlement Suggestions - "How should we settle up?"
  {
    pattern: /(?:how.*settl|suggest.*payment|optimal.*reimburse)/i,
    extractData: () => ({
      queryType: 'settlement_suggestions',
    }),
    confidence: 0.8,
  },

  // Pattern 7: My balance with someone - "What's my balance with John?"
  {
    pattern: /(?:what.*my|show.*my)\s+balance.*with\s+([^\s]+)/i,
    extractData: (match, participants) => ({
      targetUser: findParticipant(match[1], participants),
      queryType: 'specific_balance',
    }),
    confidence: 0.9,
  },

  // Pattern 8: Historical balance queries - "What was the balance last week?"
  {
    pattern: /(?:what.*balance|show.*balance).*(?:last\s+week|yesterday|last\s+month)/i,
    extractData: (match) => ({
      queryType: 'historical_balance',
      timeRange: parseTimeRange(match[0]),
    }),
    confidence: 0.7,
  },

  // Pattern 9: Money owed variations
  {
    pattern: /(?:money|amount).*(?:owed|due).*(?:to|from|by)\s+([^\s]+)/i,
    extractData: (match, participants) => ({
      targetUser: findParticipant(match[1], participants),
      queryType: 'specific_balance',
    }),
    confidence: 0.8,
  },

  // Pattern 10: Debt-related queries
  {
    pattern: /(?:debt|what.*([^\s]+).*owes)/i,
    extractData: (match, participants) => ({
      targetUser: findParticipant(match[1], participants),
      queryType: 'specific_balance',
    }),
    confidence: 0.7,
  },
]

// Helper function to find participant names (case-insensitive)
function findParticipant(name: string, participants: string[]): string | undefined {
  if (!name || participants.length === 0) return undefined
  
  const lowerName = name.toLowerCase()
  return participants.find(p => p.toLowerCase() === lowerName || p.toLowerCase().includes(lowerName))
}

// Helper function to parse time ranges from natural language
function parseTimeRange(text: string): { start: string; end: string } | undefined {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  if (/last\s+week/i.test(text)) {
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    return {
      start: lastWeek.toISOString().split('T')[0],
      end: todayStr,
    }
  }
  
  if (/yesterday/i.test(text)) {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    return {
      start: yesterdayStr,
      end: yesterdayStr,
    }
  }
  
  if (/last\s+month/i.test(text)) {
    const lastMonth = new Date(today)
    lastMonth.setMonth(today.getMonth() - 1)
    return {
      start: lastMonth.toISOString().split('T')[0],
      end: todayStr,
    }
  }
  
  return undefined
}

// Confidence scoring for participant name matches
export function calculateParticipantMatchConfidence(
  extractedName: string | undefined,
  availableParticipants: string[]
): number {
  if (!extractedName) return 0.5
  
  const lowerExtracted = extractedName.toLowerCase()
  
  // Exact match
  if (availableParticipants.some(p => p.toLowerCase() === lowerExtracted)) {
    return 1.0
  }
  
  // Partial match
  if (availableParticipants.some(p => p.toLowerCase().includes(lowerExtracted))) {
    return 0.8
  }
  
  // No match
  return 0.3
}

// Enhanced pattern matching with participant validation
export function matchBalanceQueryPattern(
  message: string,
  participants: string[]
): {
  pattern: BalanceQueryPattern
  extractedData: ReturnType<BalanceQueryPattern['extractData']>
  confidence: number
  rawMatch?: string
} | null {
  for (const pattern of BALANCE_QUERY_PATTERNS) {
    const match = message.match(pattern.pattern)
    if (match) {
      const extractedData = pattern.extractData(match, participants)
      let adjustedConfidence = pattern.confidence
      
      // Adjust confidence based on participant recognition
      if (extractedData.targetUser) {
        const participantFound = participants.some(p => 
          p.toLowerCase() === extractedData.targetUser!.toLowerCase()
        )
        
        if (!participantFound) {
          // If participant not found, lower confidence significantly
          adjustedConfidence = Math.min(adjustedConfidence * 0.3, 0.4)
        }
      } else if (match[1]) {
        // If we captured a name but findParticipant returned undefined
        const participantFound = participants.some(p => 
          p.toLowerCase() === match[1].toLowerCase()
        )
        
        if (!participantFound) {
          // Name was captured but not found in participants
          adjustedConfidence = Math.min(adjustedConfidence * 0.3, 0.4)
        }
      }
      
      return {
        pattern,
        extractedData,
        confidence: adjustedConfidence,
        rawMatch: match[1], // Capture the raw matched name
      }
    }
  }
  
  return null
}

// Fallback patterns for unclear balance queries
export const FALLBACK_CLARIFICATIONS = {
  unknown_participant: (name: string, participants: string[]) =>
    `I don't recognize "${name}" in this group. Current participants are: ${participants.join(', ')}. Who did you mean?`,
  
  ambiguous_query: () =>
    `I'm not sure what balance information you're looking for. You can ask things like:
    • "How much does [name] owe me?"
    • "Show me all balances"
    • "Who needs to pay?"
    • "How should we settle up?"`,
  
  multiple_matches: (matches: string[]) =>
    `I found multiple people with similar names: ${matches.join(', ')}. Which one did you mean?`,
}

// Help command responses
export const BALANCE_HELP_RESPONSES = {
  patterns: [
    'How much does [name] owe me?',
    'What\'s my balance with [name]?',
    'Show me all balances',
    'Who owes money?',
    'Did [name] pay me back?',
    'How should we settle up?',
  ],
  
  commands: [
    '/balance-help - Show these balance query examples',
    '/show-balances - Go to traditional balance view',
    '/clear-conversation - Reset conversation context',
  ],
}