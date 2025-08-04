// @ts-nocheck
import { randomId } from '@/lib/api'
import { supabaseAdmin } from '@/lib/supabase'
import { Client } from 'pg'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

async function main() {
  withClient(async (client) => {
    // console.log('Deleting all groups…')
    // await supabaseAdmin.from('Group').delete().neq('id', '')

    const { rows: groupRows } = await client.query<{
      id: string
      name: string
      currency: string
      created_at: Date
    }>('select id, name, currency, created_at from groups')

    const { data: existingGroups } = await supabaseAdmin
      .from('Group')
      .select('id')

    const existingGroupIds = (existingGroups || []).map((group) => group.id)

    for (const groupRow of groupRows) {
      const participants: Array<{
        id: string
        name: string
        groupId: string
      }> = []
      const expenses: Array<{
        id: string
        amount: number
        groupId: string
        title: string
        categoryId: number
        expenseDate: string
        createdAt: string
        isReimbursement: boolean
        paidById: string
      }> = []
      const expenseParticipants: Array<{
        expenseId: string
        participantId: string
        shares: number
      }> = []
      const participantIdsMapping: Record<number, string> = {}
      const expenseIdsMapping: Record<number, string> = {}

      if (existingGroupIds.includes(groupRow.id)) {
        console.log(`Group ${groupRow.id} already exists, skipping.`)
        continue
      }

      const group = {
        id: groupRow.id,
        name: groupRow.name,
        currency: groupRow.currency,
        createdAt: groupRow.created_at.toISOString(),
      }

      const { rows: participantRows } = await client.query<{
        id: number
        created_at: Date
        name: string
      }>(
        'select id, created_at, name from participants where group_id = $1::text',
        [groupRow.id],
      )
      for (const participantRow of participantRows) {
        const id = randomId()
        participantIdsMapping[participantRow.id] = id
        participants.push({
          id,
          groupId: groupRow.id,
          name: participantRow.name,
        })
      }

      const { rows: expenseRows } = await client.query<{
        id: number
        created_at: Date
        description: string
        amount: number
        paid_by_participant_id: number
        is_reimbursement: boolean
      }>(
        'select id, created_at, description, amount, paid_by_participant_id, is_reimbursement from expenses where group_id = $1::text and deleted_at is null',
        [groupRow.id],
      )
      for (const expenseRow of expenseRows) {
        const id = randomId()
        expenseIdsMapping[expenseRow.id] = id
        expenses.push({
          id,
          amount: Math.round(expenseRow.amount * 100),
          groupId: groupRow.id,
          title: expenseRow.description,
          categoryId: 1,
          expenseDate: new Date(expenseRow.created_at.toDateString())
            .toISOString()
            .split('T')[0],
          createdAt: expenseRow.created_at.toISOString(),
          isReimbursement: expenseRow.is_reimbursement === true,
          paidById: participantIdsMapping[expenseRow.paid_by_participant_id],
        })
      }

      if (expenseRows.length > 0) {
        const { rows: expenseParticipantRows } = await client.query<{
          expense_id: number
          participant_id: number
        }>(
          'select expense_id, participant_id from expense_participants where expense_id = any($1::int[]);',
          [expenseRows.map((row) => row.id)],
        )
        for (const expenseParticipantRow of expenseParticipantRows) {
          expenseParticipants.push({
            expenseId: expenseIdsMapping[expenseParticipantRow.expense_id],
            participantId:
              participantIdsMapping[expenseParticipantRow.participant_id],
            shares: 1, // Default share value
          })
        }
      }

      console.log('Creating group:', group)
      await supabaseAdmin.from('Group').insert(group)
      console.log('Creating participants:', participants)
      if (participants.length > 0) {
        await supabaseAdmin.from('Participant').insert(participants)
      }
      console.log('Creating expenses:', expenses)
      if (expenses.length > 0) {
        await supabaseAdmin.from('Expense').insert(expenses)
      }
      console.log('Creating expenseParticipants:', expenseParticipants)
      if (expenseParticipants.length > 0) {
        await supabaseAdmin.from('ExpensePaidFor').insert(expenseParticipants)
      }
    }
  })
}

async function withClient(fn: (client: Client) => void | Promise<void>) {
  const client = new Client({
    connectionString: process.env.OLD_POSTGRES_URL,
    ssl: true,
  })
  await client.connect()
  console.log('Connected.')

  try {
    await fn(client)
  } finally {
    await client.end()
    console.log('Disconnected.')
  }
}

main().catch(console.error)
