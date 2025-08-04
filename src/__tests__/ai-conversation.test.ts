import {
  CURRENCY_PATTERNS,
  extractAmountFromText,
  extractDateFromText,
  extractNamesFromText,
  formatCurrencyForLanguage,
  isValidIntent,
  parseAmountWithCulturalContext,
} from '../lib/ai-conversation'

// Mock OpenAI for the tests that need it
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  }
})

// Mock environment with relative path
jest.mock('../lib/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key',
  },
}))

describe('AI Conversation Module', () => {
  describe('Structured Data Extraction', () => {
    describe('Amount Extraction', () => {
      it('should extract amounts from various currency formats', () => {
        expect(extractAmountFromText('$25.50')).toBe(2550)
        expect(extractAmountFromText('€30,25')).toBe(3025)
        expect(extractAmountFromText('£15.99')).toBe(1599)
        expect(extractAmountFromText('¥1000')).toBe(100000)
        expect(extractAmountFromText('no amount here')).toBe(null)
      })

      it('should handle cultural number formats', () => {
        expect(parseAmountWithCulturalContext('€25,50', 'de-DE')).toBe(2550)
        expect(parseAmountWithCulturalContext('$25.50', 'en-US')).toBe(2550)
        expect(parseAmountWithCulturalContext('25,50€', 'fr-FR')).toBe(2550)
      })
    })

    describe('Name Extraction', () => {
      it('should extract participant names from text', () => {
        const participants = ['Alice', 'Bob', 'Charlie']
        const text = 'Alice and Bob went to lunch'

        const result = extractNamesFromText(text, participants)
        expect(result).toEqual(['Alice', 'Bob'])
      })

      it('should be case insensitive', () => {
        const participants = ['Alice', 'Bob']
        const text = 'alice and BOB went out'

        const result = extractNamesFromText(text, participants)
        expect(result).toEqual(['Alice', 'Bob'])
      })
    })

    describe('Date Extraction', () => {
      it('should parse relative dates', () => {
        const today = new Date()
        const todayResult = extractDateFromText('I spent money today')
        expect(todayResult?.toDateString()).toBe(today.toDateString())

        const yesterdayResult = extractDateFromText('I spent money yesterday')
        const expectedYesterday = new Date(today)
        expectedYesterday.setDate(today.getDate() - 1)
        expect(yesterdayResult?.toDateString()).toBe(
          expectedYesterday.toDateString(),
        )
      })

      it('should parse specific date formats', () => {
        const result = extractDateFromText('I spent money on 01/15/2024')
        expect(result?.getFullYear()).toBe(2024)
        expect(result?.getMonth()).toBe(0) // January (0-indexed)
        expect(result?.getDate()).toBe(15)
      })
    })
  })

  describe('Currency and Locale Support', () => {
    it('should have currency patterns for all supported languages', () => {
      const supportedLanguages = [
        'en-US',
        'es',
        'fr-FR',
        'de-DE',
        'zh-CN',
        'zh-TW',
        'pl-PL',
        'ru-RU',
        'it-IT',
        'ua-UA',
        'ro',
        'tr-TR',
        'pt-BR',
        'nl-NL',
        'fi',
      ]

      supportedLanguages.forEach((lang) => {
        expect(
          CURRENCY_PATTERNS[lang as keyof typeof CURRENCY_PATTERNS],
        ).toBeDefined()
        expect(
          CURRENCY_PATTERNS[lang as keyof typeof CURRENCY_PATTERNS].symbols,
        ).toBeInstanceOf(Array)
        expect(
          CURRENCY_PATTERNS[lang as keyof typeof CURRENCY_PATTERNS].format,
        ).toBeDefined()
      })
    })

    it('should format currency according to locale', () => {
      expect(formatCurrencyForLanguage(2550, 'en-US', 'USD')).toContain('25.50')
      expect(formatCurrencyForLanguage(2550, 'de-DE', 'EUR')).toContain('25,50')
      expect(formatCurrencyForLanguage(2550, 'fr-FR', 'EUR')).toContain('25,50')
    })

    it('should fallback to USD for unsupported currencies', () => {
      const result = formatCurrencyForLanguage(2550, 'en-US', 'INVALID')
      expect(result).toContain('$')
    })
  })

  describe('Intent Validation', () => {
    it('should validate supported intents', () => {
      expect(isValidIntent('expense_creation')).toBe(true)
      expect(isValidIntent('balance_query')).toBe(true)
      expect(isValidIntent('group_management')).toBe(true)
      expect(isValidIntent('expense_history')).toBe(true)
      expect(isValidIntent('reimbursement_status')).toBe(true)
      expect(isValidIntent('unclear')).toBe(true)
      expect(isValidIntent('invalid_intent')).toBe(false)
    })
  })

  describe('Multi-language Pattern Support', () => {
    it('should support different currency symbols by language', () => {
      expect(CURRENCY_PATTERNS['en-US'].symbols).toContain('$')
      expect(CURRENCY_PATTERNS['de-DE'].symbols).toContain('€')
      expect(CURRENCY_PATTERNS['zh-CN'].symbols).toContain('￥')
      expect(CURRENCY_PATTERNS['ru-RU'].symbols).toContain('₽')
      expect(CURRENCY_PATTERNS['tr-TR'].symbols).toContain('₺')
      expect(CURRENCY_PATTERNS['pt-BR'].symbols).toContain('R$')
    })

    it('should support different date formats by language', () => {
      expect(CURRENCY_PATTERNS['en-US'].format).toBe('YYYY-MM-DD')
      expect(CURRENCY_PATTERNS['de-DE'].format).toBe('DD.MM.YYYY')
      expect(CURRENCY_PATTERNS['fr-FR'].format).toBe('DD/MM/YYYY')
      expect(CURRENCY_PATTERNS['zh-CN'].format).toBe('YYYY年MM月DD日')
    })
  })

  describe('Amount Parsing with Cultural Context', () => {
    it('should handle European decimal comma format', () => {
      expect(parseAmountWithCulturalContext('25,50', 'de-DE')).toBe(2550)
      expect(parseAmountWithCulturalContext('1.234,56', 'de-DE')).toBe(123456)
    })

    it('should handle US decimal dot format', () => {
      expect(parseAmountWithCulturalContext('25.50', 'en-US')).toBe(2550)
      expect(parseAmountWithCulturalContext('1,234.56', 'en-US')).toBe(123456)
    })

    it('should return null for invalid amounts', () => {
      expect(parseAmountWithCulturalContext('abc', 'en-US')).toBe(null)
      expect(parseAmountWithCulturalContext('', 'en-US')).toBe(null)
    })
  })
})

// Simple integration test without complex OpenAI mocking
describe('Basic Integration Tests', () => {
  it('should have all required exports available', () => {
    // Test that all main functions are exported and available
    expect(typeof extractAmountFromText).toBe('function')
    expect(typeof extractNamesFromText).toBe('function')
    expect(typeof extractDateFromText).toBe('function')
    expect(typeof parseAmountWithCulturalContext).toBe('function')
    expect(typeof formatCurrencyForLanguage).toBe('function')
    expect(typeof isValidIntent).toBe('function')
  })
})
