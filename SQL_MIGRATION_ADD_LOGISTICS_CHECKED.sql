-- Add logistics_checked column to orders table
-- This column tracks whether an order has been checked/ticked in the logistics page

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS logistics_checked BOOLEAN DEFAULT FALSE;

-- Add a comment to document the column
COMMENT ON COLUMN orders.logistics_checked IS 'Indicates if the order has been checked/ticked in the logistics page';

-- Optional: Create an index for faster queries if you plan to filter by this column
-- CREATE INDEX IF NOT EXISTS idx_orders_logistics_checked ON orders(logistics_checked) WHERE logistics_checked = TRUE;
