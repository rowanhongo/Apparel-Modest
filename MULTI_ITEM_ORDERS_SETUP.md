# Multi-Item Orders Setup Guide

## Database Setup Required

To enable multi-item orders, you need to create an `order_items` table in Supabase:

```sql
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    color TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    measurements JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

## How It Works

1. **In-House Form**: Users can add multiple products to a cart before submitting
2. **Order Creation**: One order record is created with total price
3. **Order Items**: Each product in the cart becomes an `order_item` record
4. **Employee Display**: All items appear in ONE card with horizontal images

## Features

- ✅ Multiple products in one order
- ✅ Each item has its own color and price
- ✅ Horizontal image display (Option A)
- ✅ Total price calculation
- ✅ Backward compatible with single-item orders

## Implementation Status

- ✅ In-house form cart system
- ✅ Order submission with order_items
- ✅ Sales service display
- ⏳ Production service (needs same updates)
- ⏳ Logistics service (needs same updates)

