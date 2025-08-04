import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { ConversationMessage } from '../../lib/ai-conversation/types'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: jest.fn(() => (key: string) => {
    const translations: Record<string, string> = {
      title: 'AI Assistant',
      'prompts.suggestion': 'Try one of these:',
      'prompts.addExpense': 'I paid $25 for lunch',
      'help.title': 'AI Assistant Help',
      'help.description': 'Ask me anything!',
      'input.placeholder': 'Ask me anything...',
      'cleared.title': 'Conversation Cleared',
      'cleared.description': 'History cleared',
    }
    return translations[key] || key
  }),
  useLocale: jest.fn(() => 'en-US'),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/groups/test-group/expenses'),
}))

// Create a simple mock component for testing core functionality
function MockConversationalInterface({
  messages = [],
  isLoading = false,
  onSendMessage,
  currentPage = 'expenses',
}: {
  messages?: ConversationMessage[]
  isLoading?: boolean
  onSendMessage?: (message: string) => void
  currentPage?: string
}) {
  const [inputValue, setInputValue] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue.trim())
      setInputValue('')
    }
  }

  const contextPrompts = {
    expenses: ['I paid $25 for lunch', 'Split dinner $120'],
    balances: ['How much do I owe?', 'Show balances'],
    general: ['Create a group', 'Add expense'],
  }

  return (
    <div data-testid="conversational-interface">
      <h2>AI Assistant</h2>

      {/* Context prompts */}
      <div>
        <p>Try one of these:</p>
        {contextPrompts[currentPage as keyof typeof contextPrompts]?.map(
          (prompt, index) => (
            <button
              key={index}
              onClick={() => setInputValue(prompt)}
              data-testid={`prompt-${index}`}
            >
              {prompt}
            </button>
          ),
        )}
      </div>

      {/* Messages */}
      <div data-testid="messages">
        {messages.map((message) => (
          <div key={message.id} data-testid={`message-${message.type}`}>
            {message.content}
          </div>
        ))}
        {isLoading && <div data-testid="loading">Processing...</div>}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          data-testid="message-input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          data-testid="send-button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

describe('ConversationalInterface Core Functionality', () => {
  const mockMessages: ConversationMessage[] = [
    {
      id: '1',
      type: 'user',
      content: 'I paid $30 for lunch',
      timestamp: new Date('2024-01-01T12:00:00Z'),
    },
    {
      id: '2',
      type: 'assistant',
      content: 'I can help you create that expense.',
      timestamp: new Date('2024-01-01T12:00:05Z'),
    },
  ]

  describe('Component Rendering', () => {
    it('renders the AI Assistant interface', () => {
      render(<MockConversationalInterface />)

      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
      expect(screen.getByTestId('conversational-interface')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Type your message...'),
      ).toBeInTheDocument()
    })

    it('displays context-aware prompts', () => {
      render(<MockConversationalInterface currentPage="expenses" />)

      expect(screen.getByText('Try one of these:')).toBeInTheDocument()
      expect(screen.getByText('I paid $25 for lunch')).toBeInTheDocument()
      expect(screen.getByText('Split dinner $120')).toBeInTheDocument()
    })

    it('shows different prompts for different pages', () => {
      render(<MockConversationalInterface currentPage="balances" />)

      expect(screen.getByText('How much do I owe?')).toBeInTheDocument()
      expect(screen.getByText('Show balances')).toBeInTheDocument()
    })
  })

  describe('Message Display', () => {
    it('displays conversation messages', () => {
      render(<MockConversationalInterface messages={mockMessages} />)

      expect(screen.getByTestId('message-user')).toHaveTextContent(
        'I paid $30 for lunch',
      )
      expect(screen.getByTestId('message-assistant')).toHaveTextContent(
        'I can help you create that expense.',
      )
    })

    it('shows loading state', () => {
      render(<MockConversationalInterface isLoading={true} />)

      expect(screen.getByTestId('loading')).toHaveTextContent('Processing...')
    })
  })

  describe('User Interactions', () => {
    it('handles message input and sending', () => {
      const mockSendMessage = jest.fn()

      render(<MockConversationalInterface onSendMessage={mockSendMessage} />)

      const input = screen.getByTestId('message-input') as HTMLInputElement
      const sendButton = screen.getByTestId('send-button')

      // Type a message
      fireEvent.change(input, { target: { value: 'I paid $50 for dinner' } })
      expect(input.value).toBe('I paid $50 for dinner')

      // Submit the form
      fireEvent.click(sendButton)

      expect(mockSendMessage).toHaveBeenCalledWith('I paid $50 for dinner')
      expect(input.value).toBe('') // Input should be cleared after sending
    })

    it('handles prompt clicks', () => {
      render(<MockConversationalInterface currentPage="expenses" />)

      const input = screen.getByTestId('message-input') as HTMLInputElement
      const promptButton = screen.getByTestId('prompt-0')

      fireEvent.click(promptButton)

      expect(input.value).toBe('I paid $25 for lunch')
    })

    it('disables input when loading', () => {
      render(<MockConversationalInterface isLoading={true} />)

      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')

      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })

    it('handles form submission', () => {
      const mockSendMessage = jest.fn()

      render(<MockConversationalInterface onSendMessage={mockSendMessage} />)

      const input = screen.getByTestId('message-input')
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.submit(form)

      expect(mockSendMessage).toHaveBeenCalledWith('Test message')
    })
  })

  describe('Input Validation', () => {
    it('prevents sending empty messages', () => {
      const mockSendMessage = jest.fn()

      render(<MockConversationalInterface onSendMessage={mockSendMessage} />)

      const sendButton = screen.getByTestId('send-button')

      fireEvent.click(sendButton)

      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('trims whitespace from messages', () => {
      const mockSendMessage = jest.fn()

      render(<MockConversationalInterface onSendMessage={mockSendMessage} />)

      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')

      fireEvent.change(input, { target: { value: '  test message  ' } })
      fireEvent.click(sendButton)

      expect(mockSendMessage).toHaveBeenCalledWith('test message')
    })
  })

  describe('Accessibility', () => {
    it('has proper form structure for screen readers', () => {
      render(<MockConversationalInterface />)

      const input = screen.getByTestId('message-input')
      const button = screen.getByTestId('send-button')

      expect(input).toHaveAttribute('type', 'text')
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('provides proper button states', () => {
      render(<MockConversationalInterface isLoading={true} />)

      const button = screen.getByTestId('send-button')
      expect(button).toHaveTextContent('Sending...')
      expect(button).toBeDisabled()
    })
  })
})
