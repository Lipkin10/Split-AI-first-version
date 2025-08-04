import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationalGroupResponse } from '../conversational-group-response'
import { GroupManagementIntent } from '../../lib/ai-conversation/types'
import { AppRouterOutput } from '../../trpc/routers/_app'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: any) => {
    // Simple mock that returns the key with parameters
    if (params) {
      return `${key}(${JSON.stringify(params)})`
    }
    return key
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock tRPC
jest.mock('../../trpc/client', () => ({
  trpc: {
    groups: {
      create: {
        useMutation: () => ({
          mutateAsync: jest.fn().mockResolvedValue({ groupId: 'new-group-id' }),
        }),
      },
      update: {
        useMutation: () => ({
          mutateAsync: jest.fn().mockResolvedValue({}),
        }),
      },
    },
  },
}))

// Mock toast
jest.mock('../ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

// Mock GroupForm component
jest.mock('../group-form', () => ({
  GroupForm: ({ onSubmit }: any) => (
    <div data-testid="group-form">
      <button
        onClick={() => onSubmit({
          name: 'Test Group',
          information: 'Test info',
          currency: 'USD',
          participants: [{ name: 'John' }, { name: 'Jane' }],
        })}
      >
        Submit Group Form
      </button>
    </div>
  ),
}))

describe('ConversationalGroupResponse', () => {
  const mockGroups: AppRouterOutput['groups']['list']['groups'] = [
    {
      id: 'group-1',
      name: 'Vacation Group',
      participantCount: 3,
      currency: 'USD',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'group-2', 
      name: 'Dinner Group',
      participantCount: 2,
      currency: 'EUR',
      createdAt: new Date().toISOString(),
    },
  ]

  const mockCurrentGroup = {
    id: 'current-group',
    name: 'Current Group',
    currency: 'USD',
    information: 'Test group',
    createdAt: new Date().toISOString(),
    participants: [
      { id: 'user1', name: 'John', groupId: 'current-group' },
      { id: 'user2', name: 'Jane', groupId: 'current-group' },
    ],
  }

  const defaultProps = {
    message: 'Create a new group for our trip',
    groups: mockGroups,
    currentGroup: mockCurrentGroup,
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Group Creation', () => {
    it('should render group creation form for create_group intent', () => {
      const intent: GroupManagementIntent = {
        action: 'create_group',
        groupName: 'Vegas Trip',
        confidence: 0.9,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/actions\.createGroup/)).toBeInTheDocument()
      expect(screen.getByTestId('group-form')).toBeInTheDocument()
      expect(screen.getByText('90% confidence')).toBeInTheDocument()
    })

    it('should handle group creation submission', async () => {
      const intent: GroupManagementIntent = {
        action: 'create_group',
        groupName: 'Vegas Trip',
        confidence: 0.9,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      const submitButton = screen.getByText('Submit Group Form')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled()
      })
    })
  })

  describe('Group Listing', () => {
    it('should render group list for list_groups intent', () => {
      const intent: GroupManagementIntent = {
        action: 'list_groups',
        confidence: 0.95,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/actions\.listGroups/)).toBeInTheDocument()
      expect(screen.getByText('Vacation Group')).toBeInTheDocument()
      expect(screen.getByText('Dinner Group')).toBeInTheDocument()
      expect(screen.getByText('3 participants')).toBeInTheDocument()
      expect(screen.getByText('2 participants')).toBeInTheDocument()
    })

    it('should show no groups message when groups array is empty', () => {
      const intent: GroupManagementIntent = {
        action: 'list_groups',
        confidence: 0.95,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
          groups={[]}
        />
      )

      expect(screen.getByText(/noGroups/)).toBeInTheDocument()
    })
  })

  describe('Participant Management', () => {
    it('should render add participant confirmation', () => {
      const intent: GroupManagementIntent = {
        action: 'add_participant',
        participants: ['Alice', 'Bob'],
        confidence: 0.85,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/actions\.addParticipant/)).toBeInTheDocument()
      expect(screen.getByText(/Alice, Bob/)).toBeInTheDocument()
      expect(screen.getByText(/continue/)).toBeInTheDocument()
    })

    it('should render remove participant confirmation', () => {
      const intent: GroupManagementIntent = {
        action: 'remove_participant',
        participants: ['John'],
        confidence: 0.80,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/actions\.removeParticipant/)).toBeInTheDocument()
      expect(screen.getByText(/John/)).toBeInTheDocument() 
      expect(screen.getByText(/continue/)).toBeInTheDocument()
    })
  })

  describe('Group Switching', () => {
    it('should render group switch confirmation', () => {
      const intent: GroupManagementIntent = {
        action: 'switch_group',
        groupName: 'Vacation Group',
        confidence: 0.8,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/actions\.switchGroup/)).toBeInTheDocument()
      expect(screen.getByText(/Vacation Group/)).toBeInTheDocument()
      expect(screen.getByText(/continue/)).toBeInTheDocument()
    })
  })

  describe('Group Updates', () => {
    it('should render group update confirmation for currency change', () => {
      const intent: GroupManagementIntent = {
        action: 'update_group',
        currency: 'EUR',
        confidence: 0.8,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/actions\.updateGroup/)).toBeInTheDocument()
      expect(screen.getByText(/EUR/)).toBeInTheDocument()
      expect(screen.getByText(/continue/)).toBeInTheDocument()
    })
  })

  describe('User Interaction', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const intent: GroupManagementIntent = {
        action: 'list_groups',
        confidence: 0.95,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      // Find the button with the X icon (cancel button)
      const buttons = screen.getAllByRole('button')
      const cancelButton = buttons.find(button => button.textContent === '')
      expect(cancelButton).toBeTruthy()
      fireEvent.click(cancelButton!)

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('should show extracted information', () => {
      const intent: GroupManagementIntent = {
        action: 'create_group',
        groupName: 'Vegas Trip',
        participants: ['Alice', 'Bob'],
        currency: 'USD',
        confidence: 0.9,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText(/extracted\.message/)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display confidence level as badge', () => {
      const intent: GroupManagementIntent = {
        action: 'create_group',
        groupName: 'Test Group',
        confidence: 0.75,
      }

      render(
        <ConversationalGroupResponse
          {...defaultProps}
          intent={intent}
        />
      )

      expect(screen.getByText('75% confidence')).toBeInTheDocument()
    })
  })
})