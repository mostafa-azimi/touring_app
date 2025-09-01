/**
 * Utility functions for generating ShipHero order names according to custom conventions
 */

/**
 * Generate sales order name: participant first letter of first name, first three of last name, underscore, warehouse, underscore, date
 * Example: J_Smi_warehouse1_2025-09-01
 */
export function generateSalesOrderName(
  participantFirstName: string,
  participantLastName: string,
  warehouseName: string,
  date: Date = new Date()
): string {
  const firstInitial = participantFirstName.charAt(0).toUpperCase()
  const lastThree = participantLastName.substring(0, 3).toLowerCase()
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
  
  // Clean warehouse name (remove spaces, special chars)
  const cleanWarehouse = warehouseName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  
  return `${firstInitial}_${lastThree}_${cleanWarehouse}_${dateStr}`
}

/**
 * Generate purchase order name: last name of the host, underscore, date (mm/dd/yy), underscore, date
 * Example: Smith_09-01-25_2025-09-01
 */
export function generatePurchaseOrderName(
  hostLastName: string,
  date: Date = new Date()
): string {
  const cleanHostName = hostLastName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  
  // Format: MM/DD/YY
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  const shortDate = `${mm}-${dd}-${yy}`
  
  // Full date: YYYY-MM-DD
  const fullDate = date.toISOString().split('T')[0]
  
  return `${cleanHostName}_${shortDate}_${fullDate}`
}

/**
 * Generate unique order number for sales orders
 * Format: SO-{timestamp}-{random}
 */
export function generateSalesOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `SO-${timestamp}-${random}`
}

/**
 * Generate unique purchase order number
 * Format: PO-{timestamp}-{random}
 */
export function generatePurchaseOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `PO-${timestamp}-${random}`
}
