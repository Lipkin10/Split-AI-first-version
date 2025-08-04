import '@testing-library/jest-dom'
import 'openai/shims/node'

// Mock next-intl for consistent testing
jest.mock('next-intl', () => ({
  useLocale: () => 'en-US',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, any>) => {
    if (values) {
      let result = `${namespace}.${key}`
      Object.entries(values).forEach(([placeholder, value]) => {
        result = result.replace(`{${placeholder}}`, String(value))
      })
      return result
    }
    return `${namespace}.${key}`
  },
}))

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key'

// Mock ResizeObserver (required for responsive tests)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver (required for some UI components)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))
