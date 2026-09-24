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
	"get_categories":  GetCategories,
	"create_category": CreateCategory,
	"update_category": UpdateCategory,
	"delete_category": DeleteCategory,

	// products
	"get_products":   GetProducts,
	"create_product": CreateProduct,
	"update_product": UpdateProduct,
	"delete_product": DeleteProduct,

	// product variations
	"get_product_variations":   GetProductVariations,
	"create_product_variation": CreateProductVariation,
	"update_product_variation": UpdateProductVariation,
	"delete_product_variation": DeleteProductVariation,

	// warehouses
	"get_warehouses":   GetWarehouses,
	"create_warehouse": CreateWarehouse,
	"update_warehouse": UpdateWarehouse,
	"delete_warehouse": DeleteWarehouse,

	"get_warehouse_stocks":    GetWarehouseStocks,
	"create_warehouse_stocks": CreateWarehouseStock,

	// shops
	"get_shops":   GetShops,
	"create_shop": CreateShop,
	"update_shop": UpdateShop,
	"delete_shop": DeleteShop,

	"get_shop_stocks":         GetShopStocks,
	"create_shop_stock":       CreateShopInventory,
	"update_shop_stock_price": UpdateShopInventoryPrice,

	// movements
	"get_stock_movements":          GetStockMovements,
	"create_stock_movement":        CreateStockMovement,
	"update_stock_movement":        UpdateStockMovement,
	"delete_stock_movement":        DeleteStockMovement,
	"update_stock_movement_status": UpdateMovementStatus,

	"get_stock_movement_items":   GetStockMovementItems,
	"create_stock_movement_item": CreateStockMovementItem,
	"delete_stock_movement_item": DeleteStockMovementItem,

	// for select
	"get_roles_for_select":      GetRolesForSelect,
	"get_merchants_for_select":  GetMerchantsForSelect,
	"get_products_for_select":   GetProductsForSelect,
	"get_warehouses_for_select": GetWarehousesForSelect,
	"get_shops_for_select":      GetShopsForSelect,
}
