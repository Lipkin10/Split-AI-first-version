'use client'

import { BalancesList } from '@/app/groups/[groupId]/balances-list'
import { ReimbursementList } from '@/app/groups/[groupId]/reimbursement-list'
import { Button } from '@/components/ui/button'
import { Participant } from '@/lib/api'
import { Balances, Reimbursement, getSuggestedReimbursements } from '@/lib/balances'
import { BalanceQueryIntent } from '@/lib/ai-conversation/types'
import { formatCurrency } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'

interface ConversationalBalanceResponseProps {
  query: BalanceQueryIntent
  balances: Balances
  participants: Participant[]
  currency: string
  groupId: string
  onFollowUpQuestion?: (question: string) => void
  onShowTraditionalView?: () => void
}

export function ConversationalBalanceResponse({
  query,
  balances,
  participants,
  currency,
  groupId,
  onFollowUpQuestion,
  onShowTraditionalView,
}: ConversationalBalanceResponseProps) {
  const locale = useLocale()
  const t = useTranslations('Conversation.Balance')

  // Calculate reimbursements for settlement suggestions
  const reimbursements = useMemo(() => {
    return getSuggestedReimbursements(balances)
  }, [balances])

  // Helper function to get participant by name
  const getParticipantByName = (name: string) => {
    return participants.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    )
  }

  // Helper function to format individual balance
  const formatBalance = (amount: number, participantName: string, targetName?: string) => {
    if (amount > 0) {
      return targetName 
        ? t('specificOwesYou', { name: participantName, amount: formatCurrency(currency, amount, locale) })
        : t('owesYou', { name: participantName, amount: formatCurrency(currency, amount, locale) })
    } else if (amount < 0) {
      return targetName
        ? t('youOweSpecific', { name: participantName, amount: formatCurrency(currency, -amount, locale) })
        : t('youOwe', { name: participantName, amount: formatCurrency(currency, -amount, locale) })
    } else {
      return targetName
        ? t('evenWithSpecific', { name: participantName })
        : t('evenWith', { name: participantName })
    }
  }

  // Handle different query types
  const renderBalanceResponse = () => {
    switch (query.queryType) {
      case 'specific_balance': {
        if (!query.targetUser) {
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('needSpecificPerson')}
              </p>
              <div className="flex gap-2 flex-wrap">
                {participants.map(participant => (
                  <Button
                    key={participant.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onFollowUpQuestion?.(`How much does ${participant.name} owe me?`)}
                  >
                    {participant.name}
                  </Button>
                ))}
              </div>
            </div>
          )
        }

        const targetParticipant = getParticipantByName(query.targetUser)
        if (!targetParticipant) {
          return (
            <div className="space-y-4">
              <p className="text-sm text-destructive">
                {t('participantNotFound', { name: query.targetUser })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('availableParticipants')}: {participants.map(p => p.name).join(', ')}
              </p>
            </div>
          )
        }

        const balance = balances[targetParticipant.id]?.total || 0
        
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">
                {t('balanceWith', { name: targetParticipant.name })}
              </h3>
              <p className="text-lg">
                {formatBalance(balance, targetParticipant.name, query.targetUser)}
              </p>
            </div>
            
            {/* Show individual balance details */}
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">{t('paid')}:</span>{' '}
                {formatCurrency(currency, balances[targetParticipant.id]?.paid || 0, locale)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('paidFor')}:</span>{' '}
                {formatCurrency(currency, balances[targetParticipant.id]?.paidFor || 0, locale)}
              </p>
            </div>

            {/* Suggest follow-up questions */}
            <div className="flex gap-2 flex-wrap mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFollowUpQuestion?.(t('showAllBalances'))}
              >
                {t('viewAllBalances')}
              </Button>
              {balance !== 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFollowUpQuestion?.(t('howToSettle'))}
                >
                  {t('howToSettle')}
                </Button>
              )}
            </div>
          </div>
        )
      }

      case 'general_balance': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">{t('allBalances')}</h3>
              <BalancesList 
                balances={balances}
                participants={participants}
                currency={currency}
              />
            </div>

            {/* Quick insights */}
            <div className="text-sm space-y-1 p-3 bg-muted/30 rounded">
              <p className="font-medium">{t('quickInsights')}:</p>
              <ul className="space-y-1 ml-4">
                <li>• {t('totalParticipants', { count: participants.length })}</li>
                <li>• {t('activeBalances', { 
                  count: Object.values(balances).filter(b => b.total !== 0).length 
                })}</li>
                <li>• {t('suggestedReimbursements', { count: reimbursements.length })}</li>
              </ul>
            </div>

            {/* Follow-up actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFollowUpQuestion?.(t('howToSettle'))}
              >
                {t('showReimbursements')}
              </Button>
              {participants.map(participant => (
                <Button
                  key={participant.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => onFollowUpQuestion?.(`How much does ${participant.name} owe me?`)}
                >
                  {participant.name}
                </Button>
              ))}
            </div>
          </div>
        )
      }

      case 'settlement_suggestions': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">{t('suggestedSettlements')}</h3>
              {reimbursements.length > 0 ? (
                <ReimbursementList
                  reimbursements={reimbursements}
                  participants={participants}
                  currency={currency}
                  groupId={groupId}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('allSettled')}
                </p>
              )}
            </div>

            {reimbursements.length > 0 && (
              <div className="text-sm p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {t('optimizationTip')}
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  {t('optimizationExplanation')}
                </p>
              </div>
            )}

            {/* Follow-up actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFollowUpQuestion?.(t('showAllBalances'))}
              >
                {t('viewAllBalances')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onShowTraditionalView}
              >
                {t('traditionalView')}
              </Button>
            </div>
          </div>
        )
      }

      case 'reimbursement_status': {
        if (!query.targetUser) {
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('needSpecificPersonReimbursement')}
              </p>
              <div className="flex gap-2 flex-wrap">
                {participants.map(participant => (
                  <Button
                    key={participant.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onFollowUpQuestion?.(`Did ${participant.name} pay me back?`)}
                  >
                    {participant.name}
                  </Button>
                ))}
              </div>
            </div>
          )
        }

        const targetParticipant = getParticipantByName(query.targetUser)
        if (!targetParticipant) {
          return (
            <div className="space-y-4">
              <p className="text-sm text-destructive">
                {t('participantNotFound', { name: query.targetUser })}
              </p>
            </div>
          )
        }

        const balance = balances[targetParticipant.id]?.total || 0
        const hasOutstandingDebt = balance < 0 // They owe you money
        const hasOutstandingCredit = balance > 0 // You owe them money

        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">
                {t('reimbursementStatus', { name: targetParticipant.name })}
              </h3>
              
              {balance === 0 ? (
                <p className="text-green-700 dark:text-green-400">
                  {t('allSettledWith', { name: targetParticipant.name })}
                </p>
              ) : hasOutstandingDebt ? (
                <p className="text-amber-700 dark:text-amber-400">
                  {t('stillOwesYou', { 
                    name: targetParticipant.name, 
                    amount: formatCurrency(currency, -balance, locale) 
                  })}
                </p>
              ) : (
                <p className="text-blue-700 dark:text-blue-400">
                  {t('youStillOwe', { 
                    name: targetParticipant.name, 
                    amount: formatCurrency(currency, balance, locale) 
                  })}
                </p>
              )}
            </div>

            {/* Suggested actions */}
            {balance !== 0 && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFollowUpQuestion?.(t('howToSettle'))}
                >
                  {t('howToSettle')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFollowUpQuestion?.(`How much does ${targetParticipant.name} owe me?`)}
                >
                  {t('seeDetails')}
                </Button>
              </div>
            )}
          </div>
        )
      }

      case 'historical_balance': {
        // For now, show current balances with a note about historical data
        return (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <h3 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                {t('historicalNote')}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t('historicalExplanation')}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">{t('currentBalances')}</h3>
              <BalancesList 
                balances={balances}
                participants={participants}
                currency={currency}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFollowUpQuestion?.(t('showAllBalances'))}
              >
                {t('viewCurrentBalances')}
              </Button>
            </div>
          </div>
        )
      }

      default: {
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('unknownQueryType')}
            </p>
            <BalancesList 
              balances={balances}
              participants={participants}
              currency={currency}
            />
          </div>
        )
      }
    }
  }

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      {renderBalanceResponse()}
    </div>
  )
}

// Fallback component for when balance data is loading
export function ConversationalBalanceResponseSkeleton() {
  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-full"></div>
          <div className="h-3 bg-muted rounded w-2/3"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-muted rounded w-20"></div>
          <div className="h-8 bg-muted rounded w-24"></div>
        </div>
      </div>
    </div>
  )
}