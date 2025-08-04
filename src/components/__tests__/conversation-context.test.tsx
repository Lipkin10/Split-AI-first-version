import { render, renderHook, act } from '@testing-library/react'
import { ConversationProvider, useConversation } from '../conversation-context'
import type { ConversationMessage, BalanceQueryIntent } from '@/lib/ai-conversation/types'

// Mock next-intl and next/navigation
jest.mock('next-intl', () => ({
  useLocale: () => 'en-US',
}))

jest.mock('next/navigation', () => ({
  usePathname: () => '/groups/test-group/balances',
}))

jest.mock('../../lib/utils', () => ({
  getCurrentPageFromPath: jest.fn((path: string) => path.includes('balances') ? 'balances' : 'expenses'),
}))

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
})

const TestWrapper = ({ children, groupId = 'test-group', activeUser = 'user1' }: any) => (
  <ConversationProvider groupId={groupId} activeUser={activeUser}>
    {children}
  </ConversationProvider>
)

describe('ConversationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  describe('Basic Conversation Management', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      expect(result.current.conversation.messages).toEqual([])
      expect(result.current.conversation.isLoading).toBe(false)
      expect(result.current.conversation.error).toBeNull()
      expect(result.current.isMinimized).toBe(true)
      expect(result.current.context.groupId).toBe('test-group')
      expect(result.current.context.activeUser).toBe('user1')
    })

    it('should add messages with sliding window management', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      // Add more than MAX_CONTEXT_MESSAGES (10) to test sliding window
      act(() => {
        for (let i = 0; i < 12; i++) {
          const message: ConversationMessage = {
            id: `msg-${i}`,
            type: 'user',
            content: `Message ${i}`,
            timestamp: new Date(),
          }
          result.current.addMessage(message)
        }
      })

      // Should keep only the last 10 messages
      expect(result.current.conversation.messages).toHaveLength(10)
      expect(result.current.conversation.messages[0].content).toBe('Message 2')
      expect(result.current.conversation.messages[9].content).toBe('Message 11')
    })

    it('should clear conversation and remove from storage', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      // Add a message first
      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          type: 'user',
          content: 'Test message',
          timestamp: new Date(),
        })
      })

      expect(result.current.conversation.messages).toHaveLength(1)

      act(() => {
        result.current.clearConversation()
      })

      expect(result.current.conversation.messages).toHaveLength(0)
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('spliit-conversation')
    })
  })

  describe('Balance Query Context Management', () => {
    it('should initialize balance query context', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      expect(result.current.balanceQueryContext.recentBalanceQueries).toEqual([])
      expect(result.current.balanceQueryContext.participantMentions).toEqual([])
      expect(result.current.balanceQueryContext.lastBalanceCalculation).toBeUndefined()
      expect(result.current.balanceQueryContext.queryType).toBeUndefined()
    })

    it('should add balance query and track participant mentions', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      const message: ConversationMessage = {
        id: 'balance-msg-1',
        type: 'user',
        content: 'How much does John owe me?',
        timestamp: new Date(),
      }

      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'specific_balance',
      }

      act(() => {
        result.current.addBalanceQuery(query, message)
      })

      expect(result.current.balanceQueryContext.recentBalanceQueries).toHaveLength(1)
      expect(result.current.balanceQueryContext.recentBalanceQueries[0].id).toBe('balance-msg-1')
      expect(result.current.balanceQueryContext.participantMentions).toContain('John')
      expect(result.current.balanceQueryContext.queryType).toBe('specific_balance')
      expect(result.current.balanceQueryContext.lastBalanceCalculation).toBeInstanceOf(Date)
    })

    it('should maintain sliding window for balance queries', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      // Add more than MAX_CONTEXT_MESSAGES balance queries
      act(() => {
        for (let i = 0; i < 12; i++) {
          const message: ConversationMessage = {
            id: `balance-msg-${i}`,
            type: 'user',
            content: `Balance query ${i}`,
            timestamp: new Date(),
          }
          const query: BalanceQueryIntent = {
            targetUser: `User${i}`,
            queryType: 'specific_balance',
          }
          result.current.addBalanceQuery(query, message)
        }
      })

      // Should keep only the last 10 balance queries
      expect(result.current.balanceQueryContext.recentBalanceQueries).toHaveLength(10)
      expect(result.current.balanceQueryContext.recentBalanceQueries[0].id).toBe('balance-msg-2')
      expect(result.current.balanceQueryContext.recentBalanceQueries[9].id).toBe('balance-msg-11')
    })

    it('should update participant mentions without duplicates', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      act(() => {
        result.current.updateParticipantMentions(['Alice', 'Bob'])
        result.current.updateParticipantMentions(['Alice', 'Charlie']) // Alice is duplicate
      })

      expect(result.current.balanceQueryContext.participantMentions).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('should clear balance query context and remove from storage', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      // Add some balance query data first
      act(() => {
        const message: ConversationMessage = {
          id: 'balance-msg',
          type: 'user',
          content: 'Test balance query',
          timestamp: new Date(),
        }
        const query: BalanceQueryIntent = {
          targetUser: 'John',
          queryType: 'specific_balance',
        }
        result.current.addBalanceQuery(query, message)
      })

      expect(result.current.balanceQueryContext.recentBalanceQueries).toHaveLength(1)

      act(() => {
        result.current.clearBalanceQueryContext()
      })

      expect(result.current.balanceQueryContext.recentBalanceQueries).toHaveLength(0)
      expect(result.current.balanceQueryContext.participantMentions).toHaveLength(0)
      expect(result.current.balanceQueryContext.lastBalanceCalculation).toBeUndefined()
      expect(result.current.balanceQueryContext.queryType).toBeUndefined()
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('spliit-balance-query-context')
    })
  })

  describe('getRelevantMessages', () => {
    it('should return recent messages when no balance queries exist', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      // Add some general messages
      act(() => {
        for (let i = 0; i < 8; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            type: 'user',
            content: `Message ${i}`,
            timestamp: new Date(),
          })
        }
      })

      const relevantMessages = result.current.getRelevantMessages()
      
      // Should return the MIN_CONTEXT_MESSAGES (5) most recent
      expect(relevantMessages).toHaveLength(5)
      expect(relevantMessages[0].content).toBe('Message 3')
      expect(relevantMessages[4].content).toBe('Message 7')
    })

    it('should prioritize balance queries in relevant messages', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      // Add general messages
      const generalMessages: ConversationMessage[] = []
      for (let i = 0; i < 5; i++) {
        const msg = {
          id: `general-${i}`,
          type: 'user' as const,
          content: `General message ${i}`,
          timestamp: new Date(),
        }
        generalMessages.push(msg)
        result.current.addMessage(msg)
      }

      // Add balance query messages
      const balanceMessages: ConversationMessage[] = []
      for (let i = 0; i < 3; i++) {
        const msg = {
          id: `balance-${i}`,
          type: 'user' as const,
          content: `Balance query ${i}`,
          timestamp: new Date(),
        }
        balanceMessages.push(msg)
        result.current.addMessage(msg)
        
        const query: BalanceQueryIntent = {
          targetUser: `User${i}`,
          queryType: 'specific_balance',
        }
        result.current.addBalanceQuery(query, msg)
      }

      const relevantMessages = result.current.getRelevantMessages()
      
      // Should prioritize balance messages
      expect(relevantMessages).toHaveLength(5)
      const balanceMessageIds = relevantMessages.filter(m => m.id.startsWith('balance-')).map(m => m.id)
      expect(balanceMessageIds).toEqual(['balance-0', 'balance-1', 'balance-2'])
    })
  })

  describe('Session Storage Persistence', () => {
    it('should save conversation to sessionStorage', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          type: 'user',
          content: 'Test message',
          timestamp: new Date(),
        })
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'spliit-conversation',
        expect.stringContaining('Test message')
      )
    })

    it('should save balance query context to sessionStorage', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      act(() => {
        const message: ConversationMessage = {
          id: 'balance-msg',
          type: 'user',
          content: 'Balance query',
          timestamp: new Date(),
        }
        const query: BalanceQueryIntent = {
          targetUser: 'John',
          queryType: 'specific_balance',
        }
        result.current.addBalanceQuery(query, message)
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'spliit-balance-query-context',
        expect.stringContaining('John')
      )
    })

    it('should load conversation from sessionStorage on initialization', () => {
      const savedData = {
        messages: [
          {
            id: 'saved-msg',
            type: 'user',
            content: 'Saved message',
            timestamp: new Date().toISOString(),
          }
        ],
        sessionId: 'saved-session',
      }

      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'spliit-conversation') {
          return JSON.stringify(savedData)
        }
        return null
      })

      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      expect(result.current.conversation.messages).toHaveLength(1)
      expect(result.current.conversation.messages[0].content).toBe('Saved message')
      expect(result.current.conversation.sessionId).toBe('saved-session')
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted sessionStorage data gracefully', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-json')
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      expect(result.current.conversation.messages).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse saved conversation:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should set and clear error states', () => {
      const { result } = renderHook(() => useConversation(), {
        wrapper: TestWrapper,
      })

      act(() => {
        result.current.setError('Test error')
      })

      expect(result.current.conversation.error).toBe('Test error')
      expect(result.current.conversation.isLoading).toBe(false)

      act(() => {
        result.current.setError(null)
      })

      expect(result.current.conversation.error).toBeNull()
    })
  })
})