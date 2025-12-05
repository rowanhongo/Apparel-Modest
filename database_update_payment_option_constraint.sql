-- Update payment_option constraint to include 'paystack'
-- Run this SQL in your Supabase SQL Editor

-- Remove the old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_option_check;

-- Add new constraint with 'paystack' included
ALTER TABLE orders ADD CONSTRAINT orders_payment_option_check 
CHECK (payment_option IN ('mpesa', 'stk-push', 'card', 'paypal', 'apple-pay', 'paystack'));

