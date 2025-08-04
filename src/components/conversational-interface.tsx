'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { useToast } from '@/components/ui/use-toast'
import type { ConversationMessage, BalanceQueryIntent, GroupManagementIntent } from '@/lib/ai-conversation/types'
import { ConversationalPatternHandler } from '@/lib/ai-conversation/conversational-patterns'
import { getBalances, getSuggestedReimbursements } from '@/lib/balances'
import { RuntimeFeatureFlags } from '@/lib/featureFlags'
import { cn } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { HelpCircle, MessageCircle, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { ConversationHistory } from './conversation-history'
import { ConversationInput } from './conversation-input'
import { ConversationalExpenseForm } from './conversational-expense-form'
import { ConversationalBalanceResponse } from './conversational-balance-response'
import { ConversationalGroupResponse } from './conversational-group-response'

interface ConversationalInterfaceProps {
  className?: string
  groupId?: string
  currentPage?: string
  messages: ConversationMessage[]
  isLoading: boolean
  error: string | null
  isMinimized?: boolean
  group?: NonNullable<AppRouterOutput['groups']['get']['group']>
  groups?: AppRouterOutput['groups']['list']['groups']
  categories?: AppRouterOutput['categories']['list']['categories']
  runtimeFeatureFlags?: RuntimeFeatureFlags
  language?: string
  onSendMessage: (message: string) => Promise<void>
  onClearConversation: () => void
  onToggleMinimize: () => void
  onExpenseCreated?: (expenseId: string) => void
}

export function ConversationalInterface({
  className,
  groupId,
  currentPage = 'general',
  messages,
  isLoading,
  error,
  isMinimized = true,
  group,
  groups = [],
  categories,
  runtimeFeatureFlags,
  language = 'en-US',
  onSendMessage,
  onClearConversation,
  onToggleMinimize,
  onExpenseCreated,
}: ConversationalInterfaceProps) {
  const t = useTranslations('conversational')
  const { toast } = useToast()

  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(!isMinimized)
  const [expenseCreationMode, setExpenseCreationMode] = useState<{
    active: boolean
    message: string
  }>({ active: false, message: '' })
  const [balanceQueryMode, setBalanceQueryMode] = useState<{
    active: boolean
    query: BalanceQueryIntent | null
    message: string
  }>({ active: false, query: null, message: '' })
  const [groupManagementMode, setGroupManagementMode] = useState<{
    active: boolean
    intent: GroupManagementIntent | null
    message: string
  }>({ active: false, intent: null, message: '' })
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync isExpanded with isMinimized prop
  useEffect(() => {
    setIsExpanded(!isMinimized)
  }, [isMinimized])

  // Parse conversation intent to detect expense creation
  const parseMessageIntent = trpc.ai.conversation.parseIntent.useMutation()

  // Get group expenses for balance calculations
  const { data: expenses } = trpc.groups.expenses.list.useQuery(
    { groupId: groupId! },
    { enabled: !!groupId }
  )

  // Initialize conversational pattern handler
  const patternHandler = useMemo(() => {
    if (!group?.participants) return null
    
    const participantNames = group.participants.map(p => p.name)
    return new ConversationalPatternHandler(participantNames, groupId || '', language)
  }, [group?.participants, groupId, language])

  // Calculate balances when expenses change
  const balances = useMemo(() => {
    if (!expenses?.expenses || !group?.participants) return {}
    return getBalances(expenses.expenses)
  }, [expenses, group?.participants])

  // Handle expense creation workflow
  const handleExpenseCreation = useCallback(
    (message: string) => {
      if (!groupId || !group || !categories || !runtimeFeatureFlags) {
        toast({
          title: t('errors.title'),
          description: 'Missing required data for expense creation',
          variant: 'destructive',
        })
        return
      }

      setExpenseCreationMode({
        active: true,
        message: message.trim(),
      })
      setIsExpanded(true)
    },
    [groupId, group, categories, runtimeFeatureFlags, toast, t],
  )

  const handleExpenseCreated = useCallback(
    (expenseId: string) => {
      setExpenseCreationMode({ active: false, message: '' })
      toast({
        title: t('success.expenseCreated'),
        description: t('success.expenseCreatedDescription'),
      })
      onExpenseCreated?.(expenseId)
    },
    [toast, t, onExpenseCreated],
  )

  const handleCancelExpenseCreation = useCallback(() => {
    setExpenseCreationMode({ active: false, message: '' })
  }, [])

  // Handle balance query workflow
  const handleBalanceQuery = useCallback(
    (query: BalanceQueryIntent, message: string) => {
      if (!groupId || !group) {
        toast({
          title: t('errors.title'),
          description: 'Missing required data for balance query',
          variant: 'destructive',
        })
        return
      }

      setBalanceQueryMode({
        active: true,
        query,
        message: message.trim(),
      })
      setIsExpanded(true)
    },
    [groupId, group, toast, t],
  )

  const handleBalanceQueryComplete = useCallback(() => {
    setBalanceQueryMode({ active: false, query: null, message: '' })
  }, [])

  // Handle group management workflow
  const handleGroupManagement = useCallback(
    (intent: GroupManagementIntent, message: string) => {
      setGroupManagementMode({
        active: true,
        intent,
        message: message.trim(),
      })
      setIsExpanded(true)
    },
    [],
  )

  const handleGroupManagementComplete = useCallback(() => {
    setGroupManagementMode({ active: false, intent: null, message: '' })
    toast({
      title: t('success.groupManagementComplete'),
      description: t('success.groupManagementCompleteDescription'),
    })
  }, [toast, t])

  const handleCancelGroupManagement = useCallback(() => {
    setGroupManagementMode({ active: false, intent: null, message: '' })
  }, [])

  // Forward declaration for handleSendMessage
  const handleSendMessageRef = useRef<(message: string) => Promise<void>>()

  const handleFollowUpQuestion = useCallback(
    async (question: string) => {
      setInputValue(question)
      // Auto-send the follow-up question
      setTimeout(() => {
        if (handleSendMessageRef.current) {
          handleSendMessageRef.current(question)
        }
      }, 100)
    },
    [],
  )

  const handleShowTraditionalView = useCallback(() => {
    if (groupId) {
      window.location.href = `/groups/${groupId}/balances`
    }
  }, [groupId])

  // Get context-aware prompts based on current page
  const getContextPrompts = () => {
    const prompts = {
      general: [
        t('prompts.createGroup'),
        t('prompts.addExpense'),
        t('prompts.checkBalance'),
      ],
      expenses: [
        t('prompts.addExpenseDetailed'),
        t('prompts.splitBill'),
        t('prompts.addReceipt'),
        'I paid $50 for dinner with John and Jane',
        'Split coffee $12 between everyone',
        'Uber ride cost $25 today',
      ],
      balances: [
        t('prompts.whoOwesWhat'),
        t('prompts.settleUp'),
        t('prompts.viewDebts'),
        ...(group?.participants ? [
          `How much does ${group.participants[0]?.name || '[name]'} owe me?`,
          'Show me all balances',
          'How should we settle up?',
        ] : []),
      ],
      group: [
        t('prompts.addParticipant'),
        t('prompts.groupSummary'),
        t('prompts.exportData'),
        'Add John to the group',
        'Switch to vacation group',
        'Show me all my groups',
        'Create a new group for our trip',
      ],
    }

    return prompts[currentPage as keyof typeof prompts] || prompts.general
  }

  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return

    try {
      // First check if this is a balance query using pattern matching
      if (patternHandler && groupId && group) {
        try {
          const patternResult = patternHandler.processMessage(message.trim())
          
          // Handle help commands and high-confidence balance queries immediately
          if (patternResult.actionType === 'balance_query' && patternResult.requiresData) {
            const balanceQuery = patternResult.response.message.metadata?.balanceQuery as BalanceQueryIntent
            if (balanceQuery) {
              handleBalanceQuery(balanceQuery, message)
              setInputValue('')
              return
            }
          }

          // Handle navigation commands
          if (patternResult.actionType === 'navigation') {
            const action = patternResult.response.actions?.[0]
            if (action?.url) {
              window.location.href = action.url
              setInputValue('')
              return
            }
          }

          // Handle help and clarification responses
          if (patternResult.actionType === 'help' || patternResult.actionType === 'clarification') {
            // Add the assistant's response to the conversation
            await onSendMessage(message)
            setInputValue('')
            return
          }
        } catch (error) {
          console.warn('Pattern matching failed, falling back to AI service:', error)
          // Continue to AI service as fallback
        }
      }

      // Check if this is an expense creation request
      if (
        groupId &&
        group &&
        categories &&
        runtimeFeatureFlags?.enableConversationalExpense
      ) {
        const intentResult = await parseMessageIntent.mutateAsync({
          message: message.trim(),
          groupId,
          language,
        })

        // If high confidence expense creation, show conversational expense form
        if (
          intentResult.intent === 'expense_creation' &&
          intentResult.confidence > 0.6
        ) {
          handleExpenseCreation(message)
          setInputValue('')
          return
        }

        // If this is a balance query intent, handle it
        if (
          intentResult.intent === 'balance_query' &&
          intentResult.confidence > 0.6
        ) {
          const balanceQuery = intentResult.extractedData as BalanceQueryIntent
          handleBalanceQuery(balanceQuery, message)
          setInputValue('')
          return
        }

        // If this is a group management intent, handle it
        if (
          intentResult.intent === 'group_management' &&
          intentResult.confidence > 0.6
        ) {
          const groupIntent = intentResult.extractedData as GroupManagementIntent
          handleGroupManagement(groupIntent, message)
          setInputValue('')
          return
        }
      }

      // Otherwise, use regular conversation flow
      await onSendMessage(message)
      setInputValue('')
    } catch (error) {
      console.error('Error handling message:', error)
      toast({
        title: t('errors.title'),
        description: t('errors.processingFailed'),
        variant: 'destructive',
      })
    }
  }, [patternHandler, groupId, group, parseMessageIntent, categories, runtimeFeatureFlags, language, toast, t, onSendMessage, handleBalanceQuery, handleExpenseCreation, handleGroupManagement, isLoading])

  // Set the ref for handleSendMessage
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage
  }, [handleSendMessage])

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded)
    onToggleMinimize()

    // Focus input when expanding
    if (!isExpanded) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handleClearConversation = () => {
    onClearConversation()
    toast({
      title: t('cleared.title'),
      description: t('cleared.description'),
    })
  }

  const contextPrompts = getContextPrompts()

  return (
    <Card
      className={cn(
        'fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] transition-all duration-300 ease-in-out shadow-lg',
        isExpanded ? 'h-[600px]' : 'h-auto',
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('title')}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="sm">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80" side="left">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">{t('help.title')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('help.description')}
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">{t('help.examples')}</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• &quot;{t('prompts.addExpense')}&quot;</li>
                      <li>• &quot;{t('prompts.checkBalance')}&quot;</li>
                      <li>• &quot;{t('prompts.splitBill')}&quot;</li>
                    </ul>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <Button variant="ghost" size="sm" onClick={handleToggleExpanded}>
              {isExpanded ? (
                <X className="h-4 w-4" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-0">
          <CardContent className="space-y-4 pb-2">
            {expenseCreationMode.active &&
            group &&
            categories &&
            runtimeFeatureFlags ? (
              /* Expense Creation Mode */
              <div className="h-80 overflow-y-auto">
                <ConversationalExpenseForm
                  message={expenseCreationMode.message}
                  groupId={groupId!}
                  group={group}
                  categories={categories}
                  language={language}
                  onExpenseCreated={handleExpenseCreated}
                  onCancel={handleCancelExpenseCreation}
                  runtimeFeatureFlags={runtimeFeatureFlags}
                />
              </div>
            ) : balanceQueryMode.active &&
              balanceQueryMode.query &&
              group &&
              expenses ? (
              /* Balance Query Mode */
              <div className="h-80 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Balance Query Results</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBalanceQueryComplete}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {(() => {
                    try {
                      return (
                        <ConversationalBalanceResponse
                          query={balanceQueryMode.query}
                          balances={balances}
                          participants={group.participants}
                          currency={group.currency}
                          groupId={groupId!}
                          onFollowUpQuestion={handleFollowUpQuestion}
                          onShowTraditionalView={handleShowTraditionalView}
                        />
                      )
                    } catch (error) {
                      console.error('Balance response component failed:', error)
                      return (
                        <div className="space-y-4 p-4 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                          <h3 className="font-medium text-red-900 dark:text-red-100">
                            Balance Query Error
                          </h3>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            There was an error processing your balance query. Please try using the traditional balance view.
                          </p>
                          <Button onClick={handleShowTraditionalView} variant="outline">
                            View Traditional Balances
                          </Button>
                        </div>
                      )
                    }
                  })()}
                </div>
              </div>
            ) : groupManagementMode.active &&
              groupManagementMode.intent ? (
              /* Group Management Mode */
              <div className="h-80 overflow-y-auto">
                <ConversationalGroupResponse
                  intent={groupManagementMode.intent}
                  message={groupManagementMode.message}
                  groups={groups}
                  currentGroup={group}
                  onComplete={handleGroupManagementComplete}
                  onCancel={handleCancelGroupManagement}
                />
              </div>
            ) : (
              <>
                {/* Context-aware prompts */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('prompts.suggestion')}
                    {runtimeFeatureFlags?.enableConversationalExpense &&
                      currentPage === 'expenses' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI Powered
                        </Badge>
                      )}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {contextPrompts.map((prompt, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80 text-xs"
                        onClick={() => setInputValue(prompt)}
                      >
                        {prompt}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Conversation History */}
                <div className="h-80 overflow-hidden">
                  <ConversationHistory
                    messages={messages}
                    isLoading={isLoading}
                    onClearHistory={handleClearConversation}
                    groupId={groupId}
                  />
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Input always visible */}
      <CardContent className="pt-0">
        <ConversationInput
          ref={inputRef}
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          isLoading={isLoading || parseMessageIntent.isPending}
          placeholder={
            expenseCreationMode.active
              ? t('input.expenseCreationPlaceholder', {
                  defaultValue: 'Creating expense...',
                })
              : balanceQueryMode.active
              ? 'Ask a follow-up question or close to continue...'
              : groupManagementMode.active
              ? 'Managing group...'
              : t('input.placeholder', { context: currentPage })
          }
          disabled={expenseCreationMode.active || groupManagementMode.active}
        />
      </CardContent>
    </Card>
  )
}
