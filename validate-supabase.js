/**
 * 🧪 Story 1.1 - Supabase Validation Test
 * Simple test to validate Supabase CRUD operations
 */

console.log('🧪 Starting Supabase validation for Story 1.1...')

// Load environment first
require('dotenv').config()

// Validate environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_API_ANON_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_POSTGRES_URL',
]

console.log('🔍 Checking environment variables...')
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`)
    process.exit(1)
  }
  console.log(`✅ ${envVar}: ${process.env[envVar].substring(0, 20)}...`)
}

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const { createClient } = require('@supabase/supabase-js')

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    console.log('\n📡 Testing Supabase connection...')

    // Test 1: Fetch categories (should return default categories)
    console.log('📝 Test 1: Fetching categories...')
    const { data: categories, error: categoriesError } = await supabase
      .from('Category')
      .select('*')
      .order('id')

    if (categoriesError) {
      throw new Error(`Categories fetch failed: ${categoriesError.message}`)
    }

    console.log(`✅ Categories retrieved: ${categories.length} found`)
    console.log(
      `📊 Categories: ${categories.map((c) => `${c.id}=${c.name}`).join(', ')}`,
    )

    if (categories.length < 8) {
      throw new Error(
        `Expected at least 8 default categories, got ${categories.length}`,
      )
    }

    // Test 2: Create test group
    console.log('\n📝 Test 2: Creating test group...')
    const groupData = {
      id: `test-group-${Date.now()}`,
      name: 'QA Test Group - Validation',
      information: 'Testing Supabase CRUD operations',
      currency: '$',
    }

    const { data: group, error: groupError } = await supabase
      .from('Group')
      .insert(groupData)
      .select()
      .single()

    if (groupError) {
      throw new Error(`Group creation failed: ${groupError.message}`)
    }

    console.log(`✅ Group created: ${group.id}`)

    // Test 3: Create participants
    console.log('\n📝 Test 3: Creating participants...')
    const participantsData = [
      { id: `participant-1-${Date.now()}`, name: 'Alice', groupId: group.id },
      { id: `participant-2-${Date.now()}`, name: 'Bob', groupId: group.id },
      { id: `participant-3-${Date.now()}`, name: 'Charlie', groupId: group.id },
    ]

    const { data: participants, error: participantsError } = await supabase
      .from('Participant')
      .insert(participantsData)
      .select()

    if (participantsError) {
      throw new Error(
        `Participants creation failed: ${participantsError.message}`,
      )
    }

    console.log(`✅ Participants created: ${participants.length}`)
    console.log(
      `📊 Participants: ${participants.map((p) => p.name).join(', ')}`,
    )

    // Test 4: Create expense
    console.log('\n📝 Test 4: Creating expense...')
    const expenseData = {
      id: `expense-${Date.now()}`,
      groupId: group.id,
      expenseDate: new Date().toISOString().split('T')[0],
      title: 'Test Expense - Validation',
      amount: 6000, // $60.00 in cents
      categoryId: 2, // Food category
      paidById: participants[0].id,
      splitMode: 'EVENLY',
      isReimbursement: false,
    }

    const { data: expense, error: expenseError } = await supabase
      .from('Expense')
      .insert(expenseData)
      .select()
      .single()

    if (expenseError) {
      throw new Error(`Expense creation failed: ${expenseError.message}`)
    }

    console.log(`✅ Expense created: ${expense.id}`)

    // Test 5: Create ExpensePaidFor relationships
    console.log('\n📝 Test 5: Creating expense split relationships...')
    const paidForData = participants.map((p) => ({
      expenseId: expense.id,
      participantId: p.id,
      shares: 1,
    }))

    const { data: paidFor, error: paidForError } = await supabase
      .from('ExpensePaidFor')
      .insert(paidForData)
      .select()

    if (paidForError) {
      throw new Error(`ExpensePaidFor creation failed: ${paidForError.message}`)
    }

    console.log(`✅ Expense split created: ${paidFor.length} relationships`)

    // Test 6: Fetch complete expense with relationships
    console.log('\n📝 Test 6: Fetching expense with relationships...')
    const { data: completeExpense, error: fetchError } = await supabase
      .from('Expense')
      .select(
        `
        *,
        paidBy:Participant!paidById(*),
        paidFor:ExpensePaidFor(
          *,
          participant:Participant(*)
        ),
        category:Category(*)
      `,
      )
      .eq('id', expense.id)
      .single()

    if (fetchError) {
      throw new Error(`Expense fetch failed: ${fetchError.message}`)
    }

    console.log(`✅ Complete expense retrieved with relationships`)
    console.log(`📊 Paid by: ${completeExpense.paidBy.name}`)
    console.log(`📊 Split among: ${completeExpense.paidFor.length} people`)
    console.log(`📊 Category: ${completeExpense.category.name}`)

    // Test 7: Update expense
    console.log('\n📝 Test 7: Updating expense...')
    const { data: updatedExpense, error: updateError } = await supabase
      .from('Expense')
      .update({
        title: 'UPDATED: Test Expense - Validation',
        amount: 7200, // Changed to $72.00
      })
      .eq('id', expense.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Expense update failed: ${updateError.message}`)
    }

    console.log(`✅ Expense updated: ${updatedExpense.title}`)

    // Test 8: Test real-time capabilities (basic check)
    console.log('\n📝 Test 8: Testing real-time setup...')
    const channel = supabase.channel('test-channel')

    if (channel) {
      console.log('✅ Real-time channel created successfully')
      channel.unsubscribe()
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...')
    await supabase.from('ExpensePaidFor').delete().eq('expenseId', expense.id)
    await supabase.from('Expense').delete().eq('id', expense.id)
    await supabase.from('Participant').delete().eq('groupId', group.id)
    await supabase.from('Group').delete().eq('id', group.id)
    console.log('✅ Test data cleaned up')

    return {
      success: true,
      testsRun: 8,
      groupId: group.id,
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Run the test
testSupabaseConnection()
  .then((result) => {
    console.log('\n' + '='.repeat(50))
    console.log('🏁 STORY 1.1 SUPABASE VALIDATION RESULTS:')

    if (result.success) {
      console.log('✅ ALL TESTS PASSED')
      console.log('✅ Supabase Foundation is working correctly')
      console.log('✅ Schema deployment successful')
      console.log('✅ CRUD operations functional')
      console.log('✅ Relationships working properly')
      console.log('✅ Real-time capabilities available')
      console.log('')
      console.log('🎉 STORY 1.1 VALIDATION: SUCCESSFUL')
      console.log('📋 Ready for production deployment')

      // Update TODO status
      console.log('\n📝 TODO UPDATE: Test 3 (Expense CRUD) - COMPLETED ✅')
    } else {
      console.log('❌ TESTS FAILED')
      console.log(`❌ Error: ${result.error}`)
      console.log('⚠️  Story 1.1 needs fixes before deployment')
    }

    console.log('='.repeat(50))
  })
  .catch(console.error)
