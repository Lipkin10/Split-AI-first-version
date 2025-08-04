/**
 * UX-Focused Tests for Conversational Balance Response
 * 
 * This test suite validates the specific user experience requirements:
 * 1. Accuracy in balance display
 * 2. Educational guidance for users 
 * 3. Conversational flow and context
 * 4. Loading states and responsiveness
 * 5. Fallback mechanisms
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationalBalanceResponse } from '../conversational-balance-response'
import { BalanceQueryIntent } from '../../lib/ai-conversation/types'
import { Balances } from '../../lib/balances'
import { Participant } from '../../lib/api'

// Mock child components to focus on UX behavior
jest.mock('../../app/groups/[groupId]/balances-list', () => ({
  BalancesList: ({ balances, participants, currency }: any) => (
    <div data-testid="balances-list">
      {participants.map((p: any) => (
        <div key={p.id} data-testid={`balance-${p.name}`}>
          {p.name}: {currency}{(balances[p.id]?.total || 0) / 100}
        </div>
      ))}
    </div>
  ),
}))

jest.mock('../../app/groups/[groupId]/reimbursement-list', () => ({
  ReimbursementList: ({ reimbursements }: any) => (
    <div data-testid="reimbursement-list">
      {reimbursements.length} suggested reimbursements
    </div>
  ),
}))

describe('Conversational Balance Response - UX Validation', () => {
  const mockParticipants: Participant[] = [
    { id: 'user1', name: 'John' },
    { id: 'user2', name: 'Alice' },
    { id: 'user3', name: 'Bob' },
  ]

  const mockBalances: Balances = {
    user1: { paid: 5000, paidFor: 3000, total: 2000 },  // John owes $20.00
    user2: { paid: 3000, paidFor: 4000, total: -1000 }, // You owe Alice $10.00
    user3: { paid: 2000, paidFor: 3000, total: -1000 }, // You owe Bob $10.00
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
  })

  describe('UX Requirement: Accuracy in Balance Display', () => {
    it('should display correct balance amounts for positive balance (they owe you)', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'specific_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // John owes you money (positive balance)
      expect(screen.getByText(/John/)).toBeInTheDocument()
      
      // Check for detailed balance breakdown
      expect(screen.getByText(/USD50.00/)).toBeInTheDocument() // Amount paid
      expect(screen.getByText(/USD30.00/)).toBeInTheDocument() // Amount owed for
      
      // Should show this is money owed to you
      expect(screen.getByText(/specificOwesYou/)).toBeInTheDocument()
    })

    it('should display correct balance amounts for negative balance (you owe them)', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'Alice', 
        queryType: 'specific_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Alice is owed money (negative balance from your perspective)
      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/USD30.00/)).toBeInTheDocument() // Amount paid by Alice
      expect(screen.getByText(/USD40.00/)).toBeInTheDocument() // Amount Alice paid for
    })

    it('should handle zero balance accurately', () => {
      const settledBalances = { 
        ...mockBalances,
        user1: { paid: 3000, paidFor: 3000, total: 0 } // Exactly settled
      }
      
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'reimbursement_status',
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps}
          balances={settledBalances}
        />
      )

      // Should show settled status for zero balance
      expect(screen.getByText(/allSettledWith/)).toBeInTheDocument()
    })
  })

  describe('UX Requirement: Educational User Guidance', () => {
    it('should educate user when participant not found', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'UnknownPerson',
        queryType: 'specific_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should show educational error message
      expect(screen.getByText(/participantNotFound/)).toBeInTheDocument()
      
      // Should list available participants for guidance
      expect(screen.getByText(/John, Alice, Bob/)).toBeInTheDocument()
    })

    it('should provide participant selection when none specified', async () => {
      const user = userEvent.setup()
      const onFollowUpQuestion = jest.fn()
      
      const query: BalanceQueryIntent = {
        queryType: 'specific_balance', // No targetUser
      }

      render(
        <ConversationalBalanceResponse 
          query={query} 
          {...defaultProps}
          onFollowUpQuestion={onFollowUpQuestion}
        />
      )

      // Should ask for clarification
      expect(screen.getByText(/needSpecificPerson/)).toBeInTheDocument()
      
      // Should provide clickable participant options
      const johnButton = screen.getByRole('button', { name: /John/ })
      expect(johnButton).toBeInTheDocument()
      
      // Clicking should trigger educational follow-up
      await user.click(johnButton)
      expect(onFollowUpQuestion).toHaveBeenCalledWith('How much does John owe me?')
    })

    it('should educate about historical balance limitations', () => {
      const query: BalanceQueryIntent = {
        queryType: 'historical_balance',
        timeRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-07'),
        },
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should provide educational context about limitation
      expect(screen.getByText(/historicalNote/)).toBeInTheDocument()
      expect(screen.getByText(/historicalExplanation/)).toBeInTheDocument()
      
      // Should offer current balances as alternative
      expect(screen.getByText(/currentBalances/)).toBeInTheDocument()
    })
  })

  describe('UX Requirement: Conversational Flow & Context', () => {
    it('should maintain conversation through follow-up actions', async () => {
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

      // Should provide natural conversation continuity buttons
      const viewAllButton = screen.getByRole('button', { name: /viewAllBalances/ })
      expect(viewAllButton).toBeInTheDocument()
      
      await user.click(viewAllButton)
      expect(onFollowUpQuestion).toHaveBeenCalledWith('Conversation.Balance.showAllBalances')
    })

    it('should enable mixed conversation topics (balance + settlement)', async () => {
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

      // Should enable natural transitions to settlement topics
      const settleButton = screen.getByRole('button', { name: /howToSettle/ })
      expect(settleButton).toBeInTheDocument()
      
      await user.click(settleButton)
      expect(onFollowUpQuestion).toHaveBeenCalledWith('Conversation.Balance.howToSettle')
    })

    it('should provide comprehensive overview with actionable insights', () => {
      const query: BalanceQueryIntent = {
        queryType: 'general_balance',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should show complete balance information
      expect(screen.getByText(/allBalances/)).toBeInTheDocument()
      expect(screen.getByTestId('balances-list')).toBeInTheDocument()
      
      // Should provide contextual insights
      // Total participants: 3
      expect(screen.getByText(/3/)).toBeInTheDocument()
      
      // Should enable follow-up conversations with each participant
      const johnButton = screen.getByRole('button', { name: /John/ })
      const aliceButton = screen.getByRole('button', { name: /Alice/ })
      expect(johnButton).toBeInTheDocument()
      expect(aliceButton).toBeInTheDocument()
    })
  })

  describe('UX Requirement: Settlement & Fallback Flow', () => {
    it('should provide settlement suggestions with educational context', () => {
      const query: BalanceQueryIntent = {
        queryType: 'settlement_suggestions',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Should show educational optimization context
      expect(screen.getByText(/optimizationTip/)).toBeInTheDocument()
      expect(screen.getByText(/optimizationExplanation/)).toBeInTheDocument()
    })

    it('should handle fallback to traditional view when AI fails', async () => {
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

      // Should provide fallback option (per UX requirement #5)
      const traditionalButton = screen.getByRole('button', { name: /traditionalView/ })
      expect(traditionalButton).toBeInTheDocument()
      
      // Should trigger fallback when clicked
      await user.click(traditionalButton)
      expect(onShowTraditionalView).toHaveBeenCalled()
    })
  })

  describe('UX Requirement: Reimbursement Status Accuracy', () => {
    it('should accurately show when someone still owes you money', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'John',
        queryType: 'reimbursement_status',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // John has positive balance (owes you money)
      expect(screen.getByText(/stillOwesYou/)).toBeInTheDocument()
    })

    it('should accurately show when you still owe someone money', () => {
      const query: BalanceQueryIntent = {
        targetUser: 'Alice',
        queryType: 'reimbursement_status',
      }

      render(<ConversationalBalanceResponse query={query} {...defaultProps} />)

      // Alice has negative balance (you owe her money)
      expect(screen.getByText(/youStillOwe/)).toBeInTheDocument()
    })
  })
})

describe('Loading States & Responsiveness', () => {
  it('should render user-friendly loading skeleton', () => {
    const { ConversationalBalanceResponseSkeleton } = require('../conversational-balance-response')
    
    render(<ConversationalBalanceResponseSkeleton />)

    // Should show pleasant loading animation (per UX requirement: "thinking")
    const loadingElement = screen.getByRole('generic')
    expect(loadingElement).toHaveClass('animate-pulse')
    expect(loadingElement).toBeInTheDocument()
  })
})