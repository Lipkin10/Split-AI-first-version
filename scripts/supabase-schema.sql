-- =====================================================
-- Supabase Schema Setup - Mirror of Prisma Schema
-- =====================================================

-- Create enum types first (must be created before tables that use them)
CREATE TYPE "SplitMode" AS ENUM ('EVENLY', 'BY_SHARES', 'BY_PERCENTAGE', 'BY_AMOUNT');
CREATE TYPE "RecurrenceRule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "ActivityType" AS ENUM ('UPDATE_GROUP', 'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE');

-- =====================================================
-- TABLES
-- =====================================================

-- Group table
CREATE TABLE "Group" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "information" TEXT,
    "currency" TEXT DEFAULT '$' NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT NOW() NOT NULL
);

-- Participant table  
CREATE TABLE "Participant" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "Participant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);

-- Category table
CREATE TABLE "Category" (
    "id" SERIAL PRIMARY KEY,
    "grouping" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- Expense table (complete structure matching Prisma)
CREATE TABLE "Expense" (
    "id" TEXT PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "expenseDate" DATE DEFAULT CURRENT_DATE NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" INTEGER DEFAULT 0 NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidById" TEXT NOT NULL,
    "isReimbursement" BOOLEAN DEFAULT false NOT NULL,
    "splitMode" "SplitMode" DEFAULT 'EVENLY' NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT NOW() NOT NULL,
    "notes" TEXT,
    "recurrenceRule" "RecurrenceRule" DEFAULT 'NONE',
    "recurringExpenseLinkId" TEXT,
    CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
    CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "Participant"("id") ON DELETE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
);

-- ExpensePaidFor junction table (composite primary key)
CREATE TABLE "ExpensePaidFor" (
    "expenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "shares" INTEGER DEFAULT 1 NOT NULL,
    PRIMARY KEY ("expenseId", "participantId"),
    CONSTRAINT "ExpensePaidFor_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE,
    CONSTRAINT "ExpensePaidFor_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE
);

-- Activity audit log table
CREATE TABLE "Activity" (
    "id" TEXT PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "time" TIMESTAMP(3) DEFAULT NOW() NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "participantId" TEXT,
    "expenseId" TEXT,
    "data" TEXT,
    CONSTRAINT "Activity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id")
);

-- ExpenseDocument table for file references
CREATE TABLE "ExpenseDocument" (
    "id" TEXT PRIMARY KEY,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "expenseId" TEXT,
    CONSTRAINT "ExpenseDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
);

-- RecurringExpenseLink table
CREATE TABLE "RecurringExpenseLink" (
    "id" TEXT PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "currentFrameExpenseId" TEXT UNIQUE NOT NULL,
    "nextExpenseCreatedAt" TIMESTAMP(3),
    "nextExpenseDate" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringExpenseLink_currentFrameExpenseId_fkey" FOREIGN KEY ("currentFrameExpenseId") REFERENCES "Expense"("id") ON DELETE CASCADE
);

-- =====================================================
-- INDEXES (matching Prisma schema)
-- =====================================================

CREATE INDEX "RecurringExpenseLink_groupId_idx" ON "RecurringExpenseLink"("groupId");
CREATE INDEX "RecurringExpenseLink_groupId_nextExpenseCreatedAt_nextExpenseDate_idx" 
    ON "RecurringExpenseLink"("groupId", "nextExpenseCreatedAt", "nextExpenseDate" DESC);

-- Additional performance indexes
CREATE INDEX "Participant_groupId_idx" ON "Participant"("groupId");
CREATE INDEX "Expense_groupId_idx" ON "Expense"("groupId");
CREATE INDEX "Expense_paidById_idx" ON "Expense"("paidById");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "ExpensePaidFor_participantId_idx" ON "ExpensePaidFor"("participantId");
CREATE INDEX "Activity_groupId_idx" ON "Activity"("groupId");
CREATE INDEX "Activity_time_idx" ON "Activity"("time");
CREATE INDEX "ExpenseDocument_expenseId_idx" ON "ExpenseDocument"("expenseId");

-- =====================================================
-- INSERT DEFAULT CATEGORIES (matching current system)
-- =====================================================

INSERT INTO "Category" ("id", "grouping", "name") VALUES
(0, 'general', 'General'),
(1, 'entertainment', 'Entertainment'),
(2, 'food', 'Food and drink'),
(3, 'home', 'Home'),
(4, 'life', 'Life'),
(5, 'services', 'Services'),
(6, 'transport', 'Transportation'),
(7, 'other', 'Other');

-- Reset the category sequence to start after our inserted values
SELECT setval('"Category_id_seq"', 8, false);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpensePaidFor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecurringExpenseLink" ENABLE ROW LEVEL SECURITY;

-- For now, create permissive policies (since this is a simple expense sharing app)
-- In a production multi-tenant app, these would be more restrictive

-- Allow all operations on all tables for authenticated users
-- Categories are public (read-only for everyone, full access for service role)
CREATE POLICY "Categories are publicly readable" ON "Category" FOR SELECT USING (true);
CREATE POLICY "Service role can modify categories" ON "Category" FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- For the other tables, allow all operations (this matches the current open nature of the app)
-- Groups
CREATE POLICY "Groups are publicly accessible" ON "Group" FOR ALL USING (true);

-- Participants 
CREATE POLICY "Participants are publicly accessible" ON "Participant" FOR ALL USING (true);

-- Expenses
CREATE POLICY "Expenses are publicly accessible" ON "Expense" FOR ALL USING (true);

-- ExpensePaidFor
CREATE POLICY "ExpensePaidFor are publicly accessible" ON "ExpensePaidFor" FOR ALL USING (true);

-- Activity
CREATE POLICY "Activity are publicly accessible" ON "Activity" FOR ALL USING (true);

-- ExpenseDocument
CREATE POLICY "ExpenseDocument are publicly accessible" ON "ExpenseDocument" FOR ALL USING (true);

-- RecurringExpenseLink
CREATE POLICY "RecurringExpenseLink are publicly accessible" ON "RecurringExpenseLink" FOR ALL USING (true);

-- =====================================================
-- REAL-TIME SUBSCRIPTIONS (Enable for conversational AI)
-- =====================================================

-- Enable real-time for tables that will need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE "Group";
ALTER PUBLICATION supabase_realtime ADD TABLE "Participant";
ALTER PUBLICATION supabase_realtime ADD TABLE "Expense";
ALTER PUBLICATION supabase_realtime ADD TABLE "ExpensePaidFor";
ALTER PUBLICATION supabase_realtime ADD TABLE "Activity";
ALTER PUBLICATION supabase_realtime ADD TABLE "ExpenseDocument";

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify schema creation
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('Group', 'Participant', 'Category', 'Expense', 'ExpensePaidFor', 'Activity', 'ExpenseDocument', 'RecurringExpenseLink')
ORDER BY tablename;

-- Verify enum types
SELECT 
    typname,
    typtype,
    enumlabel
FROM pg_type t
LEFT JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('SplitMode', 'RecurrenceRule', 'ActivityType')
ORDER BY typname, enumlabel;

-- Verify default categories
SELECT id, grouping, name FROM "Category" ORDER BY id;

-- Schema setup complete!
-- Next steps: 
-- 1. Run this schema in your Supabase SQL editor
-- 2. Update application to use Supabase client instead of Prisma
-- 3. Test all existing functionality 