'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type {
  ConversationAction,
  ConversationMessage,
} from '@/lib/ai-conversation/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Bot, Trash2, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

interface ConversationHistoryProps {
  messages: ConversationMessage[]
  isLoading: boolean
  onClearHistory: () => void
  groupId?: string
  className?: string
}

export function ConversationHistory({
  messages,
  isLoading,
  onClearHistory,
  groupId,
  className,
}: ConversationHistoryProps) {
  const t = useTranslations('conversation')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('default', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp)
  }

  const handleActionClick = (action: ConversationAction) => {
    // TODO: Integrate with existing form navigation
    console.log('Action clicked:', action)

    switch (action.type) {
      case 'create_expense':
        // Navigate to expense creation form with pre-filled data
        break
      case 'view_balances':
        // Navigate to balances page
        break
      case 'create_group':
        // Navigate to group creation form
        break
      default:
        break
    }
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with clear button */}
      {messages.length > 0 && (
        <div className="flex justify-between items-center pb-2 border-b">
          <span className="text-sm text-muted-foreground">
            {t('history.messages', { count: messages.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Messages container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 py-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {groupId ? t('history.emptyWithGroup') : t('history.empty')}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onActionClick={handleActionClick}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground animate-pulse" />
            </div>
            <Card className="flex-1 p-3 max-w-[80%]">
              <div className="flex space-x-1">
                <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  onActionClick,
}: {
  message: ConversationMessage
  onActionClick: (action: ConversationAction) => void
}) {
  const t = useTranslations('conversation')

  const isUser = message.type === 'user'
  const isError = message.type === 'error'

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          isUser ? 'bg-primary' : isError ? 'bg-destructive' : 'bg-secondary',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : isError ? (
          <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-secondary-foreground" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col max-w-[80%]', isUser && 'items-end')}>
        <Card
          className={cn(
            'p-3',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isError
              ? 'bg-destructive/10 border-destructive/20'
              : 'bg-secondary',
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

          {/* Action buttons for AI responses */}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={isUser ? 'secondary' : 'outline'}
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => onActionClick(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </Card>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1 px-1">
          {new Intl.DateTimeFormat('default', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
