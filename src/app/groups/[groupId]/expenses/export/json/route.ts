import { supabaseAdmin } from '@/lib/supabase'
import contentDisposition from 'content-disposition'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params: { groupId } }: { params: { groupId: string } },
) {
  // Get group with participants and expenses
  const { data: group } = await supabaseAdmin
    .from('Group')
    .select(
      `
      id,
      name,
      currency,
      participants:Participant(id, name)
    `,
    )
    .eq('id', groupId)
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Invalid group ID' }, { status: 404 })
  }

  // Get expenses with related data, ordered by date and creation time
  const { data: expenses } = await supabaseAdmin
    .from('Expense')
    .select(
      `
      createdAt,
      expenseDate,
      title,
      category:Category(grouping, name),
      amount,
      paidById,
      paidFor:ExpensePaidFor(participantId, shares),
      isReimbursement,
      splitMode,
      recurrenceRule
    `,
    )
    .eq('groupId', groupId)
    .order('expenseDate', { ascending: true })
    .order('createdAt', { ascending: true })

  if (!expenses) {
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 },
    )
  }

  const groupWithExpenses = {
    ...group,
    expenses: expenses.map((expense) => ({
      ...expense,
      // Normalize category data for consistency
      category: Array.isArray(expense.category)
        ? expense.category[0]
        : expense.category,
    })),
  }

  const date = new Date().toISOString().split('T')[0]
  const filename = `Spliit Export - ${date}`
  return NextResponse.json(groupWithExpenses, {
    headers: {
      'content-type': 'application/json',
      'content-disposition': contentDisposition(`${filename}.json`),
    },
  })
}
