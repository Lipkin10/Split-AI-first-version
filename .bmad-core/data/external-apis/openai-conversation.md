# OpenAI Conversation API Documentation

## Overview

This document describes the OpenAI integration patterns for conversational AI features in the Spliit application.

## Authentication

- **API Key**: Uses existing `OPENAI_API_KEY` environment variable
- **Model**: GPT-4 Turbo for conversation parsing (requires higher accuracy)
- **Temperature**: 0.2 (lower for consistent intent classification)

## Core Functions

### `parseConversationIntent(message, language, groupContext)`

Analyzes user messages and classifies intent for conversational interactions.

**Parameters:**

- `message` (string): User's natural language input
- `language` (string, optional): Language code (defaults to 'en-US')
- `groupContext` (object, optional): Current group participants and currency

**Returns:**

```typescript
ConversationParseResult {
  intent: ConversationIntent
  confidence: number (0.0-1.0)
  extractedData: IntentData | null
  clarificationNeeded?: string
}
```

**Supported Intents:**

1. `expense_creation` - Adding new expenses
2. `balance_query` - Checking balances and debts
3. `group_management` - Group creation/modification
4. `expense_history` - Viewing past expenses
5. `reimbursement_status` - Payment status checks
6. `unclear` - Ambiguous requests requiring clarification

## Multi-Language Support

- **Supported Languages**: All 15 languages from the existing i18n system
- **Prompt Templates**: Language-specific prompts in `MULTI_LANGUAGE_PROMPTS`
- **Fallback**: Defaults to English if language not supported

## Error Handling

- **Network Failures**: Returns 'unclear' intent with generic clarification message
- **Invalid JSON**: Graceful fallback to unclear intent
- **Timeout**: 3-second limit enforced at tRPC layer
- **Rate Limiting**: Inherits OpenAI client rate limiting

## Integration Patterns

### With Existing API Functions

All conversation parsing results should be validated and processed through existing API functions:

- Expense creation → Use existing `createExpense` from `src/lib/api.ts`
- Balance queries → Use existing `getBalances` functions
- Group management → Use existing group API functions

### With tRPC

- New conversation router at `src/trpc/routers/ai/conversation.ts`
- Follows existing tRPC patterns for validation and error handling
- Integrates with existing business logic through API layer

## Cost Optimization

- **Model Selection**: GPT-4 Turbo for accuracy-critical conversation parsing
- **Token Limits**: 500 max tokens for responses to control costs
- **Caching**: Consider implementing for common conversation patterns
- **Fallback**: Graceful degradation when API unavailable

## Security Considerations

- **Input Validation**: All extracted data must be validated through existing schemas
- **Rate Limiting**: Implement user-based rate limiting for AI calls
- **Data Privacy**: No conversation content stored, only processing results
- **API Key Protection**: Uses existing secure environment variable patterns

## Performance Requirements

- **Response Time**: Maximum 3 seconds (enforced at tRPC layer)
- **Availability**: Graceful fallback when OpenAI service unavailable
- **Concurrent Requests**: Inherits OpenAI client connection pooling

## Testing Patterns

- **Mock Responses**: Use predefined responses for unit testing
- **Multi-Language Testing**: Test conversation parsing across all supported languages
- **Error Scenarios**: Test API failures, timeouts, and invalid responses
- **Integration Testing**: Validate end-to-end conversation → action flows

## Usage Examples

### Basic Intent Classification

```javascript
const result = await parseConversationIntent(
  'I spent $25 on lunch today',
  'en-US',
  { participants: [{ name: 'Alice' }, { name: 'Bob' }], currency: 'USD' },
)
// Result: { intent: "expense_creation", confidence: 0.95, extractedData: { amount: 2500, title: "lunch" } }
```

### Multi-Language Support

```javascript
const result = await parseConversationIntent(
  'He gastado 25€ en almuerzo hoy',
  'es',
  { participants: [{ name: 'Alice' }, { name: 'Bob' }], currency: 'EUR' },
)
// Handles Spanish input with Euro currency context
```

### Ambiguous Input Handling

```javascript
const result = await parseConversationIntent('help me', 'en-US')
// Result: { intent: "unclear", confidence: 0.3, clarificationNeeded: "What would you like help with?" }
```
