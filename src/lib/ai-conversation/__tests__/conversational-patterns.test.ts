import { ConversationalPatternHandler, HELP_COMMANDS } from '../conversational-patterns'

describe('ConversationalPatternHandler', () => {
  const mockParticipants = ['John', 'Alice', 'Bob', 'Sarah']
  const mockGroupId = 'test-group-123'
  let handler: ConversationalPatternHandler

  beforeEach(() => {
    handler = new ConversationalPatternHandler(mockParticipants, mockGroupId, 'en-US')
  })

  describe('Help Command Processing', () => {
    it('should handle balance help command', () => {
      const result = handler.processMessage('/balance-help')

      expect(result.actionType).toBe('help')
      expect(result.response.message.content).toContain('balance queries I can help you with')
      expect(result.response.message.content).toContain('John, Alice, Bob, Sarah')
      expect(result.response.suggestions).toBeDefined()
      expect(result.response.suggestions!.length).toBeGreaterThan(0)
    })

    it('should handle show balances command', () => {
      const result = handler.processMessage('/show-balances')

      expect(result.actionType).toBe('navigation')
      expect(result.response.message.content).toContain('traditional balance view')
      expect(result.response.actions).toHaveLength(1)
      expect(result.response.actions![0].type).toBe('navigate')
      expect(result.response.actions![0].url).toBe('/groups/test-group-123/balances')
    })

    it('should handle clear conversation command', () => {
      const result = handler.processMessage('/clear-conversation')

      expect(result.actionType).toBe('help')
      expect(result.response.message.type).toBe('system')
      expect(result.response.message.content).toContain('Conversation cleared')
      expect(result.response.actions).toHaveLength(1)
      expect(result.response.actions![0].data?.action).toBe('clear_conversation')
    })

    it('should handle case insensitive help commands', () => {
      const result = handler.processMessage('/BALANCE-HELP')

      expect(result.actionType).toBe('help')
      expect(result.response.message.content).toContain('balance queries')
    })

    it('should provide general help for unknown help commands', () => {
      const result = handler.processMessage('/unknown-help')

      expect(result.actionType).toBe('help')
      expect(result.response.message.content).toContain('balance queries and expense management')
      expect(result.response.suggestions).toBeDefined()
    })
  })

  describe('Balance Query Processing', () => {
    it('should handle specific balance queries with high confidence', () => {
      const result = handler.processMessage('How much does John owe me?')

      expect(result.actionType).toBe('balance_query')
      expect(result.requiresData).toBe(true)
      expect(result.response.message.content).toContain('balance between you and John')
      expect(result.response.message.metadata?.balanceQuery).toBeDefined()
      expect(result.response.message.metadata?.balanceQuery.targetUser).toBe('John')
      expect(result.response.message.metadata?.balanceQuery.queryType).toBe('specific_balance')
    })

    it('should handle general balance queries', () => {
      const result = handler.processMessage('Show me all balances')

      expect(result.actionType).toBe('balance_query')
      expect(result.requiresData).toBe(true)
      expect(result.response.message.content).toContain('all the current balances')
      expect(result.response.message.metadata?.balanceQuery.queryType).toBe('general_balance')
    })

    it('should handle settlement suggestion queries', () => {
      const result = handler.processMessage('How should we settle up?')

      expect(result.actionType).toBe('balance_query')
      expect(result.response.message.content).toContain('optimal reimbursement suggestions')
      expect(result.response.message.metadata?.balanceQuery.queryType).toBe('settlement_suggestions')
    })

    it('should handle reimbursement status queries', () => {
      const result = handler.processMessage('Did Alice pay me back?')

      expect(result.actionType).toBe('balance_query')
      expect(result.response.message.content).toContain('reimbursement status with Alice')
      expect(result.response.message.metadata?.balanceQuery.targetUser).toBe('Alice')
      expect(result.response.message.metadata?.balanceQuery.queryType).toBe('reimbursement_status')
    })

    it('should handle historical balance queries', () => {
      const result = handler.processMessage('What was the balance last week?')

      expect(result.actionType).toBe('balance_query')
      expect(result.response.message.content).toContain('Historical balance data is coming soon')
      expect(result.response.message.metadata?.balanceQuery.queryType).toBe('historical_balance')
      expect(result.response.message.metadata?.balanceQuery.timeRange).toBeDefined()
    })

    it('should provide appropriate suggestions based on query type', () => {
      const specificResult = handler.processMessage('How much does John owe me?')
      expect(specificResult.response.suggestions).toContain('Show me all balances')
      expect(specificResult.response.suggestions).toContain('How should we settle up?')
      expect(specificResult.response.suggestions!.some(s => s.includes('Alice'))).toBe(true)

      const generalResult = handler.processMessage('Show me all balances')
      expect(generalResult.response.suggestions).toContain('How should we settle up?')
      expect(generalResult.response.suggestions!.some(s => s.includes('John'))).toBe(true)
    })
  })

  describe('Unknown Participant Handling', () => {
    it('should handle unknown participant names with clarification', () => {
      const result = handler.processMessage('How much does Unknown owe me?')

      expect(result.actionType).toBe('clarification')
      expect(result.response.message.content).toContain('Unknown')
      expect(result.response.message.content).toContain('Current participants are: John, Alice, Bob, Sarah')
      expect(result.response.actions).toHaveLength(4) // One for each participant
      expect(result.response.actions![0].type).toBe('retry')
      expect(result.response.actions![0].data?.targetUser).toBe('John')
    })

    it('should provide participant buttons for unknown names', () => {
      const result = handler.processMessage('How much does XYZ owe me?')

      expect(result.actionType).toBe('clarification')
      expect(result.response.actions).toHaveLength(4)
      mockParticipants.forEach((participant, index) => {
        expect(result.response.actions![index].label).toBe(participant)
        expect(result.response.actions![index].data?.suggestedQuery).toContain(participant)
      })
    })
  })

  describe('Unclear Query Handling', () => {
    it('should handle completely unclear queries', () => {
      const result = handler.processMessage('I bought coffee yesterday')

      expect(result.actionType).toBe('clarification')
      expect(result.response.message.content).toContain('not sure what balance information')
      expect(result.response.suggestions).toBeDefined()
      expect(result.response.suggestions).toContain('Show me all balances')
      expect(result.response.suggestions).toContain('Who owes money?')
      expect(result.response.actions).toHaveLength(1)
      expect(result.response.actions![0].type).toBe('navigate')
    })

    it('should provide helpful suggestions for unclear queries', () => {
      const result = handler.processMessage('hello there')

      expect(result.response.suggestions).toContain('Show me all balances')
      expect(result.response.suggestions).toContain('How should we settle up?')
      expect(result.response.suggestions).toContain(`How much does ${mockParticipants[0]} owe me?`)
    })
  })

  describe('Context Updates', () => {
    it('should update participants list', () => {
      const newParticipants = ['Emma', 'David']
      handler.updateParticipants(newParticipants)

      const result = handler.processMessage('/balance-help')
      expect(result.response.message.content).toContain('Emma, David')
    })

    it('should update group context', () => {
      const newGroupId = 'new-group-456'
      handler.updateGroupContext(newGroupId, 'fr-FR')

      const result = handler.processMessage('/show-balances')
      expect(result.response.actions![0].url).toBe('/groups/new-group-456/balances')
    })
  })

  describe('Static Utility Methods', () => {
    it('should detect balance intent in messages', () => {
      expect(ConversationalPatternHandler.containsBalanceIntent('How much does John owe me?')).toBe(true)
      expect(ConversationalPatternHandler.containsBalanceIntent('Show me the balance')).toBe(true)
      expect(ConversationalPatternHandler.containsBalanceIntent('Who needs to pay?')).toBe(true)
      expect(ConversationalPatternHandler.containsBalanceIntent('I bought coffee yesterday')).toBe(false)
      expect(ConversationalPatternHandler.containsBalanceIntent('Hello there')).toBe(false)
    })

    it('should extract mentioned participants from messages', () => {
      const mentioned = ConversationalPatternHandler.extractMentionedParticipants(
        'John owes me money and Alice paid for dinner',
        mockParticipants
      )

      expect(mentioned).toContain('John')
      expect(mentioned).toContain('Alice')
      expect(mentioned).not.toContain('Bob')
      expect(mentioned).not.toContain('Sarah')
    })

    it('should handle case insensitive participant extraction', () => {
      const mentioned = ConversationalPatternHandler.extractMentionedParticipants(
        'john and ALICE were there',
        mockParticipants
      )

      expect(mentioned).toContain('John')
      expect(mentioned).toContain('Alice')
    })

    it('should return empty array when no participants mentioned', () => {
      const mentioned = ConversationalPatternHandler.extractMentionedParticipants(
        'I went to the store',
        mockParticipants
      )

      expect(mentioned).toEqual([])
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty participant list', () => {
      const emptyHandler = new ConversationalPatternHandler([], mockGroupId)
      const result = emptyHandler.processMessage('How much does John owe me?')

      expect(result.actionType).toBe('clarification')
      expect(result.response.actions).toHaveLength(0)
    })

    it('should handle empty messages', () => {
      const result = handler.processMessage('')

      expect(result.actionType).toBe('clarification')
      expect(result.response.message.content).toContain('not sure what balance information')
    })

    it('should handle whitespace-only messages', () => {
      const result = handler.processMessage('   \n\t   ')

      expect(result.actionType).toBe('clarification')
    })

    it('should limit suggestions to reasonable number', () => {
      const result = handler.processMessage('How much does John owe me?')

      expect(result.response.suggestions!.length).toBeLessThanOrEqual(4)
    })
  })
})