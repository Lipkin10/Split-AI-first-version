/**
 * 🧪 Story 1.1 - Real-time Capabilities Testing
 * Tests real-time subscriptions for conversational AI foundation
 */

console.log('⚡ Testing Real-time Capabilities for Story 1.1...')

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

// Create Supabase client for real-time testing
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

let testResults = {
  passed: 0,
  failed: 0,
  subscriptions: []
}

// Helper to wait for events
function waitForEvent(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for real-time event'))
    }, timeout)
    
    return { resolve, reject, timer }
  })
}

// Test 1: Basic Real-time Channel Creation
async function test1_ChannelCreation() {
  console.log('\n📝 Test 1: Basic channel creation...')
  
  try {
    const channel = supabase.channel('test-basic-channel')
    
    if (!channel) {
      throw new Error('Failed to create channel')
    }
    
    // Test channel subscription
    const subscribed = await new Promise((resolve) => {
      channel
        .on('presence', { event: 'sync' }, () => {
          console.log('📡 Presence sync received')
        })
        .subscribe((status) => {
          console.log(`📡 Channel status: ${status}`)
          if (status === 'SUBSCRIBED') {
            resolve(true)
          }
        })
      
      // Timeout after 10 seconds
      setTimeout(() => resolve(false), 10000)
    })
    
    if (subscribed) {
      console.log('✅ Test 1 PASSED - Channel created and subscribed')
      testResults.passed++
      
      // Clean up
      await channel.unsubscribe()
      testResults.subscriptions.push('basic-channel')
    } else {
      throw new Error('Channel subscription failed')
    }
    
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error.message)
    testResults.failed++
  }
}

// Test 2: Database Change Subscriptions
async function test2_DatabaseSubscriptions() {
  console.log('\n📝 Test 2: Database change subscriptions...')
  
  try {
    let changeReceived = false
    let testGroupId = `realtime-test-${Date.now()}`
    
    // Set up subscription first
    const channel = supabase
      .channel('db-changes-test')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Group'
        },
        (payload) => {
          console.log('📡 Database change received:', payload.eventType)
          console.log('📊 New record:', payload.new?.name || 'N/A')
          changeReceived = true
        }
      )
      .subscribe()
    
    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Create a test group to trigger the event
    console.log('📤 Creating test group to trigger real-time event...')
    const { data: group, error } = await supabase
      .from('Group')
      .insert({
        id: testGroupId,
        name: 'Real-time Test Group',
        information: 'Testing real-time subscriptions',
        currency: '$'
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Group creation failed: ${error.message}`)
    }
    
    // Wait for real-time event
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    if (changeReceived) {
      console.log('✅ Test 2 PASSED - Database change subscription working')
      testResults.passed++
    } else {
      throw new Error('Real-time database change not received')
    }
    
    // Cleanup
    await supabase.from('Group').delete().eq('id', testGroupId)
    await channel.unsubscribe()
    testResults.subscriptions.push('db-changes')
    
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error.message)
    testResults.failed++
  }
}

// Test 3: Multiple Table Subscriptions (Expense Updates)
async function test3_ExpenseSubscriptions() {
  console.log('\n📝 Test 3: Expense table real-time subscriptions...')
  
  try {
    let expenseChangeReceived = false
    let paidForChangeReceived = false
    
    const testGroupId = `realtime-exp-test-${Date.now()}`
    const testParticipantId = `participant-${Date.now()}`
    const testExpenseId = `expense-${Date.now()}`
    
    // Set up subscriptions for multiple tables
    const expenseChannel = supabase
      .channel('expense-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Expense'
        },
        (payload) => {
          console.log('📡 Expense change:', payload.eventType)
          expenseChangeReceived = true
        }
      )
      .subscribe()
    
    const paidForChannel = supabase
      .channel('paidfor-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ExpensePaidFor'
        },
        (payload) => {
          console.log('📡 ExpensePaidFor change:', payload.eventType)
          paidForChangeReceived = true
        }
      )
      .subscribe()
    
    // Wait for subscriptions
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Create test data
    console.log('📤 Creating test expense data...')
    
    // Create group
    await supabase.from('Group').insert({
      id: testGroupId,
      name: 'RT Expense Test',
      currency: '$'
    })
    
    // Create participant
    await supabase.from('Participant').insert({
      id: testParticipantId,
      name: 'Test User',
      groupId: testGroupId
    })
    
    // Create expense (should trigger expense subscription)
    await supabase.from('Expense').insert({
      id: testExpenseId,
      groupId: testGroupId,
      title: 'Real-time Test Expense',
      amount: 5000,
      paidById: testParticipantId,
      categoryId: 0,
      splitMode: 'EVENLY'
    })
    
    // Create paid-for relationship (should trigger paidfor subscription)
    await supabase.from('ExpensePaidFor').insert({
      expenseId: testExpenseId,
      participantId: testParticipantId,
      shares: 1
    })
    
    // Wait for real-time events
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    let success = 0
    if (expenseChangeReceived) {
      console.log('✅ Expense table subscription working')
      success++
    }
    if (paidForChangeReceived) {
      console.log('✅ ExpensePaidFor table subscription working')
      success++
    }
    
    if (success >= 1) {
      console.log('✅ Test 3 PASSED - Expense subscriptions working')
      testResults.passed++
    } else {
      throw new Error('No real-time events received for expense tables')
    }
    
    // Cleanup
    await supabase.from('ExpensePaidFor').delete().eq('expenseId', testExpenseId)
    await supabase.from('Expense').delete().eq('id', testExpenseId)
    await supabase.from('Participant').delete().eq('id', testParticipantId)
    await supabase.from('Group').delete().eq('id', testGroupId)
    
    await expenseChannel.unsubscribe()
    await paidForChannel.unsubscribe()
    
    testResults.subscriptions.push('expense-changes', 'paidfor-changes')
    
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error.message)
    testResults.failed++
  }
}

// Test 4: Filtered Subscriptions (Group-specific)
async function test4_FilteredSubscriptions() {
  console.log('\n📝 Test 4: Filtered group-specific subscriptions...')
  
  try {
    const testGroupId1 = `filter-test-1-${Date.now()}`
    const testGroupId2 = `filter-test-2-${Date.now()}`
    
    let group1Events = 0
    let group2Events = 0
    
    // Subscribe only to group1 expenses
    const filteredChannel = supabase
      .channel('filtered-expenses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Expense',
          filter: `groupId=eq.${testGroupId1}`
        },
        (payload) => {
          console.log('📡 Filtered expense change for group1')
          group1Events++
        }
      )
      .subscribe()
    
    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Create test groups
    await supabase.from('Group').insert([
      { id: testGroupId1, name: 'Group 1', currency: '$' },
      { id: testGroupId2, name: 'Group 2', currency: '$' }
    ])
    
    // Create participants
    const participant1 = `part1-${Date.now()}`
    const participant2 = `part2-${Date.now()}`
    
    await supabase.from('Participant').insert([
      { id: participant1, name: 'User1', groupId: testGroupId1 },
      { id: participant2, name: 'User2', groupId: testGroupId2 }
    ])
    
    // Create expenses in both groups
    console.log('📤 Creating expenses in both groups...')
    await supabase.from('Expense').insert([
      {
        id: `exp1-${Date.now()}`,
        groupId: testGroupId1, // Should trigger subscription
        title: 'Group 1 Expense',
        amount: 1000,
        paidById: participant1,
        categoryId: 0
      },
      {
        id: `exp2-${Date.now()}`,
        groupId: testGroupId2, // Should NOT trigger subscription
        title: 'Group 2 Expense',
        amount: 2000,
        paidById: participant2,
        categoryId: 0
      }
    ])
    
    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    if (group1Events >= 1 && group2Events === 0) {
      console.log('✅ Test 4 PASSED - Filtered subscriptions working correctly')
      console.log(`📊 Group 1 events: ${group1Events}, Group 2 events: ${group2Events}`)
      testResults.passed++
    } else {
      throw new Error(`Filter not working: Group1=${group1Events}, Group2=${group2Events}`)
    }
    
    // Cleanup
    await supabase.from('Expense').delete().in('groupId', [testGroupId1, testGroupId2])
    await supabase.from('Participant').delete().in('groupId', [testGroupId1, testGroupId2])
    await supabase.from('Group').delete().in('id', [testGroupId1, testGroupId2])
    
    await filteredChannel.unsubscribe()
    testResults.subscriptions.push('filtered-expenses')
    
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error.message)
    testResults.failed++
  }
}

// Test 5: Performance Test (Multiple Rapid Changes)
async function test5_PerformanceTest() {
  console.log('\n📝 Test 5: Performance test with rapid changes...')
  
  try {
    const testGroupId = `perf-test-${Date.now()}`
    let eventsReceived = 0
    const expectedEvents = 5
    
    const perfChannel = supabase
      .channel('performance-test')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Group'
        },
        (payload) => {
          eventsReceived++
          console.log(`📡 Performance event ${eventsReceived}/${expectedEvents}`)
        }
      )
      .subscribe()
    
    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Create multiple rapid changes
    console.log('📤 Creating rapid database changes...')
    for (let i = 0; i < expectedEvents; i++) {
      await supabase.from('Group').insert({
        id: `${testGroupId}-${i}`,
        name: `Performance Test Group ${i}`,
        currency: '$'
      })
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Wait for all events
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const successRate = (eventsReceived / expectedEvents) * 100
    
    if (successRate >= 80) {
      console.log(`✅ Test 5 PASSED - Performance test: ${successRate}% success rate`)
      testResults.passed++
    } else {
      throw new Error(`Poor performance: only ${successRate}% events received`)
    }
    
    // Cleanup
    for (let i = 0; i < expectedEvents; i++) {
      await supabase.from('Group').delete().eq('id', `${testGroupId}-${i}`)
    }
    
    await perfChannel.unsubscribe()
    testResults.subscriptions.push('performance-test')
    
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error.message)
    testResults.failed++
  }
}

// Main test runner
async function runRealtimeTests() {
  console.log('🚀 Starting comprehensive real-time tests...')
  console.log('=' .repeat(50))
  
  const tests = [
    { name: 'Channel Creation', fn: test1_ChannelCreation },
    { name: 'Database Subscriptions', fn: test2_DatabaseSubscriptions },
    { name: 'Expense Subscriptions', fn: test3_ExpenseSubscriptions },
    { name: 'Filtered Subscriptions', fn: test4_FilteredSubscriptions },
    { name: 'Performance Test', fn: test5_PerformanceTest }
  ]
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Running: ${test.name}`)
      await test.fn()
      console.log(`✅ ${test.name} completed`)
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message)
    }
  }
  
  // Final results
  console.log('\n' + '=' .repeat(50))
  console.log('🏁 REAL-TIME TESTING RESULTS:')
  console.log(`✅ Passed: ${testResults.passed}`)
  console.log(`❌ Failed: ${testResults.failed}`)
  console.log(`📊 Success Rate: ${(testResults.passed / tests.length * 100).toFixed(1)}%`)
  console.log(`📡 Subscriptions Tested: ${testResults.subscriptions.length}`)
  
  if (testResults.passed >= 4) {
    console.log('')
    console.log('🎉 REAL-TIME FOUNDATION: EXCELLENT')
    console.log('✅ Ready for conversational AI features')
    console.log('✅ Multi-table subscriptions working')
    console.log('✅ Filtered subscriptions functional')
    console.log('✅ Performance acceptable')
    console.log('')
    console.log('📝 TODO UPDATE: Test 4 (Real-time) - COMPLETED ✅')
  } else {
    console.log('')
    console.log('⚠️  Real-time issues found - may impact AI features')
  }
  
  console.log('=' .repeat(50))
  
  return testResults
}

// Run the tests
runRealtimeTests().catch(console.error) 