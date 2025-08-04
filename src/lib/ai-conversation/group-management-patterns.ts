// ============================================================================
// GROUP MANAGEMENT CONVERSATION PATTERNS
// ============================================================================

import type { GroupManagementIntent } from './types'

// Pattern matching for group management requests
export const GROUP_MANAGEMENT_PATTERNS = {
  CREATE_GROUP: [
    /create\s+(?:a\s+)?(?:new\s+)?group\s+(?:for\s+|called\s+|named\s+)?(.+)/i,
    /start\s+(?:a\s+)?(?:new\s+)?group\s+(?:for\s+|called\s+|named\s+)?(.+)/i,
    /make\s+(?:a\s+)?(?:new\s+)?group\s+(?:for\s+|called\s+|named\s+)?(.+)/i,
    /new\s+group\s+(?:for\s+|called\s+|named\s+)?(.+)/i,
  ],
  
  ADD_PARTICIPANT: [
    /add\s+(.+?)\s+to\s+(?:the\s+)?group/i,
    /invite\s+(.+?)\s+to\s+(?:the\s+)?group/i,
    /include\s+(.+?)\s+in\s+(?:the\s+)?group/i,
    /add\s+(.+?)\s+to\s+(.+)/i, // add [names] to [group]
  ],
  
  REMOVE_PARTICIPANT: [
    /remove\s+(.+?)\s+from\s+(?:the\s+)?group/i,
    /kick\s+(.+?)\s+from\s+(?:the\s+)?group/i,
    /delete\s+(.+?)\s+from\s+(?:the\s+)?group/i,
    /remove\s+(.+?)\s+from\s+(.+)/i, // remove [name] from [group]
  ],
  
  SWITCH_GROUP: [
    /switch\s+to\s+(.+)/i,
    /go\s+to\s+(.+)/i,
    /open\s+(.+)/i,
    /show\s+(?:me\s+)?(.+)/i,
  ],
  
  LIST_GROUPS: [
    /show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?groups/i,
    /list\s+(?:all\s+)?(?:my\s+)?groups/i,
    /what\s+groups\s+(?:do\s+i\s+have|are\s+there)/i,
    /my\s+groups/i,
  ],
  
  UPDATE_GROUP: [
    /change\s+(?:group\s+)?currency\s+to\s+(.+)/i,
    /update\s+group\s+(?:information|settings)/i,
    /change\s+group\s+(?:name|title)\s+to\s+(.+)/i,
    /modify\s+group\s+(.+)/i,
  ],
} as const

// Fallback patterns for unclear requests
export const FALLBACK_RESPONSES = {
  UNCLEAR_INTENT: "I'm not sure what group operation you want. You can say things like: 'Create a new group for [event]' or 'Add [names] to the group'.",
  UNKNOWN_GROUP: (groupName: string, availableGroups: string[]) => 
    `I don't see a group called '${groupName}'. Your current groups are: ${availableGroups.join(', ')}`,
  AMBIGUOUS_ACTION: "Could you clarify if you want to create, update, or switch to a group?",
  NO_GROUPS: "You don't have any groups yet. You can create one by saying 'Create a new group for [event name]'.",
} as const

// Help commands
export const HELP_COMMANDS = {
  '/group-help': 'Show available group management patterns',
  '/show-groups': 'Direct link to groups list view',
  '/create-group': 'Quick shortcut to group creation',
} as const

// Supported conversational patterns
export const SUPPORTED_PATTERNS = [
  'Group Creation: "Create a new group for [event]" / "Start a group called [name]"',
  'Participant Management: "Add [names] to the group" / "Remove [name] from [group]"',
  'Group Navigation: "Switch to [group name]" / "Show me [group name]"',
  'Group Settings: "Change currency to euros" / "Update group information"',
  'Group Listing: "Show me all my groups" / "What groups do I have?"',
] as const

// Extract participant names from text
export function extractParticipantNames(text: string): string[] {
  // Split by common separators and clean up
  const separators = /[,;&]|\s+and\s+|\s+\+\s+/i
  const names = text.split(separators)
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .filter(name => !['to', 'from', 'the', 'group', 'and'].includes(name.toLowerCase()))
  
  return names
}

// Extract group name from text
export function extractGroupName(text: string): string {
  // Remove common prefixes/suffixes
  const cleaned = text
    .replace(/^(?:the\s+|our\s+|my\s+)/i, '')
    .replace(/\s+(?:group|trip|event)$/i, '')
    .trim()
  
  return cleaned
}

// Extract currency from text
export function extractCurrency(text: string): string | undefined {
  const currencyPatterns = {
    'USD': /\b(?:usd|dollars?|\$)\b/i,
    'EUR': /\b(?:eur|euros?|€)\b/i,
    'GBP': /\b(?:gbp|pounds?|sterling|£)\b/i,
    'CAD': /\b(?:cad|canadian\s+dollars?)\b/i,
    'AUD': /\b(?:aud|australian\s+dollars?)\b/i,
  }
  
  for (const [currency, pattern] of Object.entries(currencyPatterns)) {
    if (pattern.test(text)) {
      return currency
    }
  }
  
  return undefined
}

// Parse group management intent from natural language
export function parseGroupManagementIntent(text: string): GroupManagementIntent | null {
  const input = text.trim()
  
  // Check for group creation
  for (const pattern of GROUP_MANAGEMENT_PATTERNS.CREATE_GROUP) {
    const match = input.match(pattern)
    if (match) {
      const groupName = extractGroupName(match[1])
      return {
        action: 'create_group',
        groupName,
        confidence: 0.9,
        currency: extractCurrency(input),
      }
    }
  }
  
  // Check for participant addition
  for (const pattern of GROUP_MANAGEMENT_PATTERNS.ADD_PARTICIPANT) {
    const match = input.match(pattern)
    if (match) {
      const participants = extractParticipantNames(match[1])
      return {
        action: 'add_participant',
        participants,
        confidence: 0.85,
        groupName: match[2] ? extractGroupName(match[2]) : undefined,
      }
    }
  }
  
  // Check for participant removal
  for (const pattern of GROUP_MANAGEMENT_PATTERNS.REMOVE_PARTICIPANT) {
    const match = input.match(pattern)
    if (match) {
      const participants = extractParticipantNames(match[1])
      return {
        action: 'remove_participant',
        participants,
        confidence: 0.85,
        groupName: match[2] ? extractGroupName(match[2]) : undefined,
      }
    }
  }
  
  // Check for group switching
  for (const pattern of GROUP_MANAGEMENT_PATTERNS.SWITCH_GROUP) {
    const match = input.match(pattern)
    if (match) {
      const groupName = extractGroupName(match[1])
      return {
        action: 'switch_group',
        groupName,
        confidence: 0.8,
      }
    }
  }
  
  // Check for group listing
  for (const pattern of GROUP_MANAGEMENT_PATTERNS.LIST_GROUPS) {
    if (pattern.test(input)) {
      return {
        action: 'list_groups',
        confidence: 0.95,
      }
    }
  }
  
  // Check for group updates
  for (const pattern of GROUP_MANAGEMENT_PATTERNS.UPDATE_GROUP) {
    const match = input.match(pattern)
    if (match) {
      const currency = extractCurrency(input)
      return {
        action: 'update_group',
        confidence: 0.8,
        currency,
        settings: currency ? { currency } : undefined,
      }
    }
  }
  
  return null
}