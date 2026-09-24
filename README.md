# Project Overview
A platform where multiple merchants can manage their products, inventory, and shops in one centralized system. Each merchant can have warehouses and multiple retail shops with real-time inventory tracking.

## ***1. Data Model***

### Users

| Field | Type | Description |
|---|---|---|
| `full_name` | String | User's full name |
| `email` | String | User's email |
| `login` | String | Login |
| `password` | String | Password |
| `client_type` | String | Client type |
| `role` | String | User role |
| `merchant_id` | UUID | Related merchant |

**User Roles**
```text
Admin: Full control over everything
Merchant: Manage their own products, warehouses, and shops
```

### Merchants

| Field | Type | Description |
|---|---|---|
| `name` | String | Merchant name |

### Shops

| Field | Type | Description |
|---|---|---|
| `name` | String | Shop name |
| `merchant_id` | UUID | Related merchant |
| `logo` | String | Shop logo |
| `phone` | String | Shop phone number |
| `email` | String | Shop email |
| `address` | String | Shop address |

### Categories

| Field | Type | Description |
|---|---|---|
| `name` | String | Category name |
| `description` | String | Category description |
| `categories_id` | UUID | Self-relation for subcategories |

### Products

| Field | Type | Description |
|---|---|---|
| `name` | String | Product name |
| `category_id` | UUID | Related category |
| `photos` | File | Product photos |
| `merchant_id` | UUID | Related merchant |

### Product Variations

| Field | Type | Description |
|---|---|---|
| `sku` | String | Stock Keeping Unit |
| `product_id` | UUID | Related product |
| `photos` | File | Variation photos |
| `size` | String | Product size |
| `color` | String | Product color |

### Warehouses

| Field | Type | Description |
|---|---|---|
| `name` | String | Warehouse name |
| `merchant_id` | UUID | Related merchant |

### Warehouse Stocks

| Field | Type | Description |
|---|---|---|
| `warehouse_id` | UUID | Related warehouse |
| `product_variation_id` | UUID | Related product variation |
| `quantity` | Integer | Available quantity |

### Shop Inventory

| Field | Type | Description |
|---|---|---|
| `shop_id` | UUID | Related shop |
| `product_variation_id` | UUID | Related product variation |
| `quantity` | Integer | Available quantity |
| `base_price` | Decimal | Base price |
| `discount_percent` | Decimal | Discount percentage |
| `discount_amount` | Decimal | Fixed discount amount |
| `final_price` | Decimal | Final price after discount |

**Final price formula:**

`final_price = base_price - (base_price × discount_percent) - discount_amount`

### Stock Movements

| Field | Type | Description |
|---|---|---|
| `source_warehouse_id` | UUID | Source warehouse |
| `source_shops_id` | UUID | Source shop |
| `destination_warehouse_id` | UUID | Destination warehouse |
| `destination_shops_id` | UUID | Destination shop |
| `status` | Enum | `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED` |
| `type` | Enum | `SALE`, `RECEIPT`, `RETURN`, `TRANSFER` |

### Stock Movement Items

| Field | Type | Description |
|---|---|---|
| `stock_movement_id` | UUID | Related stock movement |
| `product_variation_id` | UUID | Related product variation |
| `quantity` | Integer | Movement quantity |

## ***2. Business Logic***

A stock movement is created with `DRAFT` status. In this state, the movement is only a draft, so stock quantities are not changed. Movement items can be added, updated, or deleted.

After all required items have been added, the movement can be sent. Its status changes to `SENT`, and the system starts processing the movement based on its `type`.

### ***1. Movement Types***

Each movement type defines where the products come from and where they go:

| Type       | Flow                        |
| ---------- | --------------------------- |
| `RECEIPT`  | External Source → Warehouse |
| `SALE`     | Shop → Customer             |
| `RETURN`   | Shop → Warehouse            |
| `TRANSFER` | Source → Destination        |

For `RECEIPT`, only the destination warehouse is required because the products come from outside the system.

For `SALE`, only the source shop is required because the products leave the inventory and go to a customer.

For `RETURN`, the source shop and destination warehouse are required.

For `TRANSFER`, both source and destination are required. The source and destination can be a warehouse or a shop.

### ***2. Stock Validation***

Before changing stock, the system checks the source stock for `SALE`, `RETURN`, and `TRANSFER` movements.

Every movement item is checked individually:

```text
Available Stock >= Requested Quantity
```

The movement is processed only if **all items have sufficient stock**.

If even one item does not have enough stock, the entire movement is marked as `REJECTED`. No item is partially processed and no stock quantities are changed.

For example:

```text
Item A: 5 requested, 10 available  → Valid
Item B: 8 requested, 3 available   → Insufficient
Item C: 2 requested, 5 available   → Valid

Result: REJECTED
```

### ***3. Movement Processing***

#### ***RECEIPT***

Products are received from an external source and added to the destination warehouse.

If the warehouse stock for a product already exists, its quantity is increased. If it does not exist, a new stock record is created.

#### ***SALE***

Products are sold from a shop to a customer.

After successful stock validation, the sold quantities are decreased from the shop inventory. No destination stock is created.

#### ***RETURN***

Products are returned from a shop to a warehouse.

After successful stock validation, the returned quantities are decreased from the shop inventory and added to the destination warehouse stock. Missing warehouse stock records are created when necessary.

#### ***TRANSFER***

Products are moved from one internal location to another.

After successful stock validation, the quantities are decreased from the source and added to the destination. If the destination does not have an existing stock record, a new one is created.

### ***4. Movement Status***

The movement follows this lifecycle:

```text
DRAFT → SENT → ACCEPTED
```

If validation or processing fails:

```text
DRAFT → SENT → REJECTED
```

* `DRAFT` — Movement is being prepared and its items can be managed.
* `SENT` — Movement has been submitted for processing.
* `ACCEPTED` — Movement was successfully processed.
* `REJECTED` — Movement could not be processed; stock remains unchanged.

A movement is processed as a whole. **If one required item fails validation, the entire movement is rejected.**

## ***3. Caching (Redis)***

Read-heavy endpoints are cached in Redis to reduce database load and response time. Data is always stored in the database first; the cache is only a fast copy.

### ***1. Strategy***

The **cache-aside** pattern is used:

```text
Request → Check cache → Hit: return cached data
                      → Miss: query DB → save to cache → return data
```

* Cache is checked **after** the access and permission checks, so one merchant can never receive another merchant's data.
* Every cache entry has a **TTL of 5 minutes** with a random jitter (up to 10%), so many keys do not expire at the same moment.
* If Redis is unavailable, the error is only logged and the request falls back to the database. Redis failure never breaks the API.

### ***2. Cached Endpoints and Keys***

| Endpoint | Cache key | Depends on |
|---|---|---|
| `GetProducts` | `products:list:<merchantID>:<hash(search)>` | merchant, search |
| `GetProductVariations` | `product_variations:<productID>` | product |
| `GetUsers` | `users:list:<merchantID>:<hash(search)>` | merchant, search |

* For Admin, `<merchantID>` is empty when the whole list is requested (e.g. `products:list::<hash>`).
* The search text is hashed (SHA-256) so keys stay short and safe, even with special characters.
* `merchantID` is written openly in the key so that only one merchant's cache can be cleared.

### ***3. Cache Invalidation***

When data changes, the related cache is cleared. The database is always updated first, then the cache is cleared.

| Action | Cache cleared |
|---|---|
| Create product | `products:list:<merchantID>:*` and `products:list::*` |
| Update / Delete product | `products:list:*` and `product_variations:<productID>` (delete only) |
| Create product (with variations) | Nothing to clear, the product is new and has no cache yet |
| Create / Update / Delete variation | `product_variations:<productID>` |
| Create / Update / Delete user | `users:list:<merchantID>:*` and `users:list::*` |
| Update profile | `users:list:*` |

Rules followed:

* **Create:** new items have no cache of their own, so only the related **lists** are cleared.
* **Update / Delete:** both the item cache and the related lists are cleared.
* If clearing the cache fails, the error is only logged. The data is already saved, so the user does not get an error. The 5-minute TTL fixes any stale data.

### ***4. Cache Helper Functions***

| Function | Purpose |
|---|---|
| `Set` | Saves a value as JSON with a TTL (seconds) |
| `Get` | Reads and decodes a value; returns `ErrCacheMiss` when the key does not exist |
| `Delete` | Deletes one key |
| `DeleteWildCard` | Deletes all keys matching a pattern (e.g. `products:list:*`) |
| `WithJitter` | Adds a random 0-10% to the TTL |