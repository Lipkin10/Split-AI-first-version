'use client'

import { useConversation } from './conversation-context'
import { ConversationalInterface } from './conversational-interface'

interface ConversationalInterfaceWrapperProps {
  className?: string
}

export function ConversationalInterfaceWrapper({
  className,
}: ConversationalInterfaceWrapperProps) {
  const {
    conversation,
    context,
    isMinimized,
    addMessage,
    clearConversation,
    setLoading,
    setError,
    toggleMinimized,
  } = useConversation()

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || conversation.isLoading) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message,
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setLoading(true)

    try {
      // TODO: Replace with actual AI conversation service call
      // This will integrate with the tRPC AI endpoints from Story 1.2
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const aiResponse = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: `I understand you said: "${message}". This is a placeholder response that will be replaced with actual AI processing from Story 1.2.`,
        timestamp: new Date(),
        actions: [
          {
            type: 'create_expense' as const,
            label: 'Create this expense',
            data: { amount: 50, title: 'Extracted from message' },
          },
        ],
      }

      addMessage(aiResponse)
      setLoading(false)
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        type: 'error' as const,
        content:
          'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      }

      addMessage(errorMessage)
      setError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return (
    <ConversationalInterface
      className={className}
      groupId={context.groupId}
      currentPage={context.currentPage}
      messages={conversation.messages}
      isLoading={conversation.isLoading}
      error={conversation.error}
      isMinimized={isMinimized}
      onSendMessage={handleSendMessage}
      onClearConversation={clearConversation}
      onToggleMinimize={toggleMinimized}
    />
  )
}
