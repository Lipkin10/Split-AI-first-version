# Manual Testing Checklist - Story 1.5: Balance and Reimbursement Queries

**Status:** Ready for testing once server connectivity issues are resolved

## Prerequisites

- ✅ Environment variables configured (.env file)
- ✅ Supabase database accessible
- ✅ OpenAI API key configured
- ✅ Conversational features enabled (`NEXT_PUBLIC_ENABLE_CONVERSATIONAL_EXPENSE=true`)
- ⚠️ **Server connectivity**: Requires resolution of localhost connection issues

## Test Environment Setup

1. **Start development server**: `npm run dev`
2. **Access application**: http://localhost:3000 (or alternative port)
3. **Create test data**:
   - Create group: "Test Group"
   - Add participants: John, Alice, Bob
   - Add sample expenses to generate balances

## Core UX Validation Tests

### 1. Accuracy Requirement Tests

**Test 1.1: Positive Balance (They owe you)**
```
Input: "How much does John owe me?"
Expected: 
- Shows John's exact balance amount
- Displays "owes you" language for positive balance
- Shows paid/paidFor breakdown
- Amounts are penny-perfect accurate
```

**Test 1.2: Negative Balance (You owe them)**
```
Input: "What's my balance with Alice?"
Expected:
- Shows accurate negative balance
- Displays "you owe" language 
- Correct currency formatting
```

**Test 1.3: Zero Balance**
```
Input: "Did Bob pay me back?" (when settled)
Expected:
- Shows "all settled" status
- No outstanding amounts displayed
```

### 2. Educational Guidance Tests

**Test 2.1: Unknown Participant**
```
Input: "How much does Mike owe me?"
Expected:
- Error message: "I don't recognize 'Mike' in this group"
- Lists available participants: "John, Alice, Bob"
- Asks clarification: "Who did you mean?"
```

**Test 2.2: Unclear Query**
```
Input: "money stuff"
Expected:
- Educational guidance with example patterns
- Clickable example buttons
- Clear instructions on how to ask balance questions
```

**Test 2.3: Missing Target User**
```
Input: "How much do I owe?"
Expected:
- Clarification request
- Participant selection buttons
- Educational guidance
```

### 3. Conversational Flow Tests

**Test 3.1: Follow-up Actions**
```
1. Input: "How much does John owe me?"
2. Click "View All Balances" button
3. Click "Alice" participant button
Expected:
- Natural conversation flow
- Context maintained between queries
- Buttons trigger appropriate follow-up questions
```

**Test 3.2: Mixed Conversation Topics**
```
1. Input: "Show me all balances"
2. Click "How should we settle up?" button
3. Input: "What about John specifically?"
Expected:
- Smooth transitions between balance and settlement topics
- 30-minute conversation context maintained
- Natural language understanding across topics
```

### 4. Settlement & Fallback Tests

**Test 4.1: Settlement Suggestions**
```
Input: "How should we settle up?"
Expected:
- Reimbursement recommendations
- Educational optimization tips
- "Traditional View" fallback button
```

**Test 4.2: Fallback Mechanism**
```
1. Access settlement suggestions
2. Click "Traditional View" button
Expected:
- Redirects to standard balance/reimbursement pages
- Maintains all existing functionality
- No data loss or errors
```

### 5. Loading States & Responsiveness

**Test 5.1: Loading Animation**
```
During any balance query processing:
Expected:
- "Thinking" or loading animation appears
- No hanging states
- Graceful loading experience
```

**Test 5.2: Mobile Responsiveness**
```
Test on mobile/tablet viewport:
Expected:
- Chat interface remains usable
- Touch interactions work
- Text remains readable
- Buttons are appropriately sized
```

## Success Criteria

**✅ All tests passing indicates:**
- Accuracy requirement satisfied (penny-perfect balances)
- Educational guidance functional (users taught proper interaction)
- Conversational flow working (30-minute context, natural follow-ups)
- Loading states implemented (professional UX)
- Fallback mechanisms functional (graceful error handling)

## Known Issues

**Server Connectivity**: Development server connectivity issues identified
- Server starts successfully but refuses browser connections
- Requires investigation of macOS firewall/port binding
- Does not impact production deployment viability

## Production Testing Alternative

If local server issues persist, consider production deployment testing:
- Deploy to Vercel/Netlify with Supabase configuration
- Test conversational features in live environment
- Validate all UX requirements in production context