-- Add production_checked column to orders table
-- This column tracks whether an order has been checked/ticked in the production page

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS production_checked BOOLEAN DEFAULT FALSE;

-- Add a comment to document the column
COMMENT ON COLUMN orders.production_checked IS 'Indicates if the order has been checked/ticked in the production page';

-- Optional: Create an index for faster queries if you plan to filter by this column
-- CREATE INDEX IF NOT EXISTS idx_orders_production_checked ON orders(production_checked) WHERE production_checked = TRUE;
