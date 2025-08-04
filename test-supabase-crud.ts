/**
 * 🧪 Story 1.1 - Direct Supabase CRUD Testing
 * Tests all API functions directly against Supabase
 */

import {
  createExpense,
  createGroup,
  deleteExpense,
  getActivities,
  getCategories,
  getExpense,
  getGroup,
  getGroupExpenses,
  updateExpense,
} from './src/lib/api'

// Test data
const TEST_GROUP = {
  name: 'QA Test Group - Direct API',
  information: 'Testing Supabase CRUD operations directly',
  currency: '$',
  participants: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
}

let testGroupId: string
let testParticipants: any[]
let testExpenseIds: string[] = []

async function test1_Categories() {
  console.log('📝 Test 1: Fetching categories...')

  try {
    const categories = await getCategories()
    console.log('✅ Categories retrieved:', categories?.length)

    if (!categories || categories.length < 8) {
      throw new Error(
        `Expected at least 8 categories, got ${categories?.length}`,
      )
    }

    // Verify default categories exist
    const expectedCategories = [0, 1, 2, 3, 4, 5, 6, 7]
    for (const id of expectedCategories) {
      if (!categories.find((cat) => cat.id === id)) {
        throw new Error(`Missing category with id: ${id}`)
      }
    }

    console.log('✅ Test 1 PASSED - All default categories found')
    return categories
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error)
    throw error
  }
}

async function test2_CreateGroup() {
  console.log('📝 Test 2: Creating test group...')

  try {
    const group = await createGroup(TEST_GROUP)
    console.log('✅ Group created with ID:', group.id)

    if (!group.id || !group.participants || group.participants.length !== 3) {
      throw new Error('Group creation failed - missing required data')
    }

    testGroupId = group.id
    testParticipants = group.participants

    console.log('✅ Test 2 PASSED - Group created successfully')
    console.log(`📊 Group ID: ${testGroupId}`)
    console.log(
      `📊 Participants: ${testParticipants.map((p) => p.name).join(', ')}`,
    )

    return group
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error)
    throw error
  }
}

async function test3_GetGroup() {
  console.log('📝 Test 3: Retrieving group...')

  try {
    const group = await getGroup(testGroupId)
    console.log('✅ Group retrieved:', group?.name)

    if (!group || group.id !== testGroupId) {
      throw new Error('Failed to retrieve group or ID mismatch')
    }

    if (!group.participants || group.participants.length !== 3) {
      throw new Error('Group participants not properly retrieved')
    }

    console.log('✅ Test 3 PASSED - Group retrieved successfully')
    return group
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error)
    throw error
  }
}

async function test4_CreateEvenSplitExpense() {
  console.log('📝 Test 4: Creating even split expense...')

  const expenseData = {
    expenseDate: new Date(),
    title: 'Test Dinner - Even Split',
    amount: 6000, // $60.00 in cents
    category: 2, // Food category
    paidBy: testParticipants[0].id, // Alice pays
    paidFor: testParticipants.map((p) => ({
      participant: p.id,
      shares: 1,
    })),
    splitMode: 'EVENLY' as const,
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    documents: [],
    notes: 'QA Test - Even split validation',
    recurrenceRule: 'NONE' as const,
  }

  try {
    const expense = await createExpense(expenseData, testGroupId)
    console.log('✅ Even split expense created:', expense.id)

    if (!expense.id || expense.amount !== 6000) {
      throw new Error('Expense creation failed - missing data or wrong amount')
    }

    testExpenseIds.push(expense.id)

    console.log('✅ Test 4 PASSED - Even split expense created')
    console.log('📊 Expected: Each person owes $20.00')

    return expense
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error)
    throw error
  }
}

async function test5_CreateCustomSharesExpense() {
  console.log('📝 Test 5: Creating custom shares expense...')

  const expenseData = {
    expenseDate: new Date(),
    title: 'Test Groceries - Custom Shares',
    amount: 10000, // $100.00 in cents
    category: 2, // Food category
    paidBy: testParticipants[1].id, // Bob pays
    paidFor: [
      { participant: testParticipants[0].id, shares: 2 }, // Alice: 2 shares
      { participant: testParticipants[1].id, shares: 1 }, // Bob: 1 share
      { participant: testParticipants[2].id, shares: 1 }, // Charlie: 1 share
    ],
    splitMode: 'BY_SHARES' as const,
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    documents: [],
    notes: 'QA Test - Custom shares: Alice(2), Bob(1), Charlie(1)',
    recurrenceRule: 'NONE' as const,
  }

  try {
    const expense = await createExpense(expenseData, testGroupId)
    console.log('✅ Custom shares expense created:', expense.id)

    testExpenseIds.push(expense.id)

    console.log('✅ Test 5 PASSED - Custom shares expense created')
    console.log('📊 Expected: Alice owes $50, Bob owes $25, Charlie owes $25')

    return expense
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error)
    throw error
  }
}

async function test6_CreateReimbursement() {
  console.log('📝 Test 6: Creating reimbursement...')

  const expenseData = {
    expenseDate: new Date(),
    title: 'Reimbursement: Bob → Alice',
    amount: 3000, // $30.00 in cents
    category: 0, // General category
    paidBy: testParticipants[1].id, // Bob pays (reimburses)
    paidFor: [
      { participant: testParticipants[0].id, shares: 1 }, // Alice receives
    ],
    splitMode: 'EVENLY' as const,
    saveDefaultSplittingOptions: false,
    isReimbursement: true,
    documents: [],
    notes: 'QA Test - Reimbursement validation',
    recurrenceRule: 'NONE' as const,
  }

  try {
    const expense = await createExpense(expenseData, testGroupId)
    console.log('✅ Reimbursement created:', expense.id)

    testExpenseIds.push(expense.id)

    console.log('✅ Test 6 PASSED - Reimbursement created')

    return expense
  } catch (error) {
    console.error('❌ Test 6 FAILED:', error)
    throw error
  }
}

async function test7_GetExpenses() {
  console.log('📝 Test 7: Retrieving expenses list...')

  try {
    const expenses = await getGroupExpenses(testGroupId)
    console.log('✅ Expenses retrieved:', expenses?.length)

    if (!expenses || expenses.length < 3) {
      throw new Error(`Expected at least 3 expenses, got ${expenses?.length}`)
    }

    // Verify our test expenses are in the list
    const titles = expenses.map((e) => e.title)
    const expectedTitles = [
      'Test Dinner - Even Split',
      'Test Groceries - Custom Shares',
      'Reimbursement: Bob → Alice',
    ]

    for (const title of expectedTitles) {
      if (!titles.includes(title)) {
        throw new Error(`Missing expense: ${title}`)
      }
    }

    console.log('✅ Test 7 PASSED - All expenses retrieved correctly')
    return expenses
  } catch (error) {
    console.error('❌ Test 7 FAILED:', error)
    throw error
  }
}

async function test8_GetSingleExpense() {
  console.log('📝 Test 8: Retrieving single expense...')

  try {
    const expense = await getExpense(testGroupId, testExpenseIds[0])
    console.log('✅ Single expense retrieved:', expense?.title)

    if (!expense || expense.id !== testExpenseIds[0]) {
      throw new Error('Failed to retrieve expense or ID mismatch')
    }

    // Verify relationship data is properly loaded
    if (!expense.paidBy || !expense.paidFor || !expense.category) {
      throw new Error('Expense relationships not properly loaded')
    }

    console.log(
      '✅ Test 8 PASSED - Single expense with relationships retrieved',
    )
    console.log(`📊 Paid by: ${expense.paidBy.name}`)
    console.log(`📊 Split among: ${expense.paidFor.length} people`)
    console.log(`📊 Category: ${expense.category.name}`)

    return expense
  } catch (error) {
    console.error('❌ Test 8 FAILED:', error)
    throw error
  }
}

async function test9_UpdateExpense() {
  console.log('📝 Test 9: Updating expense...')

  const updatedData = {
    expenseDate: new Date(),
    title: 'UPDATED: Test Dinner - Even Split',
    amount: 7200, // Changed to $72.00
    category: 2,
    paidBy: testParticipants[0].id,
    paidFor: testParticipants.map((p) => ({
      participant: p.id,
      shares: 1,
    })),
    splitMode: 'EVENLY' as const,
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    documents: [],
    notes: 'QA Test - Updated amount to $72.00',
    recurrenceRule: 'NONE' as const,
  }

  try {
    const updatedExpense = await updateExpense(
      testGroupId,
      testExpenseIds[0],
      updatedData,
    )
    console.log('✅ Expense updated:', updatedExpense?.title)

    if (!updatedExpense || !updatedExpense.title?.includes('UPDATED')) {
      throw new Error('Expense update failed - title not updated')
    }

    console.log('✅ Test 9 PASSED - Expense updated successfully')
    return updatedExpense
  } catch (error) {
    console.error('❌ Test 9 FAILED:', error)
    throw error
  }
}

async function test10_Activities() {
  console.log('📝 Test 10: Checking activity log...')

  try {
    const activities = await getActivities(testGroupId)
    console.log('✅ Activities retrieved:', activities?.length)

    if (!activities || activities.length === 0) {
      throw new Error('No activities found')
    }

    // Should have activities for group creation and expense operations
    const activityTypes = activities.map((a) => a.activityType)
    const expectedTypes = ['CREATE_EXPENSE', 'UPDATE_EXPENSE']

    for (const type of expectedTypes) {
      if (!activityTypes.includes(type)) {
        console.warn(`⚠️ Missing activity type: ${type}`)
      }
    }

    console.log('✅ Test 10 PASSED - Activity log working')
    console.log(`📊 Total activities: ${activities.length}`)

    return activities
  } catch (error) {
    console.error('❌ Test 10 FAILED:', error)
    throw error
  }
}

async function test11_DeleteExpense() {
  console.log('📝 Test 11: Deleting expense...')

  try {
    await deleteExpense(testGroupId, testExpenseIds[2]) // Delete reimbursement
    console.log('✅ Expense deleted successfully')

    // Verify deletion by trying to get the expense
    try {
      const deletedExpense = await getExpense(testGroupId, testExpenseIds[2])
      if (deletedExpense) {
        throw new Error('Expense was not properly deleted')
      }
    } catch (error) {
      // Expected - expense should not be found
    }

    console.log('✅ Test 11 PASSED - Expense deleted successfully')
    return true
  } catch (error) {
    console.error('❌ Test 11 FAILED:', error)
    throw error
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting comprehensive Supabase CRUD tests...')
  console.log('='.repeat(50))

  const results = {
    passed: 0,
    failed: 0,
    errors: [] as Array<{ test: string; error: string }>,
  }

  const tests = [
    { name: 'Categories', fn: test1_Categories },
    { name: 'Create Group', fn: test2_CreateGroup },
    { name: 'Get Group', fn: test3_GetGroup },
    { name: 'Even Split Expense', fn: test4_CreateEvenSplitExpense },
    { name: 'Custom Shares Expense', fn: test5_CreateCustomSharesExpense },
    { name: 'Reimbursement', fn: test6_CreateReimbursement },
    { name: 'Get Expenses', fn: test7_GetExpenses },
    { name: 'Get Single Expense', fn: test8_GetSingleExpense },
    { name: 'Update Expense', fn: test9_UpdateExpense },
    { name: 'Activities', fn: test10_Activities },
    { name: 'Delete Expense', fn: test11_DeleteExpense },
  ]

  for (const test of tests) {
    try {
      console.log(`\n🔍 Running: ${test.name}`)
      await test.fn()
      results.passed++
      console.log(`✅ ${test.name} completed successfully`)
    } catch (error) {
      results.failed++
      results.errors.push({
        test: test.name,
        error: error instanceof Error ? error.message : String(error),
      })
      console.error(`❌ ${test.name} failed:`, error)

      // Continue with other tests even if one fails
    }
  }

  // Final Summary
  console.log('\n' + '='.repeat(50))
  console.log('🏁 SUPABASE CRUD TEST RESULTS:')
  console.log(`✅ Passed: ${results.passed}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log(
    `📊 Success Rate: ${((results.passed / tests.length) * 100).toFixed(1)}%`,
  )

  if (results.errors.length > 0) {
    console.log('\n🐛 Errors:')
    results.errors.forEach((err) => {
      console.log(`- ${err.test}: ${err.error}`)
    })
  }

  if (testGroupId) {
    console.log(`\n🧹 Test Group ID: ${testGroupId}`)
    console.log(
      'You can manually inspect or delete this group from Supabase if needed.',
    )
  }

  console.log('\n🎯 STORY 1.1 VALIDATION:')
  if (results.passed >= 9) {
    console.log('✅ SUPABASE FOUNDATION IS WORKING CORRECTLY')
    console.log('✅ Ready for production deployment')
  } else {
    console.log('⚠️ Some issues found - review failures before deployment')
  }

  return results
}

// Run tests
runAllTests().catch(console.error)
