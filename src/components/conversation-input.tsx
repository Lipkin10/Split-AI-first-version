'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { forwardRef, KeyboardEvent } from 'react'

interface ConversationInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => Promise<void>
  isLoading: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  maxLength?: number
}

export const ConversationInput = forwardRef<
  HTMLInputElement,
  ConversationInputProps
>(
  (
    {
      value,
      onChange,
      onSend,
      isLoading,
      placeholder,
      disabled = false,
      className,
      maxLength = 500,
    },
    ref,
  ) => {
    const t = useTranslations('conversation.input')

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    const handleSend = async () => {
      if (!value.trim() || isLoading || disabled) return

      try {
        await onSend(value.trim())
      } catch (error) {
        console.error('Failed to send message:', error)
      }
    }

    const canSend = value.trim().length > 0 && !isLoading && !disabled

    return (
      <div className={cn('flex items-end gap-2', className)}>
        {/* Main input */}
        <div className="flex-1 relative">
          <Input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('placeholder')}
            disabled={disabled || isLoading}
            maxLength={maxLength}
            className="pr-12 resize-none"
            autoComplete="off"
          />

          {/* Character counter */}
          {value.length > maxLength * 0.8 && (
            <span
              className={cn(
                'absolute -top-5 right-0 text-xs',
                value.length >= maxLength
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {value.length}/{maxLength}
            </span>
          )}
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="sm"
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    )
  },
)

ConversationInput.displayName = 'ConversationInput'
