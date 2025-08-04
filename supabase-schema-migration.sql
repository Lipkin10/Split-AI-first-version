-- Migration script to align new Supabase schema with existing codebase
-- Run this script in your Supabase SQL editor

-- Step 1: Drop the new schema tables that conflict with our desired structure
DROP TABLE IF EXISTS public.expense_splits CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Step 2: Drop the old schema tables if they exist
DROP TABLE IF EXISTS public.RecurringExpenseLink CASCADE;
DROP TABLE IF EXISTS public.ExpenseDocument CASCADE;
DROP TABLE IF EXISTS public.ExpensePaidFor CASCADE;
DROP TABLE IF EXISTS public.Activity CASCADE;
DROP TABLE IF EXISTS public.Expense CASCADE;
DROP TABLE IF EXISTS public.Participant CASCADE;
DROP TABLE IF EXISTS public.Group CASCADE;
DROP TABLE IF EXISTS public.Category CASCADE;

-- Step 3: Create tables matching the current codebase structure

-- Category table (unchanged from original)
CREATE TABLE public.Category (
  id integer NOT NULL DEFAULT nextval('"Category_id_seq"'::regclass),
  grouping text NOT NULL,
  name text NOT NULL,
  CONSTRAINT Category_pkey PRIMARY KEY (id)
);

-- Create sequence for Category if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public."Category_id_seq" AS integer;

-- Group table (matches current codebase expectations)
CREATE TABLE public.Group (
  id text NOT NULL,
  name text NOT NULL,
  information text,
  currency text NOT NULL DEFAULT 'USD',
  createdAt timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT Group_pkey PRIMARY KEY (id)
);

-- Participant table (matches current codebase expectations)
CREATE TABLE public.Participant (
  id text NOT NULL,
  name text NOT NULL,
  groupId text NOT NULL,
  CONSTRAINT Participant_pkey PRIMARY KEY (id),
  CONSTRAINT Participant_groupId_fkey FOREIGN KEY (groupId) REFERENCES public.Group(id) ON DELETE CASCADE
);

-- Expense table (matches current codebase expectations)
CREATE TABLE public.Expense (
  id text NOT NULL,
  groupId text NOT NULL,
  expenseDate date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  categoryId integer NOT NULL DEFAULT 0,
  amount integer NOT NULL,
  paidById text NOT NULL,
  isReimbursement boolean NOT NULL DEFAULT false,
  splitMode text NOT NULL DEFAULT 'EVENLY',
  createdAt timestamp without time zone NOT NULL DEFAULT now(),
  notes text,
  recurrenceRule text DEFAULT 'NONE',
  recurringExpenseLinkId text,
  CONSTRAINT Expense_pkey PRIMARY KEY (id),
  CONSTRAINT Expense_groupId_fkey FOREIGN KEY (groupId) REFERENCES public.Group(id) ON DELETE CASCADE,
  CONSTRAINT Expense_paidById_fkey FOREIGN KEY (paidById) REFERENCES public.Participant(id) ON DELETE CASCADE,
  CONSTRAINT Expense_categoryId_fkey FOREIGN KEY (categoryId) REFERENCES public.Category(id),
  CONSTRAINT Expense_splitMode_check CHECK (splitMode IN ('EVENLY', 'BY_SHARES', 'BY_PERCENTAGE', 'BY_AMOUNT')),
  CONSTRAINT Expense_recurrenceRule_check CHECK (recurrenceRule IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY'))
);

-- ExpensePaidFor table (matches current codebase expectations)
CREATE TABLE public.ExpensePaidFor (
  expenseId text NOT NULL,
  participantId text NOT NULL,
  shares integer NOT NULL DEFAULT 1,
  CONSTRAINT ExpensePaidFor_pkey PRIMARY KEY (expenseId, participantId),
  CONSTRAINT ExpensePaidFor_expenseId_fkey FOREIGN KEY (expenseId) REFERENCES public.Expense(id) ON DELETE CASCADE,
  CONSTRAINT ExpensePaidFor_participantId_fkey FOREIGN KEY (participantId) REFERENCES public.Participant(id) ON DELETE CASCADE
);

-- ExpenseDocument table (matches current codebase expectations)
CREATE TABLE public.ExpenseDocument (
  id text NOT NULL,
  url text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  expenseId text,
  CONSTRAINT ExpenseDocument_pkey PRIMARY KEY (id),
  CONSTRAINT ExpenseDocument_expenseId_fkey FOREIGN KEY (expenseId) REFERENCES public.Expense(id) ON DELETE CASCADE
);

-- Activity table (matches current codebase expectations)
CREATE TABLE public.Activity (
  id text NOT NULL,
  groupId text NOT NULL,
  time timestamp without time zone NOT NULL DEFAULT now(),
  activityType text NOT NULL,
  participantId text,
  expenseId text,
  data text,
  CONSTRAINT Activity_pkey PRIMARY KEY (id),
  CONSTRAINT Activity_groupId_fkey FOREIGN KEY (groupId) REFERENCES public.Group(id) ON DELETE CASCADE,
  CONSTRAINT Activity_activityType_check CHECK (activityType IN ('UPDATE_GROUP', 'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE'))
);

-- RecurringExpenseLink table (matches current codebase expectations)
CREATE TABLE public.RecurringExpenseLink (
  id text NOT NULL,
  groupId text NOT NULL,
  currentFrameExpenseId text NOT NULL UNIQUE,
  nextExpenseCreatedAt timestamp without time zone,
  nextExpenseDate timestamp without time zone NOT NULL,
  CONSTRAINT RecurringExpenseLink_pkey PRIMARY KEY (id),
  CONSTRAINT RecurringExpenseLink_groupId_fkey FOREIGN KEY (groupId) REFERENCES public.Group(id) ON DELETE CASCADE,
  CONSTRAINT RecurringExpenseLink_currentFrameExpenseId_fkey FOREIGN KEY (currentFrameExpenseId) REFERENCES public.Expense(id) ON DELETE CASCADE
);

-- Step 4: Insert default categories (commonly used in expense tracking apps)
INSERT INTO public.Category (id, grouping, name) VALUES
(0, 'general', 'General'),
(1, 'food', 'Groceries'),
(2, 'food', 'Restaurant'),
(3, 'transport', 'Transportation'),
(4, 'entertainment', 'Entertainment'),
(5, 'utilities', 'Utilities'),
(6, 'health', 'Healthcare'),
(7, 'shopping', 'Shopping'),
(8, 'travel', 'Travel'),
(9, 'other', 'Other')
ON CONFLICT (id) DO NOTHING;

-- Step 5: Set up RLS (Row Level Security) policies if needed
-- Note: You may want to add RLS policies based on your authentication requirements

-- Enable RLS on tables
ALTER TABLE public.Group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ExpensePaidFor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ExpenseDocument ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.RecurringExpenseLink ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (you may want to restrict these later)
CREATE POLICY "Allow all operations on Group" ON public.Group FOR ALL USING (true);
CREATE POLICY "Allow all operations on Participant" ON public.Participant FOR ALL USING (true);
CREATE POLICY "Allow all operations on Expense" ON public.Expense FOR ALL USING (true);
CREATE POLICY "Allow all operations on ExpensePaidFor" ON public.ExpensePaidFor FOR ALL USING (true);
CREATE POLICY "Allow all operations on ExpenseDocument" ON public.ExpenseDocument FOR ALL USING (true);
CREATE POLICY "Allow all operations on Activity" ON public.Activity FOR ALL USING (true);
CREATE POLICY "Allow all operations on RecurringExpenseLink" ON public.RecurringExpenseLink FOR ALL USING (true);

-- Step 6: Update sequence ownership
ALTER SEQUENCE public."Category_id_seq" OWNED BY public.Category.id;