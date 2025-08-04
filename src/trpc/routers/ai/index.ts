import { createTRPCRouter } from '@/trpc/init'
import { conversationRouter } from './conversation'

export const aiRouter = createTRPCRouter({
  conversation: conversationRouter,
})
