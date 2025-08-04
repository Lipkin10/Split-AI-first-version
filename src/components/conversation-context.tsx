'use client'

import type {
  ConversationContext,
  ConversationMessage,
  ConversationState,
  BalanceQueryIntent,
} from '@/lib/ai-conversation/types'
import { getCurrentPageFromPath } from '@/lib/utils'
import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

// Constants for conversation context management
const MAX_CONTEXT_MESSAGES = 10
const MIN_CONTEXT_MESSAGES = 5
const BALANCE_QUERY_STORAGE_KEY = 'spliit-balance-query-context'

// Balance query context interface
interface BalanceQueryContext {
  recentBalanceQueries: ConversationMessage[]
  participantMentions: string[]
  lastBalanceCalculation?: Date
  queryType?: BalanceQueryIntent['queryType']
}

interface ConversationContextType {
  // State
  conversation: ConversationState
  context: ConversationContext
  balanceQueryContext: BalanceQueryContext
  isMinimized: boolean

  // Actions
  addMessage: (message: ConversationMessage) => void
  clearConversation: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  toggleMinimized: () => void
  updateContext: (updates: Partial<ConversationContext>) => void
  
  // Balance query specific actions
  addBalanceQuery: (query: BalanceQueryIntent, message: ConversationMessage) => void
  clearBalanceQueryContext: () => void
  updateParticipantMentions: (mentions: string[]) => void
  getRelevantMessages: () => ConversationMessage[]
}

const ConversationContextValue = createContext<
  ConversationContextType | undefined
>(undefined)

interface ConversationProviderProps {
  children: React.ReactNode
  groupId?: string
  activeUser?: string
}

export function ConversationProvider({
  children,
  groupId,
  activeUser,
}: ConversationProviderProps) {
  const pathname = usePathname()
  const locale = useLocale()

  // Initialize conversation state
  const [conversation, setConversation] = useState<ConversationState>({
    messages: [],
    isLoading: false,
    error: null,
    sessionId: `session-${Date.now()}`,
  })

  // Initialize conversation context
  const [context, setContext] = useState<ConversationContext>({
    groupId,
    currentPage: getCurrentPageFromPath(pathname),
    activeUser,
    locale,
  })

  // Initialize balance query context
  const [balanceQueryContext, setBalanceQueryContext] = useState<BalanceQueryContext>({
    recentBalanceQueries: [],
    participantMentions: [],
    lastBalanceCalculation: undefined,
    queryType: undefined,
  })

  const [isMinimized, setIsMinimized] = useState(true)

  // Update context when route or props change
  useEffect(() => {
    setContext((prev) => ({
      ...prev,
      groupId,
      currentPage: getCurrentPageFromPath(pathname),
      activeUser,
      locale,
    }))
  }, [pathname, groupId, activeUser, locale])

  // Load conversation from sessionStorage on mount
  useEffect(() => {
    const savedConversation = sessionStorage.getItem('spliit-conversation')
    if (savedConversation) {
      try {
        const parsed = JSON.parse(savedConversation) as {
          messages?: ConversationMessage[]
          sessionId?: string
        }
        setConversation((prev) => ({
          ...prev,
          messages: parsed.messages || [],
          sessionId: parsed.sessionId || prev.sessionId,
        }))
      } catch (error) {
        console.warn('Failed to parse saved conversation:', error)
      }
    }

    // Load balance query context from sessionStorage
    const savedBalanceContext = sessionStorage.getItem(BALANCE_QUERY_STORAGE_KEY)
    if (savedBalanceContext) {
      try {
        const parsed = JSON.parse(savedBalanceContext) as Partial<BalanceQueryContext>
        setBalanceQueryContext((prev) => ({
          ...prev,
          recentBalanceQueries: parsed.recentBalanceQueries || [],
          participantMentions: parsed.participantMentions || [],
          lastBalanceCalculation: parsed.lastBalanceCalculation ? new Date(parsed.lastBalanceCalculation) : undefined,
          queryType: parsed.queryType,
        }))
      } catch (error) {
        console.warn('Failed to parse saved balance query context:', error)
      }
    }
  }, [])

  // Save conversation to sessionStorage when it changes
  useEffect(() => {
    if (conversation.messages.length > 0) {
      sessionStorage.setItem(
        'spliit-conversation',
        JSON.stringify({
          messages: conversation.messages,
          sessionId: conversation.sessionId,
        }),
      )
    }
  }, [conversation.messages, conversation.sessionId])

  // Save balance query context to sessionStorage when it changes
  useEffect(() => {
    if (balanceQueryContext.recentBalanceQueries.length > 0 || balanceQueryContext.participantMentions.length > 0) {
      sessionStorage.setItem(
        BALANCE_QUERY_STORAGE_KEY,
        JSON.stringify({
          ...balanceQueryContext,
          lastBalanceCalculation: balanceQueryContext.lastBalanceCalculation?.toISOString(),
        }),
      )
    }
  }, [balanceQueryContext])

  const addMessage = useCallback((message: ConversationMessage) => {
    setConversation((prev) => {
      // Implement sliding window for messages (keep only last MAX_CONTEXT_MESSAGES)
      const updatedMessages = [...prev.messages, message]
      const trimmedMessages = updatedMessages.length > MAX_CONTEXT_MESSAGES
        ? updatedMessages.slice(-MAX_CONTEXT_MESSAGES)
        : updatedMessages

      return {
        ...prev,
        messages: trimmedMessages,
        error: null,
      }
    })
  }, [])

  const clearConversation = useCallback(() => {
    setConversation((prev) => ({
      ...prev,
      messages: [],
      error: null,
      isLoading: false,
    }))
    sessionStorage.removeItem('spliit-conversation')
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setConversation((prev) => ({
      ...prev,
      isLoading: loading,
    }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setConversation((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }))
  }, [])

  const toggleMinimized = useCallback(() => {
    setIsMinimized((prev) => !prev)
  }, [])

  const updateContext = useCallback((updates: Partial<ConversationContext>) => {
    setContext((prev) => ({ ...prev, ...updates }))
  }, [])

  // Balance query specific methods
  const addBalanceQuery = useCallback((query: BalanceQueryIntent, message: ConversationMessage) => {
    setBalanceQueryContext((prev) => {
      const updatedQueries = [...prev.recentBalanceQueries, message]
      const trimmedQueries = updatedQueries.length > MAX_CONTEXT_MESSAGES
        ? updatedQueries.slice(-MAX_CONTEXT_MESSAGES)
        : updatedQueries

      // Update participant mentions if target user is specified
      const updatedMentions = query.targetUser && !prev.participantMentions.includes(query.targetUser)
        ? [...prev.participantMentions, query.targetUser]
        : prev.participantMentions

      return {
        ...prev,
        recentBalanceQueries: trimmedQueries,
        participantMentions: updatedMentions.slice(-10), // Keep last 10 mentioned participants
        lastBalanceCalculation: new Date(),
        queryType: query.queryType,
      }
    })
  }, [])

  const clearBalanceQueryContext = useCallback(() => {
    setBalanceQueryContext({
      recentBalanceQueries: [],
      participantMentions: [],
      lastBalanceCalculation: undefined,
      queryType: undefined,
    })
    sessionStorage.removeItem(BALANCE_QUERY_STORAGE_KEY)
  }, [])

  const updateParticipantMentions = useCallback((mentions: string[]) => {
    setBalanceQueryContext((prev) => {
      const combinedMentions = [...prev.participantMentions, ...mentions]
      const uniqueMentions = Array.from(new Set(combinedMentions))
      return {
        ...prev,
        participantMentions: uniqueMentions.slice(-10),
      }
    })
  }, [])

  const getRelevantMessages = useCallback((): ConversationMessage[] => {
    // Return messages from the sliding window that are relevant to the current context
    const allMessages = conversation.messages
    
    // If we have balance queries, prioritize recent balance-related messages
    if (balanceQueryContext.recentBalanceQueries.length > 0) {
      const balanceMessageIds = new Set(balanceQueryContext.recentBalanceQueries.map(m => m.id))
      const balanceMessages = allMessages.filter(m => balanceMessageIds.has(m.id))
      const otherMessages = allMessages.filter(m => !balanceMessageIds.has(m.id))
      
      // Return up to MIN_CONTEXT_MESSAGES, prioritizing balance messages
      const relevantMessages = [...balanceMessages, ...otherMessages].slice(-MIN_CONTEXT_MESSAGES)
      return relevantMessages
    }
    
    // Return the most recent messages within the context window
    return allMessages.slice(-MIN_CONTEXT_MESSAGES)
  }, [conversation.messages, balanceQueryContext.recentBalanceQueries])

  const value: ConversationContextType = {
    conversation,
    context,
    balanceQueryContext,
    isMinimized,
    addMessage,
    clearConversation,
    setLoading,
    setError,
    toggleMinimized,
    updateContext,
    addBalanceQuery,
    clearBalanceQueryContext,
    updateParticipantMentions,
    getRelevantMessages,
  }

  return (
    <ConversationContextValue.Provider value={value}>
      {children}
    </ConversationContextValue.Provider>
  )
}

export function useConversation() {
  const context = useContext(ConversationContextValue)
  if (context === undefined) {
    throw new Error(
      'useConversation must be used within a ConversationProvider',
    )
  }
  return context
}
