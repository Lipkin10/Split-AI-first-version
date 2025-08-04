'use client'

import { ExpenseFormValues } from '@/lib/schemas'
import { trpc } from '@/trpc/client'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  Loader2,
  Sparkles,
} from 'lucide-react'

import { ExpenseForm } from '@/app/groups/[groupId]/expenses/expense-form'
import { RuntimeFeatureFlags } from '@/lib/featureFlags'

interface ConversationalExpenseFormProps {
  message: string
  groupId: string
  group: NonNullable<AppRouterOutput['groups']['get']['group']>
  categories: AppRouterOutput['categories']['list']['categories']
  language?: string
  onExpenseCreated: (expenseId: string) => void
  onCancel: () => void
  runtimeFeatureFlags: RuntimeFeatureFlags
}

interface ExtractedExpenseData {
  amount: number
  title: string
  participants: string[]
  category?: string
  date?: string
  splitMode: 'EVENLY' | 'BY_SHARES' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
  paidBy?: string
}

interface AIExtractionResult {
  success: boolean
  expenseData?: ExtractedExpenseData
  confidence: number
  clarificationNeeded?: string
  fallbackReason?: string
  validationErrors?: string[]
}

export function ConversationalExpenseForm({
  message,
  groupId,
  group,
  categories,
  language = 'en-US',
  onExpenseCreated,
  onCancel,
  runtimeFeatureFlags,
}: ConversationalExpenseFormProps) {
  const t = useTranslations('ConversationalExpenseForm')
  const [extractionState, setExtractionState] = useState<
    'extracting' | 'success' | 'error' | 'editing'
  >('extracting')
  const [extractionResult, setExtractionResult] =
    useState<AIExtractionResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Extract expense data from natural language
  const extractExpenseData =
    trpc.ai.conversation.createExpenseFromText.useMutation({
      onSuccess: (result) => {
        setExtractionResult(result)
        if (result.success && result.expenseData) {
          setExtractionState('success')
        } else {
          setExtractionState('error')
        }
      },
      onError: (error) => {
        console.error('Failed to extract expense data:', error)
        setExtractionResult({
          success: false,
          confidence: 0,
          clarificationNeeded:
            'Failed to process your request. Please try again or use manual entry.',
          fallbackReason: 'unknown',
        })
        setExtractionState('error')
      },
    })

  // Create expense using existing tRPC endpoint
  const createExpense = trpc.groups.expenses.create.useMutation({
    onSuccess: (result) => {
      onExpenseCreated(result.expenseId)
    },
    onError: (error) => {
      console.error('Failed to create expense:', error)
      setIsSubmitting(false)
    },
  })

  // Initialize extraction on mount
  useEffect(() => {
    if (message && groupId) {
      extractExpenseData.mutate({
        message,
        groupId,
        language,
      })
    }
  }, [message, groupId, language]) // eslint-disable-line react-hooks/exhaustive-deps

  // Convert AI extracted data to ExpenseFormValues
  const convertToExpenseFormValues = useCallback(
    (data: ExtractedExpenseData): Partial<ExpenseFormValues> => {
      // Find category ID by name
      let categoryId = 0 // Default category
      if (data.category) {
        const foundCategory = categories.find(
          (c) => c.name.toLowerCase() === data.category!.toLowerCase(),
        )
        if (foundCategory) {
          categoryId = foundCategory.id
        }
      }

      // Set expense date
      const expenseDate = data.date ? new Date(data.date) : new Date()

      // Set paid by - default to first participant if not specified
      const paidBy =
        data.paidBy ||
        (data.participants.length > 0
          ? data.participants[0]
          : group.participants[0]?.id)

      // Convert participants to paidFor array
      const paidFor = data.participants.map((participantId) => ({
        participant: participantId,
        shares: '1' as unknown as number, // Will be processed by form validation
      }))

      return {
        title: data.title,
        amount: String(data.amount / 100) as unknown as number, // Convert from cents to dollars
        expenseDate,
        category: categoryId,
        paidBy,
        paidFor,
        splitMode: data.splitMode,
        isReimbursement: false,
        saveDefaultSplittingOptions: false,
        documents: [],
        notes: '',
        recurrenceRule: 'NONE',
      }
    },
    [categories, group.participants],
  )

  // Handle confirmation of AI-suggested data
  const handleConfirmExpense = useCallback(
    async (formValues: ExpenseFormValues, participantId?: string) => {
      setIsSubmitting(true)
      try {
        await createExpense.mutateAsync({
          groupId,
          expenseFormValues: formValues,
          participantId,
        })
      } catch (error) {
        console.error('Error creating expense:', error)
        setIsSubmitting(false)
      }
    },
    [groupId, createExpense],
  )

  // Handle edit mode toggle
  const handleEditExpense = useCallback(() => {
    setExtractionState('editing')
  }, [])

  // Render extraction loading state
  if (extractionState === 'extracting') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            {t('extractingTitle', {
              defaultValue: 'Analyzing your expense...',
            })}
          </CardTitle>
          <CardDescription>
            {t('extractingDescription', {
              defaultValue:
                'AI is processing your message to extract expense details.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-muted-foreground">
              {t('processing', { defaultValue: 'Processing...' })}
            </span>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {t('originalMessage', { defaultValue: 'Your message:' })}
            </p>
            <p className="text-sm">{message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render error state with clarification
  if (extractionState === 'error' && extractionResult) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {t('extractionFailed', {
              defaultValue: 'Unable to process expense',
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {extractionResult.clarificationNeeded ||
                t('defaultError', {
                  defaultValue:
                    'I had trouble understanding your expense request.',
                })}
            </AlertDescription>
          </Alert>

          {extractionResult.validationErrors &&
            extractionResult.validationErrors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('issues', { defaultValue: 'Issues found:' })}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {extractionResult.validationErrors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t('cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              onClick={() => setExtractionState('editing')}
              className="flex-1"
            >
              {t('useManualEntry', { defaultValue: 'Use Manual Entry' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render confirmation state with AI-suggested data
  if (
    extractionState === 'success' &&
    extractionResult?.success &&
    extractionResult.expenseData
  ) {
    const expenseData = extractionResult.expenseData
    const initialValues = convertToExpenseFormValues(expenseData)

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* AI Extraction Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {t('extractionSuccess', {
                defaultValue: 'Expense details extracted',
              })}
              <Badge variant="secondary" className="ml-2">
                {Math.round(extractionResult.confidence * 100)}%{' '}
                {t('confidence', { defaultValue: 'confidence' })}
              </Badge>
            </CardTitle>
            <CardDescription>
              {t('confirmDescription', {
                defaultValue:
                  'Please review and confirm the expense details below.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('extractedAmount', { defaultValue: 'Amount' })}
                </p>
                <p className="text-lg font-semibold">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: group.currency,
                  }).format(expenseData.amount / 100)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('extractedTitle', { defaultValue: 'Description' })}
                </p>
                <p className="text-lg">{expenseData.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('extractedParticipants', { defaultValue: 'Participants' })}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {expenseData.participants.map((participantId) => {
                    const participant = group.participants.find(
                      (p) => p.id === participantId,
                    )
                    return (
                      <Badge key={participantId} variant="outline">
                        {participant?.name || participantId}
                      </Badge>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('extractedDate', { defaultValue: 'Date' })}
                </p>
                <p>
                  {expenseData.date || new Date().toISOString().split('T')[0]}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={handleEditExpense}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                {t('edit', { defaultValue: 'Edit Details' })}
              </Button>
              <Button
                onClick={() => {
                  const formValues = convertToExpenseFormValues(expenseData)
                  handleConfirmExpense(formValues as ExpenseFormValues)
                }}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('creating', { defaultValue: 'Creating...' })}
                  </>
                ) : (
                  t('confirmCreate', {
                    defaultValue: 'Confirm & Create Expense',
                  })
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render edit mode with full expense form
  if (extractionState === 'editing') {
    const initialValues =
      extractionResult?.success && extractionResult.expenseData
        ? convertToExpenseFormValues(extractionResult.expenseData)
        : undefined

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {t('editExpense', { defaultValue: 'Edit Expense Details' })}
            </CardTitle>
            <CardDescription>
              {t('editDescription', {
                defaultValue:
                  'Modify the expense details and create when ready.',
              })}
            </CardDescription>
          </CardHeader>
        </Card>

        <ExpenseForm
          group={group}
          categories={categories}
          onSubmit={handleConfirmExpense}
          runtimeFeatureFlags={runtimeFeatureFlags}
          // Pre-populate with AI-extracted data if available
          expense={
            initialValues
              ? {
                  id: 'temp',
                  groupId,
                  title: initialValues.title!,
                  amount:
                    typeof initialValues.amount === 'string'
                      ? Math.round(parseFloat(initialValues.amount) * 100)
                      : initialValues.amount!,
                  expenseDate: initialValues
                    .expenseDate!.toISOString()
                    .split('T')[0],
                  categoryId: initialValues.category!,
                  paidById: initialValues.paidBy!,
                  isReimbursement: initialValues.isReimbursement!,
                  splitMode: initialValues.splitMode!,
                  createdAt: new Date().toISOString(),
                  notes: initialValues.notes || null,
                  recurrenceRule: initialValues.recurrenceRule || null,
                  recurringExpenseLinkId: null,
                  paidBy:
                    group.participants.find(
                      (p) => p.id === initialValues.paidBy!,
                    ) || group.participants[0],
                  paidFor: initialValues.paidFor!.map((pf) => ({
                    expenseId: 'temp',
                    participantId: pf.participant,
                    shares:
                      typeof pf.shares === 'string'
                        ? Math.round(parseFloat(pf.shares) * 100)
                        : pf.shares,
                    participant: group.participants.find(
                      (p) => p.id === pf.participant,
                    )!,
                  })),
                  category:
                    categories.find((c) => c.id === initialValues.category!) ||
                    null,
                  documents: [],
                }
              : undefined
          }
        />
      </div>
    )
  }

  // Fallback
  return null
}
