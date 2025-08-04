import { ExpenseFormValues, GroupFormValues } from '@/lib/schemas'
import { normalizeRelation, supabaseAdmin } from '@/lib/supabase'
import { nanoid } from 'nanoid'

// Define types and enums to replace Prisma types
export type ActivityType =
  | 'UPDATE_GROUP'
  | 'CREATE_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'DELETE_EXPENSE'

export const SplitMode = {
  EVENLY: 'EVENLY',
  BY_SHARES: 'BY_SHARES',
  BY_PERCENTAGE: 'BY_PERCENTAGE',
  BY_AMOUNT: 'BY_AMOUNT',
} as const

export type SplitMode = (typeof SplitMode)[keyof typeof SplitMode]

export const RecurrenceRule = {
  NONE: 'NONE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const

export type RecurrenceRule =
  (typeof RecurrenceRule)[keyof typeof RecurrenceRule]

// Define proper interfaces for Supabase relationship data
export interface Participant {
  id: string
  name: string
  groupId: string
}

export interface Category {
  id: number
  grouping: string
  name: string
}

export interface ExpenseDocument {
  id: string
  url: string
  width: number
  height: number
  expenseId: string | null
}

export interface ExpensePaidFor {
  expenseId: string
  participantId: string
  shares: number
  participant: Participant
}

export interface Expense {
  id: string
  groupId: string
  expenseDate: string
  title: string
  categoryId: number
  amount: number
  paidById: string
  isReimbursement: boolean
  splitMode: SplitMode
  createdAt: string
  notes: string | null
  recurrenceRule: RecurrenceRule | null
  recurringExpenseLinkId: string | null
  // Relationship data
  paidBy: Participant
  paidFor: ExpensePaidFor[]
  category: Category | null
  documents: ExpenseDocument[]
  recurringExpenseLink?: RecurringExpenseLink
  _count?: { documents: number }
}

export interface Group {
  id: string
  name: string
  information: string | null
  currency: string
  createdAt: string
  participants: Participant[]
  _count?: { participants: number }
}

export interface RecurringExpenseLink {
  id: string
  groupId: string
  currentFrameExpenseId: string
  nextExpenseCreatedAt: string | null
  nextExpenseDate: string
}

export interface Activity {
  id: string
  groupId: string
  time: string
  activityType: ActivityType
  participantId: string | null
  expenseId: string | null
  data: string | null
  expense?: Expense
}

export function randomId() {
  return nanoid()
}

export async function createGroup(groupFormValues: GroupFormValues) {
  const groupId = randomId()

  // Insert group
  const { data: group } = await supabaseAdmin
    .from('Group')
    .insert({
      id: groupId,
      name: groupFormValues.name,
      information: groupFormValues.information,
      currency: groupFormValues.currency,
    })
    .select()
    .single()

  // Insert participants
  const participantsData = groupFormValues.participants.map(({ name }) => ({
    id: randomId(),
    name,
    groupId,
  }))

  const { data: participants } = await supabaseAdmin
    .from('Participant')
    .insert(participantsData)
    .select()

  return {
    ...group,
    participants: participants || [],
  }
}

export async function createExpense(
  expenseFormValues: ExpenseFormValues,
  groupId: string,
  participantId?: string,
): Promise<Expense> {
  const group = await getGroup(groupId)
  if (!group) throw new Error(`Invalid group ID: ${groupId}`)

  for (const participant of [
    expenseFormValues.paidBy,
    ...expenseFormValues.paidFor.map((p) => p.participant),
  ]) {
    if (!group.participants.some((p) => p.id === participant))
      throw new Error(`Invalid participant ID: ${participant}`)
  }

  const expenseId = randomId()
  await logActivity(groupId, 'CREATE_EXPENSE', {
    participantId,
    expenseId,
    data: expenseFormValues.title,
  })

  const isCreateRecurrence = expenseFormValues.recurrenceRule !== 'NONE'

  // Create the expense
  const { data: expense } = await supabaseAdmin
    .from('Expense')
    .insert({
      id: expenseId,
      groupId,
      expenseDate: expenseFormValues.expenseDate.toISOString().split('T')[0],
      categoryId: expenseFormValues.category,
      amount: expenseFormValues.amount,
      title: expenseFormValues.title,
      paidById: expenseFormValues.paidBy,
      splitMode: expenseFormValues.splitMode,
      recurrenceRule: expenseFormValues.recurrenceRule,
      isReimbursement: expenseFormValues.isReimbursement,
      notes: expenseFormValues.notes,
    })
    .select()
    .single()

  // Create recurring expense link if needed
  if (isCreateRecurrence) {
    const recurringExpenseLinkPayload = createPayloadForNewRecurringExpenseLink(
      expenseFormValues.recurrenceRule as RecurrenceRule,
      expenseFormValues.expenseDate,
      groupId,
    )

    await supabaseAdmin.from('RecurringExpenseLink').insert({
      ...recurringExpenseLinkPayload,
      currentFrameExpenseId: expenseId,
    })

    // Update expense with recurring link ID
    await supabaseAdmin
      .from('Expense')
      .update({ recurringExpenseLinkId: recurringExpenseLinkPayload.id })
      .eq('id', expenseId)
  }

  // Create ExpensePaidFor entries
  const paidForData = expenseFormValues.paidFor.map((paidFor) => ({
    expenseId,
    participantId: paidFor.participant,
    shares: paidFor.shares,
  }))

  if (paidForData.length > 0) {
    await supabaseAdmin.from('ExpensePaidFor').insert(paidForData)
  }

  // Create document entries
  if (expenseFormValues.documents.length > 0) {
    const documentsData = expenseFormValues.documents.map((doc) => ({
      id: randomId(),
      url: doc.url,
      width: doc.width,
      height: doc.height,
      expenseId,
    }))

    await supabaseAdmin.from('ExpenseDocument').insert(documentsData)
  }

  return expense as Expense
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
  participantId?: string,
) {
  const existingExpense = await getExpense(groupId, expenseId)
  await logActivity(groupId, 'DELETE_EXPENSE', {
    participantId,
    expenseId,
    data: existingExpense?.title,
  })

  await supabaseAdmin.from('Expense').delete().eq('id', expenseId)
}

export async function getGroupExpensesParticipants(groupId: string) {
  const expenses = await getGroupExpenses(groupId)
  return Array.from(
    new Set(
      expenses
        .flatMap((e) => [
          normalizeRelation(e.paidBy)?.id,
          ...e.paidFor.map((pf) => normalizeRelation(pf.participant)?.id),
        ])
        .filter(Boolean),
    ),
  )
}

export async function getGroups(groupIds: string[]) {
  const { data: groups } = await supabaseAdmin
    .from('Group')
    .select('*')
    .in('id', groupIds)

  if (!groups) return []

  // Get participant counts separately
  const groupsWithCounts = await Promise.all(
    groups.map(async (group) => {
      const { count } = await supabaseAdmin
        .from('Participant')
        .select('*', { count: 'exact', head: true })
        .eq('groupId', group.id)

      return {
        ...group,
        _count: { participants: count || 0 },
        createdAt: group.createdAt,
      }
    }),
  )

  return groupsWithCounts
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  expenseFormValues: ExpenseFormValues,
  participantId?: string,
) {
  const group = await getGroup(groupId)
  if (!group) throw new Error(`Invalid group ID: ${groupId}`)

  const existingExpense = await getExpense(groupId, expenseId)
  if (!existingExpense) throw new Error(`Invalid expense ID: ${expenseId}`)

  for (const participant of [
    expenseFormValues.paidBy,
    ...expenseFormValues.paidFor.map((p) => p.participant),
  ]) {
    if (!group.participants.some((p) => p.id === participant))
      throw new Error(`Invalid participant ID: ${participant}`)
  }

  await logActivity(groupId, 'UPDATE_EXPENSE', {
    participantId,
    expenseId,
    data: expenseFormValues.title,
  })

  const isDeleteRecurrenceExpenseLink =
    existingExpense.recurrenceRule !== 'NONE' &&
    expenseFormValues.recurrenceRule === 'NONE' &&
    existingExpense.recurringExpenseLink?.nextExpenseCreatedAt === null

  const isUpdateRecurrenceExpenseLink =
    existingExpense.recurrenceRule !== expenseFormValues.recurrenceRule &&
    existingExpense.recurringExpenseLink?.nextExpenseCreatedAt === null

  const isCreateRecurrenceExpenseLink =
    existingExpense.recurrenceRule === 'NONE' &&
    expenseFormValues.recurrenceRule !== 'NONE' &&
    existingExpense.recurringExpenseLink === null

  // Update basic expense data
  const { data: updatedExpense } = await supabaseAdmin
    .from('Expense')
    .update({
      expenseDate: expenseFormValues.expenseDate.toISOString().split('T')[0],
      amount: expenseFormValues.amount,
      title: expenseFormValues.title,
      categoryId: expenseFormValues.category,
      paidById: expenseFormValues.paidBy,
      splitMode: expenseFormValues.splitMode,
      recurrenceRule: expenseFormValues.recurrenceRule,
      isReimbursement: expenseFormValues.isReimbursement,
      notes: expenseFormValues.notes,
    })
    .eq('id', expenseId)
    .select()
    .single()

  // Handle recurring expense link changes
  if (isDeleteRecurrenceExpenseLink && existingExpense.recurringExpenseLink) {
    await supabaseAdmin
      .from('RecurringExpenseLink')
      .delete()
      .eq('id', existingExpense.recurringExpenseLink.id)

    await supabaseAdmin
      .from('Expense')
      .update({ recurringExpenseLinkId: null })
      .eq('id', expenseId)
  }

  if (isUpdateRecurrenceExpenseLink && existingExpense.recurringExpenseLink) {
    const updatedNextExpenseDate = calculateNextDate(
      expenseFormValues.recurrenceRule as RecurrenceRule,
      new Date(existingExpense.expenseDate),
    )

    await supabaseAdmin
      .from('RecurringExpenseLink')
      .update({ nextExpenseDate: updatedNextExpenseDate.toISOString() })
      .eq('id', existingExpense.recurringExpenseLink.id)
  }

  if (isCreateRecurrenceExpenseLink) {
    const newRecurringExpenseLink = createPayloadForNewRecurringExpenseLink(
      expenseFormValues.recurrenceRule as RecurrenceRule,
      expenseFormValues.expenseDate,
      groupId,
    )

    await supabaseAdmin.from('RecurringExpenseLink').insert({
      ...newRecurringExpenseLink,
      currentFrameExpenseId: expenseId,
    })

    await supabaseAdmin
      .from('Expense')
      .update({ recurringExpenseLinkId: newRecurringExpenseLink.id })
      .eq('id', expenseId)
  }

  // Handle paidFor relationships
  const existingPaidForIds = existingExpense.paidFor.map(
    (pf) => pf.participantId,
  )
  const formPaidForIds = expenseFormValues.paidFor.map((pf) => pf.participant)

  // Delete paidFor entries that are no longer in the form
  const paidForToDelete = existingPaidForIds.filter(
    (id) => !formPaidForIds.includes(id),
  )
  if (paidForToDelete.length > 0) {
    await supabaseAdmin
      .from('ExpensePaidFor')
      .delete()
      .eq('expenseId', expenseId)
      .in('participantId', paidForToDelete)
  }

  // Upsert paidFor entries
  for (const paidFor of expenseFormValues.paidFor) {
    const { error } = await supabaseAdmin.from('ExpensePaidFor').upsert({
      expenseId,
      participantId: paidFor.participant,
      shares: paidFor.shares,
    })

    if (error) {
      console.error('Error upserting ExpensePaidFor:', error)
    }
  }

  // Handle documents
  const existingDocIds = existingExpense.documents.map((doc) => doc.id)
  const formDocIds = expenseFormValues.documents.map((doc) => doc.id)

  // Delete documents that are no longer in the form
  const docsToDelete = existingDocIds.filter((id) => !formDocIds.includes(id))
  if (docsToDelete.length > 0) {
    await supabaseAdmin.from('ExpenseDocument').delete().in('id', docsToDelete)
  }

  // Create new documents
  const newDocs = expenseFormValues.documents.filter(
    (doc) => !existingDocIds.includes(doc.id),
  )
  if (newDocs.length > 0) {
    await supabaseAdmin.from('ExpenseDocument').insert(
      newDocs.map((doc) => ({
        ...doc,
        expenseId,
      })),
    )
  }

  return updatedExpense
}

export async function updateGroup(
  groupId: string,
  groupFormValues: GroupFormValues,
  participantId?: string,
) {
  const existingGroup = await getGroup(groupId)
  if (!existingGroup) throw new Error('Invalid group ID')

  await logActivity(groupId, 'UPDATE_GROUP', { participantId })

  // Update group basic info
  const { data: updatedGroup } = await supabaseAdmin
    .from('Group')
    .update({
      name: groupFormValues.name,
      information: groupFormValues.information,
      currency: groupFormValues.currency,
    })
    .eq('id', groupId)
    .select()
    .single()

  // Handle participant updates
  const existingParticipantIds = existingGroup.participants.map((p) => p.id)
  const formParticipantIds = groupFormValues.participants
    .filter((p) => p.id)
    .map((p) => p.id)

  // Delete participants that are no longer in the form
  const participantsToDelete = existingParticipantIds.filter(
    (id) => !formParticipantIds.includes(id),
  )
  if (participantsToDelete.length > 0) {
    await supabaseAdmin
      .from('Participant')
      .delete()
      .in('id', participantsToDelete)
  }

  // Update existing participants
  for (const participant of groupFormValues.participants) {
    if (participant.id) {
      await supabaseAdmin
        .from('Participant')
        .update({ name: participant.name })
        .eq('id', participant.id)
    }
  }

  // Create new participants
  const newParticipants = groupFormValues.participants
    .filter((p) => !p.id)
    .map((p) => ({
      id: randomId(),
      name: p.name,
      groupId,
    }))

  if (newParticipants.length > 0) {
    await supabaseAdmin.from('Participant').insert(newParticipants)
  }

  return updatedGroup
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data: group } = await supabaseAdmin
    .from('Group')
    .select(
      `
      *,
      participants:Participant(*)
    `,
    )
    .eq('id', groupId)
    .single()

  return group as Group
}

export async function getCategories() {
  const { data: categories } = await supabaseAdmin
    .from('Category')
    .select('*')
    .order('id')

  return categories || []
}

export async function getGroupExpenses(
  groupId: string,
  options?: { offset?: number; length?: number; filter?: string },
): Promise<Expense[]> {
  await createRecurringExpenses()

  let query = supabaseAdmin
    .from('Expense')
    .select(
      `
      amount,
      category:Category(*),
      createdAt,
      expenseDate,
      id,
      isReimbursement,
      paidBy:Participant!paidById(id, name),
      paidFor:ExpensePaidFor(
        shares,
        participant:Participant(id, name)
      ),
      splitMode,
      recurrenceRule,
      title
    `,
    )
    .eq('groupId', groupId)
    .order('expenseDate', { ascending: false })
    .order('createdAt', { ascending: false })

  if (options?.filter) {
    query = query.ilike('title', `%${options.filter}%`)
  }

  if (options?.offset && options?.length) {
    query = query.range(options.offset, options.offset + options.length - 1)
  } else if (options?.length) {
    query = query.limit(options.length)
  }

  const { data: expenses } = await query

  if (!expenses) return []

  // Get document counts separately and normalize the data
  const expensesWithCounts = await Promise.all(
    expenses.map(async (expense: any) => {
      const { count } = await supabaseAdmin
        .from('ExpenseDocument')
        .select('*', { count: 'exact', head: true })
        .eq('expenseId', expense.id)

      return {
        ...expense,
        // Normalize relationship data for compatibility
        paidBy: Array.isArray(expense.paidBy)
          ? expense.paidBy[0]
          : expense.paidBy,
        category: Array.isArray(expense.category)
          ? expense.category[0]
          : expense.category,
        _count: { documents: count || 0 },
      } as Expense
    }),
  )

  return expensesWithCounts
}

export async function getGroupExpenseCount(groupId: string) {
  const { count } = await supabaseAdmin
    .from('Expense')
    .select('*', { count: 'exact', head: true })
    .eq('groupId', groupId)

  return count || 0
}

export async function getExpense(
  groupId: string,
  expenseId: string,
): Promise<Expense | null> {
  const { data: expense } = await supabaseAdmin
    .from('Expense')
    .select(
      `
      *,
      paidBy:Participant!paidById(*),
      paidFor:ExpensePaidFor(
        *,
        participant:Participant(*)
      ),
      category:Category(*),
      documents:ExpenseDocument(*),
      recurringExpenseLink:RecurringExpenseLink(*)
    `,
    )
    .eq('id', expenseId)
    .single()

  if (!expense) return null

  // Normalize the relationship data
  return {
    ...expense,
    paidBy: Array.isArray(expense.paidBy) ? expense.paidBy[0] : expense.paidBy,
    category: Array.isArray(expense.category)
      ? expense.category[0]
      : expense.category,
    documents: expense.documents || [],
    paidFor: expense.paidFor || [],
    recurringExpenseLink: Array.isArray(expense.recurringExpenseLink)
      ? expense.recurringExpenseLink[0]
      : expense.recurringExpenseLink,
  } as Expense
}

export async function getActivities(
  groupId: string,
  options?: { offset?: number; length?: number },
) {
  let query = supabaseAdmin
    .from('Activity')
    .select('*')
    .eq('groupId', groupId)
    .order('time', { ascending: false })

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.length || 20) - 1,
    )
  } else if (options?.length) {
    query = query.limit(options.length)
  }

  const { data: activities } = await query

  const expenseIds = (activities || [])
    .map((activity) => activity.expenseId)
    .filter(Boolean) as string[]

  let expenses: any[] = []
  if (expenseIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('Expense')
      .select('*')
      .eq('groupId', groupId)
      .in('id', expenseIds)
    expenses = data || []
  }

  return (activities || []).map((activity) => ({
    ...activity,
    expense:
      activity.expenseId !== null
        ? expenses.find((expense) => expense.id === activity.expenseId)
        : undefined,
  }))
}

export async function logActivity(
  groupId: string,
  activityType: ActivityType,
  extra?: { participantId?: string; expenseId?: string; data?: string },
) {
  const { data } = await supabaseAdmin
    .from('Activity')
    .insert({
      id: randomId(),
      groupId,
      activityType,
      ...extra,
    })
    .select()
    .single()

  return data
}

async function createRecurringExpenses() {
  const localDate = new Date() // Current local date
  const utcDateFromLocal = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      localDate.getUTCHours(),
      localDate.getUTCMinutes(),
    ),
  )

  const { data: recurringExpenseLinksWithExpensesToCreate } =
    await supabaseAdmin
      .from('RecurringExpenseLink')
      .select(
        `
      *,
      currentFrameExpense:Expense!currentFrameExpenseId(
        *,
        paidBy:Participant!paidById(*),
        paidFor:ExpensePaidFor(
          *,
          participant:Participant(*)
        ),
        category:Category(*),
        documents:ExpenseDocument(*)
      )
    `,
      )
      .is('nextExpenseCreatedAt', null)
      .lte('nextExpenseDate', utcDateFromLocal.toISOString())

  for (const recurringExpenseLink of recurringExpenseLinksWithExpensesToCreate ||
    []) {
    let newExpenseDate = new Date(recurringExpenseLink.nextExpenseDate)
    let currentExpenseRecord = recurringExpenseLink.currentFrameExpense
    let currentRecurringExpenseLinkId = recurringExpenseLink.id

    while (newExpenseDate < utcDateFromLocal) {
      const newExpenseId = randomId()
      const newRecurringExpenseLinkId = randomId()

      const newRecurringExpenseNextExpenseDate = calculateNextDate(
        currentExpenseRecord.recurrenceRule as RecurrenceRule,
        newExpenseDate,
      )

      try {
        // Create new expense with same data as current frame
        const { data: newExpense } = await supabaseAdmin
          .from('Expense')
          .insert({
            id: newExpenseId,
            groupId: currentExpenseRecord.groupId,
            expenseDate: newExpenseDate.toISOString().split('T')[0],
            title: currentExpenseRecord.title,
            categoryId: currentExpenseRecord.categoryId,
            amount: currentExpenseRecord.amount,
            paidById: currentExpenseRecord.paidById,
            splitMode: currentExpenseRecord.splitMode,
            recurrenceRule: currentExpenseRecord.recurrenceRule,
            isReimbursement: currentExpenseRecord.isReimbursement,
            notes: currentExpenseRecord.notes,
            recurringExpenseLinkId: newRecurringExpenseLinkId,
          })
          .select()
          .single()

        // Create new recurring expense link
        await supabaseAdmin.from('RecurringExpenseLink').insert({
          id: newRecurringExpenseLinkId,
          groupId: currentExpenseRecord.groupId,
          currentFrameExpenseId: newExpenseId,
          nextExpenseDate: newRecurringExpenseNextExpenseDate.toISOString(),
        })

        // Create ExpensePaidFor entries
        if (currentExpenseRecord.paidFor?.length > 0) {
          await supabaseAdmin.from('ExpensePaidFor').insert(
            currentExpenseRecord.paidFor.map((paidFor: any) => ({
              expenseId: newExpenseId,
              participantId: paidFor.participantId,
              shares: paidFor.shares,
            })),
          )
        }

        // Connect documents (they can be shared across recurring expenses)
        if (currentExpenseRecord.documents?.length > 0) {
          await supabaseAdmin
            .from('ExpenseDocument')
            .update({ expenseId: newExpenseId })
            .in(
              'id',
              currentExpenseRecord.documents.map((doc: any) => doc.id),
            )
        }

        // Mark the current RecurringExpenseLink as completed
        await supabaseAdmin
          .from('RecurringExpenseLink')
          .update({ nextExpenseCreatedAt: new Date().toISOString() })
          .eq('id', currentRecurringExpenseLinkId)
          .is('nextExpenseCreatedAt', null)

        // Update for next iteration
        currentExpenseRecord = {
          ...newExpense,
          paidFor: currentExpenseRecord.paidFor,
          documents: currentExpenseRecord.documents,
        }
        currentRecurringExpenseLinkId = newRecurringExpenseLinkId
        newExpenseDate = newRecurringExpenseNextExpenseDate
      } catch (error) {
        console.error(
          'Failed to create recurring expense for expenseId:',
          currentExpenseRecord.id,
          error,
        )
        break
      }
    }
  }
}

function createPayloadForNewRecurringExpenseLink(
  recurrenceRule: RecurrenceRule,
  priorDateToNextRecurrence: Date,
  groupId: string,
): RecurringExpenseLink {
  const nextExpenseDate = calculateNextDate(
    recurrenceRule,
    priorDateToNextRecurrence,
  )

  const recurringExpenseLinkId = randomId()
  const recurringExpenseLinkPayload = {
    id: recurringExpenseLinkId,
    groupId: groupId,
    nextExpenseDate: nextExpenseDate.toISOString(),
  }

  return {
    ...recurringExpenseLinkPayload,
    currentFrameExpenseId: '', // Will be set when used
    nextExpenseCreatedAt: null,
  } as RecurringExpenseLink
}

// TODO: Modify this function to use a more comprehensive recurrence Rule library like rrule (https://github.com/jkbrzt/rrule)
//
// Current limitations:
// - If a date is intended to be repeated monthly on the 29th, 30th or 31st, it will change to repeating on the smallest
// date that the reccurence has encountered. Ex. If a recurrence is created for Jan 31st on 2025, the recurring expense
// will be created for Feb 28th, March 28, etc. until it is cancelled or fixed
function calculateNextDate(
  recurrenceRule: RecurrenceRule,
  priorDateToNextRecurrence: Date,
): Date {
  const nextDate = new Date(priorDateToNextRecurrence)
  switch (recurrenceRule) {
    case 'DAILY':
      nextDate.setUTCDate(nextDate.getUTCDate() + 1)
      break
    case 'WEEKLY':
      nextDate.setUTCDate(nextDate.getUTCDate() + 7)
      break
    case 'MONTHLY':
      const nextYear = nextDate.getUTCFullYear()
      const nextMonth = nextDate.getUTCMonth() + 1
      let nextDay = nextDate.getUTCDate()

      // Reduce the next day until it is within the direct next month
      while (!isDateInNextMonth(nextYear, nextMonth, nextDay)) {
        nextDay -= 1
      }
      nextDate.setUTCMonth(nextMonth, nextDay)
      break
  }

  return nextDate
}

function isDateInNextMonth(
  utcYear: number,
  utcMonth: number,
  utcDate: number,
): Boolean {
  const testDate = new Date(Date.UTC(utcYear, utcMonth, utcDate))

  // We're not concerned if the year or month changes. We only want to make sure that the date is our target date
  if (testDate.getUTCDate() !== utcDate) {
    return false
  }

  return true
}
