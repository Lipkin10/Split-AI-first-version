import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationalBalanceResponse } from '../conversational-balance-response'
import { BalanceQueryIntent } from '../../lib/ai-conversation/types'
import { Balances, getSuggestedReimbursements } from '../../lib/balances'
import { Participant } from '../../lib/api'

// Mock the getSuggestedReimbursements function with real logic
jest.mock('../../lib/balances', () => ({
  ...jest.requireActual('../../lib/balances'),
  getSuggestedReimbursements: jest.fn(),
}))

const mockGetSuggestedReimbursements = getSuggestedReimbursements as jest.MockedFunction<typeof getSuggestedReimbursements>

describe('ConversationalBalanceResponse - Real Component UX Tests', () => {
  const mockParticipants: Participant[] = [
    { id: 'user1', name: 'John' },
    { id: 'user2', name: 'Alice' },
    { id: 'user3', name: 'Bob' },
  ]

  const mockBalances: Balances = {
    user1: { paid: 5000, paidFor: 3000, total: 2000 },  // John owes $20.00
    user2: { paid: 3000, paidFor: 4000, total: -1000 }, // Alice is owed $10.00
    user3: { paid: 2000, paidFor: 3000, total: -1000 }, // Bob is owed $10.00
  }

  const defaultProps = {
    balances: mockBalances,
    participants: mockParticipants,
    currency: 'USD',
    groupId: 'test-group',
    onFollowUpQuestion: jest.fn(),
    onShowTraditionalView: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSuggestedReimbursements.mockReturnValue([
      { from: 'user1', to: 'user2', amount: 1500 },
    ])
  })

  describe('UX Requirement: Accuracy in Balance Display', () => {
    it('should display penny-perfect balance information for John', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'specific_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Test actual formatted currency display
      expect(screen.getByText('Conversation.Balance.balanceWith')).toBeInTheDocument()
      
      // Verify real formatCurrency is used (not mocked)
      const currencyElements = screen.getAllByText(/\$20\.00/)
      expect(currencyElements.length).toBeGreaterThan(0)
      
      // Check detailed breakdown
      expect(screen.getByText(/\$50\.00/)).toBeInTheDocument() // Amount paid
      expect(screen.getByText(/\$30\.00/)).toBeInTheDocument() // Amount owed for
    })

    it('should educate user when participant not found (UX Requirement)', async () => {
      const user = userEvent.setup()
      const query: BalanceQueryIntent = {
        targetUser: 'Unknown',
        queryType: 'specific_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should show educational error message
      expect(screen.getByText(/Conversation\.Balance\.participantNotFound/)).toBeInTheDocument()
      
      // Should list available participants for guidance
      expect(screen.getByText(/John, Alice, Bob/)).toBeInTheDocument()
      
      // Should offer participant management options (as per requirement)
      const participantButtons = screen.getAllByRole('button')
      expect(participantButtons.length).toBeGreaterThan(0)
    })

    it('should guide user to specify participant when none provided (Educational UX)', async () => {
      const user = userEvent.setup()
      const onFollowUpQuestion = jest.fn()
      const query: BalanceQueryIntent = {
        queryType: 'specific_balance',
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps} 
          onFollowUpQuestion={onFollowUpQuestion}
        />
      )

      // Should ask for clarification
      expect(screen.getByText(/Conversation\.Balance\.needSpecificPerson/)).toBeInTheDocument()
      
      // Should provide clickable participant options
      const johnButton = screen.getByRole('button', { name: /John/ })
      expect(johnButton).toBeInTheDocument()
      
      // Clicking should trigger follow-up question
      await user.click(johnButton)
      expect(onFollowUpQuestion).toHaveBeenCalledWith('How much does John owe me?')
    })
  })

  describe('UX Requirement: Conversational Context & Follow-up Actions', () => {
    it('should display comprehensive balance overview with actionable insights', () => {
      const query: BalanceQueryIntent = {
        queryType: 'general_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should show complete balance information
      expect(screen.getByText(/Conversation\.Balance\.allBalances/)).toBeInTheDocument()
      expect(screen.getByText(/Conversation\.Balance\.quickInsights/)).toBeInTheDocument()
      
      // Should provide conversation context with participant count
      expect(screen.getByText(/3/)).toBeInTheDocument() // 3 participants
      
      // Should suggest follow-up actions
      expect(screen.getByText(/Conversation\.Balance\.showReimbursements/)).toBeInTheDocument()
    })

    it('should enable conversational follow-up through participant buttons', async () => {
      const user = userEvent.setup()
      const onFollowUpQuestion = jest.fn()
      const query: BalanceQueryIntent = {
        queryType: 'general_balance',
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps} 
          onFollowUpQuestion={onFollowUpQuestion}
        />
      )

      // Should have participant buttons for natural conversation flow
      const johnButton = screen.getByRole('button', { name: /John/ })
      const aliceButton = screen.getByRole('button', { name: /Alice/ })
      
      expect(johnButton).toBeInTheDocument()
      expect(aliceButton).toBeInTheDocument()
      
      // Clicking should continue conversation naturally
      await user.click(johnButton)
      expect(onFollowUpQuestion).toHaveBeenCalledWith('How much does John owe me?')
    })
  })

  describe('UX Requirement: Settlement & Reimbursement Flow', () => {
    it('should provide actionable settlement suggestions with educational context', () => {
      const query: BalanceQueryIntent = {
        queryType: 'settlement_suggestions',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should show settlement title
      expect(screen.getByText(/Conversation\.Balance\.suggestedSettlements/)).toBeInTheDocument()
      
      // Should include educational optimization tip
      expect(screen.getByText(/Conversation\.Balance\.optimizationTip/)).toBeInTheDocument()
      expect(screen.getByText(/Conversation\.Balance\.optimizationExplanation/)).toBeInTheDocument()
      
      // Should provide fallback to traditional view
      expect(screen.getByText(/Conversation\.Balance\.traditionalView/)).toBeInTheDocument()
    })

    it('should handle fallback to traditional view when requested', async () => {
      const user = userEvent.setup()
      const onShowTraditionalView = jest.fn()
      const query: BalanceQueryIntent = {
        queryType: 'settlement_suggestions',
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps} 
          onShowTraditionalView={onShowTraditionalView}
        />
      )

      // Should provide traditional view fallback button
      const traditionalButton = screen.getByRole('button', { name: /Conversation\.Balance\.traditionalView/ })
      expect(traditionalButton).toBeInTheDocument()
      
      // Should trigger fallback when clicked (per UX requirement #5)
      await user.click(traditionalButton)
      expect(onShowTraditionalView).toHaveBeenCalled()
    })
  })

  describe('UX Requirement: Positive/Negative Balance Display Accuracy', () => {
    it('should accurately show settled status when balance is exactly zero', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'Alice',
        queryType: 'reimbursement_status',
      }

      // Test exact zero balance (accuracy requirement)
      const settledBalances = { ...mockBalances }
      settledBalances.user2 = { paid: 3000, paidFor: 3000, total: 0 }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps} 
          balances={settledBalances}
        />
      )

      // Should show positive settled message
      expect(screen.getByText(/Conversation\.Balance\.allSettledWith/)).toBeInTheDocument()
    })

    it('should accurately display negative balance (you owe them)', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'Alice',
        queryType: 'reimbursement_status',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Alice has total: -1000 (you owe her $10.00)
      expect(screen.getByText(/Conversation\.Balance\.youStillOwe/)).toBeInTheDocument()
      
      // Should show accurate amount
      expect(screen.getByText(/\$10\.00/)).toBeInTheDocument()
    })

    it('should show positive balance (they owe you) accurately', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'reimbursement_status',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // John has total: 2000 (he owes you $20.00)
      expect(screen.getByText(/Conversation\.Balance\.stillOwesYou/)).toBeInTheDocument()
      
      // Should show accurate positive amount
      expect(screen.getByText(/\$20\.00/)).toBeInTheDocument()
    })
  })

  describe('UX Requirement: Educational Guidance for Unsupported Features', () => {
    it('should educate user about historical balance limitations', () => {
      const query: BalanceQueryIntent = {
        queryType: 'historical_balance',
        timeRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-07'),
        },
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should provide educational context about feature limitation
      expect(screen.getByText(/Conversation\.Balance\.historicalNote/)).toBeInTheDocument()
      expect(screen.getByText(/Conversation\.Balance\.historicalExplanation/)).toBeInTheDocument()
      
      // Should fallback to current balances as alternative
      expect(screen.getByText(/Conversation\.Balance\.currentBalances/)).toBeInTheDocument()
    })
  })

  describe('UX Requirement: Conversation Context Window (30min sessions)', () => {
    it('should maintain conversational flow through follow-up questions', async () => {
      const user = userEvent.setup()
      const onFollowUpQuestion = jest.fn()
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'specific_balance',
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps} 
          onFollowUpQuestion={onFollowUpQuestion}
        />
      )

      // Should provide natural conversation continuity
      const viewAllButton = screen.getByRole('button', { name: /Conversation\.Balance\.viewAllBalances/ })
      await user.click(viewAllButton)

      expect(onFollowUpQuestion).toHaveBeenCalledWith('Conversation.Balance.showAllBalances')
    })

    it('should enable cross-subject conversation mixing (balance + expense queries)', async () => {
      const user = userEvent.setup()
      const onFollowUpQuestion = jest.fn()
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'specific_balance',
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps} 
          onFollowUpQuestion={onFollowUpQuestion}
        />
      )

      // Should enable natural transitions to related expense topics
      const settleButton = screen.getByRole('button', { name: /Conversation\.Balance\.howToSettle/ })
      await user.click(settleButton)

      expect(onFollowUpQuestion).toHaveBeenCalledWith('Conversation.Balance.howToSettle')
    })
  })

  describe('UX Requirement: Loading States ("Thinking/Confabulating")', () => {
    it('should provide user-friendly loading skeleton while processing', () => {
      const { ConversationalBalanceResponseSkeleton } = require('../conversational-balance-response')
      
      render(<ConversationalBalanceResponseSkeleton />)

      // Should show pleasant loading animation (not just spinner)
      const loadingElement = screen.getByRole('generic')
      expect(loadingElement).toHaveClass('animate-pulse')
      
      // Should have structured loading layout matching real component
      expect(loadingElement).toBeInTheDocument()
    })
  })
})