import {
  matchBalanceQueryPattern,
  calculateParticipantMatchConfidence,
  BALANCE_HELP_RESPONSES,
  FALLBACK_CLARIFICATIONS,
} from '../balance-query-patterns'

describe('Balance Query Pattern Matching', () => {
  const mockParticipants = ['John', 'Alice', 'Bob', 'Sarah']

  describe('matchBalanceQueryPattern', () => {
    it('should match direct balance queries correctly', () => {
      const result = matchBalanceQueryPattern(
        'How much does John owe me?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBe('John')
      expect(result!.extractedData.queryType).toBe('specific_balance')
      expect(result!.confidence).toBeGreaterThan(0.8)
    })

    it('should match reverse balance queries', () => {
      const result = matchBalanceQueryPattern(
        'How much do I owe Alice?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBe('Alice')
      expect(result!.extractedData.queryType).toBe('specific_balance')
    })

    it('should match general balance queries', () => {
      const result = matchBalanceQueryPattern(
        'Show me all balances',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBeUndefined()
      expect(result!.extractedData.queryType).toBe('general_balance')
    })

    it('should match reimbursement status queries', () => {
      const result = matchBalanceQueryPattern(
        'Did Bob pay me back?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBe('Bob')
      expect(result!.extractedData.queryType).toBe('reimbursement_status')
    })

    it('should match settlement suggestion queries', () => {
      const result = matchBalanceQueryPattern(
        'How should we settle up?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.queryType).toBe('settlement_suggestions')
    })

    it('should handle case insensitive participant names', () => {
      const result = matchBalanceQueryPattern(
        'How much does john owe me?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBe('John')
    })

    it('should return null for non-balance queries', () => {
      const result = matchBalanceQueryPattern(
        'I bought coffee for $10',
        mockParticipants
      )

      expect(result).toBeNull()
    })

    it('should extract time ranges for historical queries', () => {
      const result = matchBalanceQueryPattern(
        'What was the balance last week?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.queryType).toBe('historical_balance')
      expect(result!.extractedData.timeRange).toBeDefined()
      expect(result!.extractedData.timeRange!.start).toBeDefined()
      expect(result!.extractedData.timeRange!.end).toBeDefined()
    })
  })

  describe('calculateParticipantMatchConfidence', () => {
    it('should return 1.0 for exact matches', () => {
      const confidence = calculateParticipantMatchConfidence('John', mockParticipants)
      expect(confidence).toBe(1.0)
    })

    it('should return 0.8 for partial matches', () => {
      const confidence = calculateParticipantMatchConfidence('Joh', mockParticipants)
      expect(confidence).toBe(0.8)
    })

    it('should return 0.3 for no matches', () => {
      const confidence = calculateParticipantMatchConfidence('Unknown', mockParticipants)
      expect(confidence).toBe(0.3)
    })

    it('should return 0.5 for undefined names', () => {
      const confidence = calculateParticipantMatchConfidence(undefined, mockParticipants)
      expect(confidence).toBe(0.5)
    })

    it('should handle case insensitive matching', () => {
      const confidence = calculateParticipantMatchConfidence('alice', mockParticipants)
      expect(confidence).toBe(1.0)
    })
  })

  describe('FALLBACK_CLARIFICATIONS', () => {
    it('should provide appropriate unknown participant clarification', () => {
      const clarification = FALLBACK_CLARIFICATIONS.unknown_participant(
        'Unknown',
        mockParticipants
      )

      expect(clarification).toContain('Unknown')
      expect(clarification).toContain('John, Alice, Bob, Sarah')
    })

    it('should provide appropriate ambiguous query clarification', () => {
      const clarification = FALLBACK_CLARIFICATIONS.ambiguous_query()

      expect(clarification).toContain('How much does')
      expect(clarification).toContain('Show me all balances')
    })

    it('should provide appropriate multiple matches clarification', () => {
      const clarification = FALLBACK_CLARIFICATIONS.multiple_matches(['John1', 'John2'])

      expect(clarification).toContain('John1, John2')
      expect(clarification).toContain('Which one did you mean')
    })
  })

  describe('BALANCE_HELP_RESPONSES', () => {
    it('should contain expected help patterns', () => {
      expect(BALANCE_HELP_RESPONSES.patterns).toContain('How much does [name] owe me?')
      expect(BALANCE_HELP_RESPONSES.patterns).toContain('Show me all balances')
      expect(BALANCE_HELP_RESPONSES.patterns).toContain('Who owes money?')
    })

    it('should contain expected help commands', () => {
      expect(BALANCE_HELP_RESPONSES.commands).toContain('/balance-help - Show these balance query examples')
      expect(BALANCE_HELP_RESPONSES.commands).toContain('/show-balances - Go to traditional balance view')
      expect(BALANCE_HELP_RESPONSES.commands).toContain('/clear-conversation - Reset conversation context')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty participant list', () => {
      const result = matchBalanceQueryPattern('How much does John owe me?', [])

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBeUndefined()
    })

    it('should handle special characters in names', () => {
      const specialParticipants = ["O'Connor", "Van-Der-Berg", "José"]
      const result = matchBalanceQueryPattern(
        "How much does José owe me?",
        specialParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.extractedData.targetUser).toBe('José')
    })

    it('should adjust confidence for unrecognized participants', () => {
      const result = matchBalanceQueryPattern(
        'How much does Unknown owe me?',
        mockParticipants
      )

      expect(result).not.toBeNull()
      expect(result!.confidence).toBeLessThan(0.5)
    })
  })
})