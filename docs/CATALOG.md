# Catalogue system

## Authority and publication

Category and product administration requires `products.manage`; all changes create audit records. Categories use a unique slug and can be deleted only when no product references them. Products use unique slug and SKU and are archived rather than deleted, preserving future order references.

Only `ACTIVE` products in `ACTIVE` categories are returned by public catalogue APIs. Image URLs are limited to eight `http`/`https` URLs. Inventory is displayed as current stock but is not decremented until the future order service runs.

## Checkout boundary

The browser may send only a requested product identifier and quantity to a future checkout endpoint. It must never supply price, sale price, PV, BV, stock, category, or commission eligibility. `getAuthoritativeProductForCheckout()` loads those values afresh from MongoDB, rejects inactive/out-of-stock products, chooses the effective sale/regular price, and zeros PV/BV when a product is not commission eligible.

The order service will embed those retrieved values as immutable order-item snapshots before payment and commission processing.
