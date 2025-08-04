// Test script to verify database operations work with the new schema
import { createGroup, getCategories, getGroup } from './src/lib/api.ts'

async function testDatabaseOperations() {
  console.log('🧪 Testing database operations...')

  try {
    // Test 1: Get categories
    console.log('\n1. Testing getCategories...')
    const categories = await getCategories()
    console.log(`✅ Categories loaded: ${categories.length} categories`)
    console.log(
      'Categories:',
      categories.slice(0, 3).map((c) => c.name),
    )

    // Test 2: Create a test group
    console.log('\n2. Testing createGroup...')
    const testGroupData = {
      name: 'Test Group',
      information: 'This is a test group',
      currency: 'USD',
      participants: [{ name: 'Alice' }, { name: 'Bob' }],
    }

    const newGroup = await createGroup(testGroupData)
    console.log(`✅ Group created: ${newGroup.name} (ID: ${newGroup.id})`)
    console.log(`✅ Participants: ${newGroup.participants.length}`)

    // Test 3: Get the created group
    console.log('\n3. Testing getGroup...')
    const retrievedGroup = await getGroup(newGroup.id)
    console.log(`✅ Group retrieved: ${retrievedGroup.name}`)
    console.log(`✅ Participants: ${retrievedGroup.participants.length}`)

    console.log('\n🎉 All database operations working correctly!')
  } catch (error) {
    console.error('❌ Database operation failed:', error.message)
    if (error.code) {
      console.error('Error code:', error.code)
    }
    if (error.details) {
      console.error('Error details:', error.details)
    }
  }
}

testDatabaseOperations()
