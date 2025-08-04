'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GroupForm } from '@/components/group-form'
import { useToast } from '@/components/ui/use-toast'
import type { GroupManagementIntent } from '@/lib/ai-conversation/types'
import { GroupFormValues } from '@/lib/schemas'
import { trpc } from '@/trpc/client'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { Check, X, Users, Plus, Minus, Settings, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface ConversationalGroupResponseProps {
  intent: GroupManagementIntent
  message: string
  groups?: AppRouterOutput['groups']['list']['groups']
  currentGroup?: NonNullable<AppRouterOutput['groups']['get']['group']>
  onComplete: () => void
  onCancel: () => void
}

export function ConversationalGroupResponse({
  intent,
  message,
  groups = [],
  currentGroup,
  onComplete,
  onCancel,
}: ConversationalGroupResponseProps) {
  const t = useTranslations('conversational.group')
  const { toast } = useToast()
  const router = useRouter()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // Mutations for group operations
  const createGroupMutation = trpc.groups.create.useMutation()
  const updateGroupMutation = trpc.groups.update.useMutation()

  // Get action icon based on intent
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create_group':
        return <Plus className="h-4 w-4" />
      case 'add_participant':
        return <Users className="h-4 w-4" />
      case 'remove_participant':
        return <Minus className="h-4 w-4" />
      case 'update_group':
        return <Settings className="h-4 w-4" />
      case 'switch_group':
        return <ArrowRight className="h-4 w-4" />
      case 'list_groups':
        return <Users className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  // Get action label based on intent
  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create_group':
        return t('actions.createGroup', { defaultValue: 'Create Group' })
      case 'add_participant':
        return t('actions.addParticipant', { defaultValue: 'Add Participant' })
      case 'remove_participant':
        return t('actions.removeParticipant', { defaultValue: 'Remove Participant' })
      case 'update_group':
        return t('actions.updateGroup', { defaultValue: 'Update Group' })
      case 'switch_group':
        return t('actions.switchGroup', { defaultValue: 'Switch Group' })
      case 'list_groups':
        return t('actions.listGroups', { defaultValue: 'List Groups' })
      default:
        return t('actions.unknown', { defaultValue: 'Group Action' })
    }
  }

  // Generate confirmation message based on intent
  const getConfirmationMessage = useMemo(() => {
    switch (intent.action) {
      case 'create_group':
        return t('confirmation.createGroup', {
          name: intent.groupName,
          participants: intent.participants?.join(', ') || '',
          defaultValue: `Create group "${intent.groupName}"${intent.participants ? ` with ${intent.participants.join(', ')}` : ''}?`
        })
      case 'add_participant':
        return t('confirmation.addParticipant', {
          participants: intent.participants?.join(', ') || '',
          group: intent.groupName || currentGroup?.name || 'current group',
          defaultValue: `Add ${intent.participants?.join(', ')} to ${intent.groupName || currentGroup?.name || 'the current group'}?`
        })
      case 'remove_participant':
        return t('confirmation.removeParticipant', {
          participants: intent.participants?.join(', ') || '',
          group: intent.groupName || currentGroup?.name || 'current group',
          defaultValue: `Remove ${intent.participants?.join(', ')} from ${intent.groupName || currentGroup?.name || 'the current group'}?`
        })
      case 'update_group':
        return t('confirmation.updateGroup', {
          changes: intent.currency ? `currency to ${intent.currency}` : 'group settings',
          defaultValue: `Update ${intent.currency ? `currency to ${intent.currency}` : 'group settings'}?`
        })
      case 'switch_group':
        const targetGroup = groups.find(g => 
          g.name.toLowerCase().includes(intent.groupName?.toLowerCase() || '')
        )
        return t('confirmation.switchGroup', {
          group: targetGroup?.name || intent.groupName,
          defaultValue: `Switch to group "${targetGroup?.name || intent.groupName}"?`
        })
      default:
        return t('confirmation.default', { defaultValue: 'Proceed with this group operation?' })
    }
  }, [intent, groups, currentGroup?.name, t])

  // Handle group creation
  const handleCreateGroup = useCallback(async (values: GroupFormValues) => {
    if (!intent.groupName) return

    setIsProcessing(true)
    try {
      const result = await createGroupMutation.mutateAsync({
        groupFormValues: {
          name: intent.groupName || '',
          information: values.information || '',
          currency: intent.currency || values.currency,
          participants: values.participants,
        }
      })

      if (result.groupId) {
        toast({
          title: t('success.groupCreated', { defaultValue: 'Group Created' }),
          description: t('success.groupCreatedDescription', {
            name: intent.groupName,
            defaultValue: `Successfully created group "${intent.groupName}"`
          }),
        })
        
        // Navigate to the new group
        router.push(`/groups/${result.groupId}`)
        onComplete()
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      toast({
        title: t('errors.createFailed', { defaultValue: 'Failed to Create Group' }),
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [intent, createGroupMutation, toast, router, onComplete, t])

  // Handle participant management
  const handleParticipantOperation = useCallback(async () => {
    if (!currentGroup || !intent.participants?.length) return

    setIsProcessing(true)
    try {
      // Convert current participants to form format
      let updatedParticipants: { id?: string; name: string }[] = currentGroup.participants.map(p => ({
        id: p.id,
        name: p.name,
      }))

      if (intent.action === 'add_participant') {
        // Add new participants  
        const newParticipants = intent.participants.map(name => ({ 
          name,
          // For new participants, id is optional and will be set by the server
        }))
        updatedParticipants.push(...newParticipants)
      } else if (intent.action === 'remove_participant') {
        // Remove participants by name
        updatedParticipants = updatedParticipants.filter(p => 
          !intent.participants!.some(name => 
            name.toLowerCase() === p.name.toLowerCase()
          )
        )
      }

      await updateGroupMutation.mutateAsync({
        groupId: currentGroup.id,
        groupFormValues: {
          name: currentGroup.name,
          information: currentGroup.information || '',
          currency: currentGroup.currency,
          participants: updatedParticipants,
        }
      })

      toast({
        title: t('success.participantsUpdated', { defaultValue: 'Participants Updated' }),
        description: intent.action === 'add_participant' 
          ? t('success.participantsAdded', {
              participants: intent.participants.join(', '),
              defaultValue: `Added ${intent.participants.join(', ')} to the group`
            })
          : t('success.participantsRemoved', {
              participants: intent.participants.join(', '),
              defaultValue: `Removed ${intent.participants.join(', ')} from the group`
            }),
      })

      onComplete()
    } catch (error) {
      console.error('Failed to update participants:', error)
      toast({
        title: t('errors.updateFailed', { defaultValue: 'Failed to Update Group' }),
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [currentGroup, intent, updateGroupMutation, toast, onComplete, t])

  // Handle group switching
  const handleSwitchGroup = useCallback(async () => {
    const targetGroup = groups.find(g => 
      g.name.toLowerCase().includes(intent.groupName?.toLowerCase() || '')
    )

    if (!targetGroup) {
      toast({
        title: t('errors.groupNotFound', { defaultValue: 'Group Not Found' }),
        description: t('errors.groupNotFoundDescription', {
          name: intent.groupName,
          available: groups.map(g => g.name).join(', '),
          defaultValue: `Could not find group "${intent.groupName}". Available groups: ${groups.map(g => g.name).join(', ')}`
        }),
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    try {
      // Navigate to the target group
      router.push(`/groups/${targetGroup.id}`)
      
      toast({
        title: t('success.groupSwitched', { defaultValue: 'Group Switched' }),
        description: t('success.groupSwitchedDescription', {
          name: targetGroup.name,
          defaultValue: `Switched to group "${targetGroup.name}"`
        }),
      })

      onComplete()
    } catch (error) {
      console.error('Failed to switch group:', error)
      toast({
        title: t('errors.switchFailed', { defaultValue: 'Failed to Switch Group' }),
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [intent, groups, router, toast, onComplete, t])

  // Handle group updates
  const handleUpdateGroup = useCallback(async () => {
    if (!currentGroup) return

    setIsProcessing(true)
    try {
      await updateGroupMutation.mutateAsync({
        groupId: currentGroup.id,
        groupFormValues: {
          name: currentGroup.name,
          information: currentGroup.information || '',
          currency: intent.currency || currentGroup.currency,
          participants: currentGroup.participants.map(p => ({
            id: p.id,
            name: p.name,
          })),
        }
      })

      toast({
        title: t('success.groupUpdated', { defaultValue: 'Group Updated' }),
        description: intent.currency 
          ? t('success.currencyUpdated', {
              currency: intent.currency,
              defaultValue: `Currency updated to ${intent.currency}`
            })
          : t('success.settingsUpdated', { defaultValue: 'Group settings updated' }),
      })

      onComplete()
    } catch (error) {
      console.error('Failed to update group:', error)
      toast({
        title: t('errors.updateFailed', { defaultValue: 'Failed to Update Group' }),
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [currentGroup, intent, updateGroupMutation, toast, onComplete, t])

  // Handle primary action
  const handlePrimaryAction = useCallback(async () => {
    if (showConfirmation) {
      switch (intent.action) {
        case 'add_participant':
        case 'remove_participant':
          await handleParticipantOperation()
          break
        case 'update_group':
          await handleUpdateGroup()
          break
        case 'switch_group':
          await handleSwitchGroup()
          break
        default:
          break
      }
    } else {
      setShowConfirmation(true)
    }
  }, [showConfirmation, intent.action, handleParticipantOperation, handleUpdateGroup, handleSwitchGroup])

  // Render group creation form
  if (intent.action === 'create_group') {
    const defaultValues: GroupFormValues = {
      name: intent.groupName || '',
      information: '',
      currency: intent.currency || process.env.NEXT_PUBLIC_DEFAULT_CURRENCY_SYMBOL || 'USD',
      participants: intent.participants?.map(name => ({ name })) || [
        { name: '' },
        { name: '' },
      ],
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getActionIcon(intent.action)}
            <h3 className="font-medium">{getActionLabel(intent.action)}</h3>
            <Badge variant="outline" className="text-xs">
              {Math.round(intent.confidence * 100)}% confidence
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-sm">
            {t('extracted.message', { message, defaultValue: `From: "${message}"` })}
          </AlertDescription>
        </Alert>

        <GroupForm
          onSubmit={handleCreateGroup}
          group={undefined}
        />
      </div>
    )
  }

  // Render group list
  if (intent.action === 'list_groups') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getActionIcon(intent.action)}
            <h3 className="font-medium">{getActionLabel(intent.action)}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {groups.length === 0 ? (
            <Alert>
              <AlertDescription>
                {t('noGroups', { defaultValue: 'You don\'t have any groups yet. Create one by saying "Create a new group for [event name]".' })}
              </AlertDescription>
            </Alert>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                <div>
                  <h4 className="font-medium">{group.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {group.participantCount} {group.participantCount === 1 ? 'participant' : 'participants'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onComplete}>
            {t('done', { defaultValue: 'Done' })}
          </Button>
        </div>
      </div>
    )
  }

  // Render confirmation for other actions
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getActionIcon(intent.action)}
          <h3 className="font-medium">{getActionLabel(intent.action)}</h3>
          <Badge variant="outline" className="text-xs">
            {Math.round(intent.confidence * 100)}% confidence
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          {t('extracted.message', { message, defaultValue: `From: "${message}"` })}
        </AlertDescription>
      </Alert>

      {!showConfirmation ? (
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">
              {t('extracted.title', { defaultValue: 'Extracted Information' })}
            </h4>
            <div className="space-y-1 text-sm">
              {intent.groupName && (
                <div>
                  <span className="font-medium">{t('extracted.group', { defaultValue: 'Group:' })}</span> {intent.groupName}
                </div>
              )}
              {intent.participants?.length && (
                <div>
                  <span className="font-medium">{t('extracted.participants', { defaultValue: 'Participants:' })}</span> {intent.participants.join(', ')}
                </div>
              )}
              {intent.currency && (
                <div>
                  <span className="font-medium">{t('extracted.currency', { defaultValue: 'Currency:' })}</span> {intent.currency}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onCancel}>
              {t('cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button onClick={handlePrimaryAction} disabled={isProcessing}>
              {t('continue', { defaultValue: 'Continue' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>{getConfirmationMessage}</AlertDescription>
          </Alert>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              {t('back', { defaultValue: 'Back' })}
            </Button>
            <Button onClick={handlePrimaryAction} disabled={isProcessing}>
              <Check className="h-4 w-4 mr-2" />
              {isProcessing ? t('processing', { defaultValue: 'Processing...' }) : t('confirm', { defaultValue: 'Confirm' })}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}