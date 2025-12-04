-- Update products table category check constraint
-- This script migrates existing category values and updates the constraint

-- Step 1: Drop the existing constraint (so we can update the data)
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_category_check;

-- Step 2: Migrate existing category values to new category values
-- Map old categories to new ones
UPDATE products 
SET category = CASE 
    WHEN category = 'dress' THEN 'dresses'
    WHEN category = 'blazer' THEN 'coats'
    WHEN category = 'gown' THEN 'dresses'
    WHEN category = 'romper' THEN 'jumpsuits'
    WHEN category = 'jacket' THEN 'coats'
    ELSE category  -- Keep existing value if it doesn't match old categories
END
WHERE category IN ('dress', 'blazer', 'gown', 'romper', 'jacket');

-- Step 3: For any other unexpected category values, set them to a default
-- (You can change 'dresses' to any default category you prefer)
UPDATE products 
SET category = 'dresses'
WHERE category IS NULL 
   OR category NOT IN ('jumpsuits', 'dresses', 'skirts', 'coats', 'trousers', 'tops', 'accessories');

-- Step 4: Create new constraint with updated category values
ALTER TABLE products 
ADD CONSTRAINT products_category_check 
CHECK (category IN ('jumpsuits', 'dresses', 'skirts', 'coats', 'trousers', 'tops', 'accessories'));

-- Step 5: Verify the constraint was created and check data
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'products_category_check';

-- Step 6: Check what categories exist in the table now (for verification)
SELECT category, COUNT(*) as count
FROM products
GROUP BY category
ORDER BY category;

