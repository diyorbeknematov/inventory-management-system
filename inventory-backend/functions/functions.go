package helper

import (
	"function/models"
)

// here you can add your own functions
var Handlers = map[string]models.HandlerFunc{

	// Healt Check
	"health_check": HealthCheck,

	"login": Login,

	// users
	"get_users":           GetUsers,
	"create_user":         CreateUser,
	"delete_user":         DeleteUser,
	"update_user_profile": UpdateProfile,

	// merchants
	"create_merchant": CreateMerchant,
	"update_merchant": UpdateMerchant,
	"delete_merchant": DeleteMerchant,
	"get_merchants":   GetMerchants,

	// categories
	"create_category": CreateCategory,
	"update_category": UpdateCategory,
	"delete_category": DeleteCategory,

	// products
	"create_product": CreateProduct,
	"update_product": UpdateProduct,
	"delete_product": DeleteProduct,

	// product variations
	"create_product_variation": CreateProductVariation,
	"update_product_variation": UpdateProductVariation,
	"delete_product_variation": DeleteProductVariation,

	// warehouses
	"create_warehouse": CreateWarehouse,
	"update_warehouse": UpdateWarehouse,
	"delete_warehouse": DeleteWarehouse,

	"create_warehouse_stocks": CreateWarehouseStock,

	// shops
	"create_shop": CreateShop,
	"update_shop": UpdateShop,
	"delete_shop": DeleteShop,

	"create_shop_stock":       CreateShopInventory,
	"update_shop_stock_price": UpdateShopInventoryPrice,

	// movements
	"create_stock_movement":        CreateStockMovement,
	"update_stock_movement":        UpdateStockMovement,
	"delete_stock_movement":        DeleteStockMovement,
	"update_stock_movement_status": UpdateMovementStatus,

	"create_stock_movement_item": CreateStockMovementItem,
	"delete_stock_movement_item": DeleteStockMovementItem,

	// merchants datas
	"get_merchant_products":   GetMerchantProducts,
	"get_merchant_categories": GetCategories,
	"get_merchant_warehouses": GetMerchantWarehouses,
	"get_merchant_shops":      GetMerchantShops,

	// for select
	"get_roles_for_select":      GetRolesForSelect,
	"get_merchants_for_select":  GetMerchantsForSelect,
	"get_products_for_select":   GetProductsForSelect,
	"get_warehouses_for_select": GetWarehousesForSelect,
	"get_shops_for_select":      GetShopsForSelect,

	// analytics
	"get_merchant_sales":               GetShopSales,
	"get_merchant_receipts":            GetWarehouseIncomingShipments,
	"get_merchant_returns":             GetShopReturns,
	"get_merchant_shop_transfers":      GetShopTransfers,
	"get_merchant_warehouse_transfers": GetWarehouseOutgoingTransfers,
}
