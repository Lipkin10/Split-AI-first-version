import {
  AIServiceConfig,
  CURRENCY_PATTERNS,
  DEFAULT_AI_CONFIG,
  ExpenseParseResult,
  parseAmountWithCulturalContext,
} from '@/lib/ai-conversation'
import { env } from '@/lib/env'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

// ============================================================================
// ADVANCED EXPENSE PATTERN MATCHING
// ============================================================================

export interface ExpenseExtractionContext {
  participants: { name: string; id: string }[]
  currency: string
  categories: { id: number; name: string; grouping: string }[]
  language: string
}

export interface DateParseResult {
  date: Date
  confidence: number
  pattern: string
}

export interface AmountParseResult {
  amountInCents: number
  confidence: number
  currency?: string
  pattern: string
}

export interface ParticipantParseResult {
  participantIds: string[]
  missingNames: string[]
  confidence: number
  allParticipants: boolean
}

export interface CategoryParseResult {
  categoryId: number
  categoryName: string
  confidence: number
}

// ============================================================================
// ROBUST AMOUNT EXTRACTION WITH CULTURAL CONTEXT
// ============================================================================

export function extractAmountWithCulturalContext(
  text: string,
  language: string = 'en-US',
  currency: string = 'USD',
): AmountParseResult[] {
  const patterns =
    CURRENCY_PATTERNS[language as keyof typeof CURRENCY_PATTERNS] ||
    CURRENCY_PATTERNS['en-US']
  const results: AmountParseResult[] = []

  // Enhanced regex patterns for different languages and currencies
  const amountPatterns = [
    // Standard currency symbol patterns ($ € £ ¥ ₹ ₽ ₴ ₺ R$ zł lei ₸)
    /([€£¥₹₽₴₺$])\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g,
    // Reverse patterns (123.45$, 45,67€)
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*([€£¥₹₽₴₺$])/g,
    // Currency code patterns (123 USD, 45 EUR)
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(USD|EUR|GBP|JPY|CNY|TWD|PLN|RUB|UAH|RON|TRY|BRL|CAD|AUD|INR|KRW)/gi,
    // Reverse currency code (USD 123, EUR 45)
    /(USD|EUR|GBP|JPY|CNY|TWD|PLN|RUB|UAH|RON|TRY|BRL|CAD|AUD|INR|KRW)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
    // Language-specific patterns
    ...getLanguageSpecificAmountPatterns(language),
    // Fallback numeric patterns
    /(?:paid|spent|cost|costs|bill|total|amount|price)\s*:?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
    // Context-free large numbers that could be amounts
    /\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\b/g,
  ]

  for (const pattern of amountPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0]
      let amountStr = ''
      let detectedCurrency = currency
      let confidence = 0.5

      // Handle different match groups based on pattern type
      if (match[1] && match[2]) {
        if (isNaN(Number(match[1].charAt(0)))) {
          // Currency symbol first
          detectedCurrency = normalizeCurrency(match[1], currency)
          amountStr = match[2]
          confidence = 0.9
        } else {
          // Amount first
          amountStr = match[1]
          if (match[2]) {
            detectedCurrency = normalizeCurrency(match[2], currency)
            confidence = 0.9
          }
        }
      } else if (match[1]) {
        amountStr = match[1]
        confidence = 0.6
      }

      if (amountStr) {
        const parsedAmount = parseAmountWithCulturalContext(amountStr, language)
        if (parsedAmount && parsedAmount > 0 && parsedAmount <= 10_000_000_00) {
          // Boost confidence if currency matches context
          if (
            detectedCurrency === currency ||
            patterns.symbols.includes(detectedCurrency)
          ) {
            confidence += 0.2
          }

          // Boost confidence if surrounded by expense-related keywords
          const contextWords = [
            'paid',
            'spent',
            'cost',
            'bill',
            'total',
            'price',
            'dinner',
            'lunch',
            'coffee',
          ]
          const surroundingText = text
            .substring(
              Math.max(0, match.index! - 20),
              Math.min(text.length, match.index! + fullMatch.length + 20),
            )
            .toLowerCase()

          if (contextWords.some((word) => surroundingText.includes(word))) {
            confidence += 0.2
          }

          results.push({
            amountInCents: parsedAmount,
            confidence: Math.min(confidence, 1.0),
            currency: detectedCurrency,
            pattern: fullMatch,
          })
        }
      }
    }
  }

  // Sort by confidence and remove duplicates
  return results
    .sort((a, b) => b.confidence - a.confidence)
    .filter(
      (result, index, arr) =>
        arr.findIndex(
          (r) => Math.abs(r.amountInCents - result.amountInCents) < 100,
        ) === index,
    )
}

// ============================================================================
// ADVANCED DATE PARSING WITH NATURAL LANGUAGE
// ============================================================================

export function extractDateFromNaturalLanguage(
  text: string,
  language: string = 'en-US',
): DateParseResult[] {
  const today = new Date()
  const results: DateParseResult[] = []

  // Language-specific relative date patterns
  const relativeDatePatterns = getLanguageSpecificDatePatterns(language)

  for (const pattern of relativeDatePatterns) {
    const matches = text.match(pattern.regex)
    if (matches) {
      const date = pattern.compute(today)
      results.push({
        date,
        confidence: pattern.confidence,
        pattern: matches[0],
      })
    }
  }

  // Absolute date patterns (culture-specific)
  const absoluteDatePatterns = getAbsoluteDatePatterns(language)

  for (const pattern of absoluteDatePatterns) {
    let match
    while ((match = pattern.regex.exec(text)) !== null) {
      const date = pattern.parse(match)
      if (date && isValidExpenseDate(date)) {
        results.push({
          date,
          confidence: pattern.confidence,
          pattern: match[0],
        })
      }
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}

// ============================================================================
// PARTICIPANT NAME MATCHING WITH FUZZY LOGIC
// ============================================================================

export function extractParticipantsFromText(
  text: string,
  availableParticipants: { name: string; id: string }[],
  language: string = 'en-US',
): ParticipantParseResult {
  const foundParticipants: string[] = []
  const missingNames: string[] = []
  let allParticipants = false

  // Check for "all" or "everyone" keywords
  const allParticipantsPatterns = getAllParticipantsPatterns(language)
  if (
    allParticipantsPatterns.some((pattern) => pattern.test(text.toLowerCase()))
  ) {
    allParticipants = true
    return {
      participantIds: availableParticipants.map((p) => p.id),
      missingNames: [],
      confidence: 0.9,
      allParticipants: true,
    }
  }

  // Exact name matching
  for (const participant of availableParticipants) {
    const nameRegex = new RegExp(`\\b${escapeRegex(participant.name)}\\b`, 'gi')
    if (nameRegex.test(text)) {
      foundParticipants.push(participant.id)
    }
  }

  // Fuzzy name matching for common variations
  if (foundParticipants.length === 0) {
    const words = extractPotentialNames(text, language)

    for (const word of words) {
      const bestMatch = findBestParticipantMatch(word, availableParticipants)
      if (bestMatch.confidence > 0.7) {
        foundParticipants.push(bestMatch.participant.id)
      } else if (bestMatch.confidence > 0.3) {
        missingNames.push(word)
      }
    }
  }

  const confidence =
    foundParticipants.length > 0 ? 0.8 : missingNames.length > 0 ? 0.4 : 0.2

  return {
    participantIds: foundParticipants,
    missingNames,
    confidence,
    allParticipants,
  }
}

// ============================================================================
// CATEGORY DETECTION WITH AI AND PATTERN MATCHING
// ============================================================================

export async function detectExpenseCategory(
  text: string,
  categories: { id: number; name: string; grouping: string }[],
  language: string = 'en-US',
): Promise<CategoryParseResult | null> {
  // First try direct pattern matching
  const directMatch = findDirectCategoryMatch(text, categories, language)
  if (directMatch) {
    return directMatch
  }

  // Use AI for context-based category inference
  try {
    const categoryInference = await inferCategoryWithAI(
      text,
      categories,
      language,
    )
    return categoryInference
  } catch (error) {
    console.warn('AI category inference failed, using fallback:', error)
    return findFallbackCategory(text, categories, language)
  }
}

// ============================================================================
// COMPREHENSIVE EXPENSE PARSING FUNCTION
// ============================================================================

export async function parseExpenseFromNaturalLanguageAdvanced(
  message: string,
  context: ExpenseExtractionContext,
  config: Partial<AIServiceConfig> = {},
): Promise<ExpenseParseResult> {
  const finalConfig = { ...DEFAULT_AI_CONFIG, ...config }

  try {
    // Extract components in parallel
    const [amounts, dates, participants, category] = await Promise.all([
      Promise.resolve(
        extractAmountWithCulturalContext(
          message,
          context.language,
          context.currency,
        ),
      ),
      Promise.resolve(
        extractDateFromNaturalLanguage(message, context.language),
      ),
      Promise.resolve(
        extractParticipantsFromText(
          message,
          context.participants,
          context.language,
        ),
      ),
      detectExpenseCategory(message, context.categories, context.language),
    ])

    // Extract title using AI
    const title = await extractExpenseTitle(message, context.language)

    // Validate and select best results
    const bestAmount = amounts.length > 0 ? amounts[0] : null
    const bestDate = dates.length > 0 ? dates[0] : null

    if (!bestAmount || bestAmount.amountInCents <= 0) {
      return {
        success: false,
        confidence: 0.2,
        clarificationNeeded:
          'Could not extract a valid amount. Please specify how much was spent.',
        validationErrors: ['No valid amount found'],
      }
    }

    if (!title || title.trim().length < 2) {
      return {
        success: false,
        confidence: 0.2,
        clarificationNeeded:
          'Could not extract expense description. What was this expense for?',
        validationErrors: ['No valid expense description found'],
      }
    }

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence({
      amount: bestAmount.confidence,
      title: 0.8, // Title extraction is generally reliable
      participants: participants.confidence,
      date: bestDate?.confidence || 0.7, // Default to today is acceptable
      category: category?.confidence || 0.5,
    })

    const expenseData = {
      amount: bestAmount.amountInCents,
      title: title.trim(),
      participants: participants.participantIds,
      category: category?.categoryName,
      date:
        bestDate?.date.toISOString().split('T')[0] ||
        new Date().toISOString().split('T')[0],
      splitMode: 'EVENLY' as const,
      paidBy: undefined, // Will be inferred later
    }

    return {
      success: true,
      expenseData,
      confidence: overallConfidence,
    }
  } catch (error) {
    console.error('Advanced expense parsing failed:', error)
    return {
      success: false,
      confidence: 0,
      clarificationNeeded:
        'I had trouble processing your expense request. Please provide more details.',
      fallbackReason: 'parse_error',
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLanguageSpecificAmountPatterns(language: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    es: [
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*euros?/gi,
      /euros?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/gi,
    ],
    'fr-FR': [
      /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)\s*euros?/gi,
      /euros?\s*(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)/gi,
      /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)\s*€/gi,
    ],
    'de-DE': [
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*Euro/gi,
      /Euro\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/gi,
    ],
    'zh-CN': [
      /([￥¥])\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*[元块]/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*人民币/gi,
    ],
    'zh-TW': [
      /(NT\$|台幣)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*[元塊]/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*新台幣/gi,
    ],
    'pl-PL': [
      /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)\s*z[łl]/gi,
      /z[łl]\s*(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)/gi,
      /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)\s*PLN/gi,
    ],
    'ru-RU': [
      /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)\s*рубл/gi,
      /рубл\s*(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)/gi,
      /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)\s*₽/gi,
    ],
  }

  return patterns[language] || []
}

function getLanguageSpecificDatePatterns(language: string) {
  const today = new Date()

  const patterns: Record<string, any[]> = {
    'en-US': [
      {
        regex: /\b(today|now)\b/gi,
        compute: () => today,
        confidence: 0.9,
      },
      {
        regex: /\b(yesterday)\b/gi,
        compute: () => new Date(today.getTime() - 24 * 60 * 60 * 1000),
        confidence: 0.9,
      },
      {
        regex: /\b(last week|a week ago)\b/gi,
        compute: () => new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        confidence: 0.8,
      },
    ],
    es: [
      {
        regex: /\b(hoy|ahora)\b/gi,
        compute: () => today,
        confidence: 0.9,
      },
      {
        regex: /\b(ayer)\b/gi,
        compute: () => new Date(today.getTime() - 24 * 60 * 60 * 1000),
        confidence: 0.9,
      },
      {
        regex: /\b(la semana pasada|hace una semana)\b/gi,
        compute: () => new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        confidence: 0.8,
      },
    ],
    'fr-FR': [
      {
        regex: /\b(aujourd'hui|maintenant)\b/gi,
        compute: () => today,
        confidence: 0.9,
      },
      {
        regex: /\b(hier)\b/gi,
        compute: () => new Date(today.getTime() - 24 * 60 * 60 * 1000),
        confidence: 0.9,
      },
      {
        regex: /\b(la semaine dernière|il y a une semaine)\b/gi,
        compute: () => new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        confidence: 0.8,
      },
    ],
  }

  return patterns[language] || patterns['en-US']
}

function getAbsoluteDatePatterns(language: string) {
  const patterns: Record<string, any[]> = {
    'en-US': [
      {
        regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
        parse: (match: RegExpExecArray) =>
          new Date(
            parseInt(match[3]),
            parseInt(match[1]) - 1,
            parseInt(match[2]),
          ),
        confidence: 0.9,
      },
      {
        regex: /(\d{1,2})-(\d{1,2})-(\d{4})/g,
        parse: (match: RegExpExecArray) =>
          new Date(
            parseInt(match[3]),
            parseInt(match[1]) - 1,
            parseInt(match[2]),
          ),
        confidence: 0.9,
      },
    ],
    'de-DE': [
      {
        regex: /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
        parse: (match: RegExpExecArray) =>
          new Date(
            parseInt(match[3]),
            parseInt(match[2]) - 1,
            parseInt(match[1]),
          ),
        confidence: 0.9,
      },
    ],
  }

  return patterns[language] || patterns['en-US']
}

function getAllParticipantsPatterns(language: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    'en-US': [/\b(all|everyone|everybody|the group)\b/gi],
    es: [/\b(todos|todo el mundo|el grupo)\b/gi],
    'fr-FR': [/\b(tous|tout le monde|le groupe)\b/gi],
    'de-DE': [/\b(alle|jeder|die gruppe)\b/gi],
    'zh-CN': [/\b(所有人|大家|全部)\b/gi],
    'zh-TW': [/\b(所有人|大家|全部)\b/gi],
    'pl-PL': [/\b(wszyscy|każdy|grupa)\b/gi],
    'ru-RU': [/\b(все|всех|группа)\b/gi],
    'it-IT': [/\b(tutti|ognuno|il gruppo)\b/gi],
    'pt-BR': [/\b(todos|todo mundo|o grupo)\b/gi],
    'nl-NL': [/\b(iedereen|allemaal|de groep)\b/gi],
    fi: [/\b(kaikki|ryhmä)\b/gi],
    'tr-TR': [/\b(herkes|hepsi|grup)\b/gi],
    ro: [/\b(toți|toată lumea|grupul)\b/gi],
    'ua-UA': [/\b(всі|вся група|група)\b/gi],
  }

  return patterns[language] || patterns['en-US']
}

function normalizeCurrency(symbol: string, defaultCurrency: string): string {
  const currencyMap: Record<string, string> = {
    $: 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '￥': 'CNY',
    '₽': 'RUB',
    '₴': 'UAH',
    '₺': 'TRY',
    zł: 'PLN',
    lei: 'RON',
  }

  return currencyMap[symbol] || symbol.toUpperCase() || defaultCurrency
}

function isValidExpenseDate(date: Date): boolean {
  const today = new Date()
  const oneYearAgo = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate(),
  )
  const oneYearFromNow = new Date(
    today.getFullYear() + 1,
    today.getMonth(),
    today.getDate(),
  )

  return date >= oneYearAgo && date <= oneYearFromNow
}

function extractPotentialNames(text: string, language: string): string[] {
  // Remove common words and extract potential names
  const commonWords = getCommonWords(language)
  const words = text
    .split(/\s+/)
    .map((word) => word.replace(/[^\w]/g, ''))
    .filter(
      (word) => word.length >= 2 && !commonWords.includes(word.toLowerCase()),
    )
    .filter((word) => /^[A-Z]/.test(word)) // Names typically start with capital letter

  return words
}

function getCommonWords(language: string): string[] {
  const commonWords: Record<string, string[]> = {
    'en-US': [
      'i',
      'you',
      'we',
      'they',
      'the',
      'and',
      'or',
      'but',
      'for',
      'with',
      'paid',
      'spent',
      'cost',
      'bill',
    ],
    es: [
      'yo',
      'tú',
      'nosotros',
      'ellos',
      'el',
      'la',
      'y',
      'o',
      'pero',
      'para',
      'con',
      'pagué',
      'gasté',
      'cuesta',
    ],
    'fr-FR': [
      'je',
      'tu',
      'nous',
      'ils',
      'le',
      'la',
      'et',
      'ou',
      'mais',
      'pour',
      'avec',
      'payé',
      'dépensé',
      'coûte',
    ],
  }

  return commonWords[language] || commonWords['en-US']
}

function findBestParticipantMatch(
  name: string,
  participants: { name: string; id: string }[],
): { participant: { name: string; id: string }; confidence: number } {
  let bestMatch = { participant: participants[0], confidence: 0 }

  for (const participant of participants) {
    const confidence = calculateStringSimilarity(
      name.toLowerCase(),
      participant.name.toLowerCase(),
    )
    if (confidence > bestMatch.confidence) {
      bestMatch = { participant, confidence }
    }
  }

  return bestMatch
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance-based similarity
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null))

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      )
    }
  }

  const maxLength = Math.max(str1.length, str2.length)
  return (maxLength - matrix[str2.length][str1.length]) / maxLength
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findDirectCategoryMatch(
  text: string,
  categories: { id: number; name: string; grouping: string }[],
  language: string,
): CategoryParseResult | null {
  const lowerText = text.toLowerCase()

  for (const category of categories) {
    if (lowerText.includes(category.name.toLowerCase())) {
      return {
        categoryId: category.id,
        categoryName: category.name,
        confidence: 0.9,
      }
    }
  }

  return null
}

async function inferCategoryWithAI(
  text: string,
  categories: { id: number; name: string; grouping: string }[],
  language: string,
): Promise<CategoryParseResult | null> {
  try {
    const prompt = `Analyze this expense text and determine the most appropriate category:
    
Text: "${text}"
Available categories: ${categories.map((c) => c.name).join(', ')}

Respond with JSON: {"categoryName": "exact_category_name", "confidence": 0.0-1.0}
If no clear match, respond with: {"categoryName": null, "confidence": 0.0}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.1,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const result = JSON.parse(
      completion.choices[0]?.message?.content || '{}',
    ) as {
      categoryName?: string | null
      confidence?: number
    }

    if (result.categoryName) {
      const category = categories.find(
        (c) => c.name.toLowerCase() === result.categoryName!.toLowerCase(),
      )
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: result.confidence || 0.7,
        }
      }
    }
  } catch (error) {
    console.warn('AI category inference failed:', error)
  }

  return null
}

function findFallbackCategory(
  text: string,
  categories: { id: number; name: string; grouping: string }[],
  language: string,
): CategoryParseResult | null {
  // Basic keyword matching as fallback
  const keywordMap: Record<string, string[]> = {
    food: [
      'food',
      'restaurant',
      'dinner',
      'lunch',
      'breakfast',
      'coffee',
      'drink',
    ],
    transport: ['uber', 'taxi', 'bus', 'train', 'flight', 'gas', 'parking'],
    entertainment: ['movie', 'cinema', 'concert', 'show', 'ticket', 'game'],
    shopping: ['store', 'shop', 'mall', 'amazon', 'buy', 'purchase'],
  }

  const lowerText = text.toLowerCase()

  for (const [categoryType, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      const category = categories.find((c) =>
        c.name.toLowerCase().includes(categoryType),
      )
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: 0.6,
        }
      }
    }
  }

  return null
}

async function extractExpenseTitle(
  text: string,
  language: string,
): Promise<string> {
  // Extract title using simple heuristics first
  const basicTitle = extractBasicTitle(text)
  if (basicTitle && basicTitle.length >= 3) {
    return basicTitle
  }

  // Use AI for more complex title extraction
  try {
    const prompt = `Extract a concise expense title from this text: "${text}"
    
The title should be 2-30 characters, describing what the expense was for.
Examples: "Dinner at Mario's", "Uber ride", "Coffee", "Groceries"

Respond with just the title, no quotes or extra text.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }],
    })

    return (
      completion.choices[0]?.message?.content?.trim() || basicTitle || 'Expense'
    )
  } catch (error) {
    console.warn('AI title extraction failed:', error)
    return basicTitle || 'Expense'
  }
}

function extractBasicTitle(text: string): string {
  // Remove amount and participant information
  let cleanText = text
    .replace(/[\$€£¥₹₽₴₺]\s*\d+(?:[.,]\d+)?/g, '')
    .replace(/\d+(?:[.,]\d+)?\s*[\$€£¥₹₽₴₺]/g, '')
    .replace(/\b(paid|spent|cost|for|with|and|&)\b/gi, '')
    .trim()

  // Take first meaningful phrase
  const sentences = cleanText.split(/[.!?]/)
  const firstSentence = sentences[0]?.trim()

  if (
    firstSentence &&
    firstSentence.length >= 3 &&
    firstSentence.length <= 50
  ) {
    return firstSentence
  }

  // Fallback to first few words
  const words = cleanText.split(/\s+/).slice(0, 4)
  return words.join(' ').trim()
}

function calculateOverallConfidence(
  confidences: Record<string, number>,
): number {
  const weights = {
    amount: 0.3,
    title: 0.2,
    participants: 0.2,
    date: 0.15,
    category: 0.15,
  }

  let totalConfidence = 0
  let totalWeight = 0

  for (const [key, confidence] of Object.entries(confidences)) {
    if (confidence > 0 && weights[key as keyof typeof weights]) {
      totalConfidence += confidence * weights[key as keyof typeof weights]
      totalWeight += weights[key as keyof typeof weights]
    }
  }

  return totalWeight > 0 ? totalConfidence / totalWeight : 0.5
}
