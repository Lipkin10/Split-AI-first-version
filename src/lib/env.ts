import { ZodIssueCode, z } from 'zod'

const interpretEnvVarAsBool = (val: unknown): boolean => {
  if (typeof val !== 'string') return false
  return ['true', 'yes', '1', 'on'].includes(val.toLowerCase())
}

const envSchema = z
  .object({
    // Postgres URLs (keeping for now during transition)
    POSTGRES_URL_NON_POOLING: z.string().url().optional(),

    // Supabase configuration (Server-side) - optional to allow client-side usage
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_API_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE: z.string().optional(),
    SUPABASE_POSTGRES_URL: z.string().optional(),

    // Supabase configuration (Client-side) - required for browser usage
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_API_ANON_KEY: z.string(),

    NEXT_PUBLIC_BASE_URL: z
      .string()
      .optional()
      .default(
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000',
      ),
    NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS: z.preprocess(
      interpretEnvVarAsBool,
      z.boolean().default(false),
    ),
    NEXT_PUBLIC_DEFAULT_CURRENCY_SYMBOL: z.string().optional(),
    S3_UPLOAD_KEY: z.string().optional(),
    S3_UPLOAD_SECRET: z.string().optional(),
    S3_UPLOAD_BUCKET: z.string().optional(),  
    S3_UPLOAD_REGION: z.string().optional(),
    S3_UPLOAD_ENDPOINT: z.string().optional(),
    NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT: z.preprocess(
      interpretEnvVarAsBool,
      z.boolean().default(false),
    ),
    NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT: z.preprocess(
      interpretEnvVarAsBool,
      z.boolean().default(false),
    ),
    NEXT_PUBLIC_ENABLE_CONVERSATIONAL_EXPENSE: z.preprocess(
      interpretEnvVarAsBool,
      z.boolean().default(false),
    ),
    OPENAI_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (
      env.NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS &&
      // S3_UPLOAD_ENDPOINT is fully optional as it will only be used for providers other than AWS
      (!env.S3_UPLOAD_BUCKET ||
        !env.S3_UPLOAD_KEY ||
        !env.S3_UPLOAD_REGION ||
        !env.S3_UPLOAD_SECRET)
    ) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'If NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS is specified, then S3_* must be specified too',
      })
    }
    if (
      (env.NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT ||
        env.NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT ||
        env.NEXT_PUBLIC_ENABLE_CONVERSATIONAL_EXPENSE) &&
      !env.OPENAI_API_KEY
    ) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'If NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT, NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT, or NEXT_PUBLIC_ENABLE_CONVERSATIONAL_EXPENSE is specified, then OPENAI_API_KEY must be specified too',
      })
    }
  })

// Lazy validation function to avoid module-level execution timing issues
function getValidatedEnv() {
  const shouldValidate = process.env.NODE_ENV === 'development' || typeof window === 'undefined'
  
  if (shouldValidate) {
    try {
      return envSchema.parse(process.env)
    } catch (error) {
      console.error('Environment validation failed:', error)
      // In development, we still want to continue with raw env vars for debugging
      if (process.env.NODE_ENV === 'development') {
        console.warn('Continuing with unvalidated environment variables in development mode')
        return process.env as unknown as z.infer<typeof envSchema>
      }
      throw error
    }
  }
  
  return process.env as unknown as z.infer<typeof envSchema>
}

// Create a proxy to lazily evaluate environment variables
export const env = new Proxy({} as z.infer<typeof envSchema> & { _validated?: boolean }, {
  get(target, prop: string) {
    // Cache the validated env object
    if (!target._validated) {
      const validatedEnv = getValidatedEnv()
      Object.assign(target, validatedEnv)
      target._validated = true
    }
    return target[prop as keyof typeof target]
  }
})
