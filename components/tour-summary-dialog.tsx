"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { 
  FileText, 
  ExternalLink, 
  Package, 
  ShoppingCart, 
  Users, 
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react"

interface TourSummaryData {
  tourId: string
  tourDate: string
  tourTime: string
  tourNumericId?: number
  status?: string
  warehouseName: string
  warehouseCode?: string
  warehouseAddress: string
  hostName: string
  hostEmail?: string
  participantCount: number
  orders: {
    sales_orders: Array<{
      workflow: string
      order_number: string
      shiphero_id: string
      legacy_id: string
      recipient: string
    }>
    purchase_orders: Array<{
      workflow: string
      po_number: string
      shiphero_id: string
      legacy_id: string
    }>
  }
  shipheroUrl?: string
}

interface TourSummaryDialogProps {
  isOpen: boolean
  onClose: () => void
  data: TourSummaryData
}

const workflowLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bulk_shipping: { 
    label: "Bulk Shipping", 
    icon: <Package className="h-4 w-4" />, 
    color: "bg-blue-100 text-blue-800" 
  },
  single_item_batch: { 
    label: "Single Item Batch", 
    icon: <ShoppingCart className="h-4 w-4" />, 
    color: "bg-green-100 text-green-800" 
  },
  multi_item_batch: { 
    label: "Multi Item Batch", 
    icon: <ShoppingCart className="h-4 w-4" />, 
    color: "bg-purple-100 text-purple-800" 
  },
  pack_to_light: { 
    label: "Pack to Light", 
    icon: <Package className="h-4 w-4" />, 
    color: "bg-orange-100 text-orange-800" 
  },
  standard_receiving: { 
    label: "Standard Receiving", 
    icon: <FileText className="h-4 w-4" />, 
    color: "bg-gray-100 text-gray-800" 
  },
  receive_to_light: { 
    label: "Receive to Light", 
    icon: <FileText className="h-4 w-4" />, 
    color: "bg-yellow-100 text-yellow-800" 
  }
}

export function TourSummaryDialog({ isOpen, onClose, data }: TourSummaryDialogProps) {
  const { toast } = useToast()
  const [isCanceling, setIsCanceling] = useState(false)
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [canceledWorkflows, setCanceledWorkflows] = useState<Set<string>>(new Set())
  const [canceledAllSales, setCanceledAllSales] = useState(false)
  const [canceledAllPurchase, setCanceledAllPurchase] = useState(false)
  const [progressStatus, setProgressStatus] = useState<{
    current: number
    total: number
    message: string
    logs: string[]
    errors: string[]
  }>({
    current: 0,
    total: 0,
    message: '',
    logs: [],
    errors: []
  })

  // Early return if data is null or undefined
  if (!data) {
    return null
  }

  // Helper functions for progress tracking
  const updateProgress = (message: string, logs: string[] = [], errors: string[] = [], incrementCounter: boolean = false) => {
    setProgressStatus(prev => ({
      ...prev,
      current: incrementCounter ? prev.current + 1 : prev.current,
      message,
      logs: [...prev.logs, ...logs],
      errors: [...prev.errors, ...errors]
    }))
  }

  const initializeProgress = (total: number, initialMessage: string) => {
    setProgressStatus({
      current: 0,
      total,
      message: initialMessage,
      logs: [],
      errors: []
    })
    setShowProgressDialog(true)
  }

  const completeProgress = (successCount: number, errorCount: number, orderType: string) => {
    const finalMessage = `🏁 COMPLETE: ${successCount} successful, ${errorCount} failed`
    setProgressStatus(prev => ({
      ...prev,
      message: finalMessage,
      logs: [...prev.logs, finalMessage]
    }))
    console.log(`🏁 CANCELLATION COMPLETE: ${successCount} successful, ${errorCount} failed`)
  }

  // Get access token from database (with localStorage fallback)
  const getAccessToken = async (): Promise<string> => {
    try {
      // Try database first
      const response = await fetch('/api/shiphero/access-token')
      if (response.ok) {
        const result = await response.json()
        console.log('✅ Using access token from database')
        return result.access_token
      }

      // Fallback to localStorage if database fails
      console.log('⚠️ Database failed, falling back to localStorage...')
      if (typeof window !== 'undefined') {
        const accessToken = localStorage.getItem('shiphero_access_token')
        if (accessToken) {
          console.log('✅ Using access token from localStorage fallback')
          return accessToken
        }
      }

      throw new Error('No valid access token available. Please refresh your tokens in Settings → ShipHero tab.')
    } catch (error) {
      console.error('Failed to get access token:', error)
      throw error
    }
  }

  // Cancel orders by workflow
  const cancelOrdersByWorkflow = async (workflow: string, orderType: 'sales' | 'purchase') => {
    try {
      setIsCanceling(true)
      const accessToken = await getAccessToken()

      let ordersToProcess
      if (orderType === 'sales') {
        ordersToProcess = (data.orders?.sales_orders || [])
          .filter(order => order.workflow === workflow)
          .map(order => ({ id: order.shiphero_id, legacy_id: order.legacy_id, order_number: order.order_number }))
      } else {
        ordersToProcess = (data.orders?.purchase_orders || [])
          .filter(order => order.workflow === workflow)
          .map(order => ({ id: order.shiphero_id, legacy_id: order.legacy_id, po_number: order.po_number }))
      }

      if (ordersToProcess.length === 0) {
        toast({
          title: "No Orders Found",
          description: `No ${orderType} orders found for ${workflow} workflow.`,
          variant: "destructive"
        })
        return
      }

      // Initialize progress tracking
      const workflowLabel = workflowLabels[workflow]?.label || workflow
      initializeProgress(ordersToProcess.length, `Processing ${workflowLabel} ${orderType} orders...`)

      let successCount = 0
      let errorCount = 0

      for (const order of ordersToProcess) {
        try {
          if (orderType === 'sales') {
            // For sales orders: Use order_cancel mutation
            updateProgress(`🔄 Canceling sales order ${order.order_number}...`)
            
            const cancelResponse = await fetch('/api/shiphero/cancel-orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                orders: [{ id: order.id, legacy_id: order.legacy_id }],
                type: 'sales',
                use_cancel_mutation: true // Use order_cancel mutation
              })
            })
            
            const cancelResult = await cancelResponse.json()
            if (cancelResult.success) {
              updateProgress(`✅ ${order.order_number}: Canceled`, [`✅ ${order.order_number}: Canceled`], [], true)
              successCount++
            } else {
              throw new Error(cancelResult.errors?.[0]?.error || 'Failed to cancel sales order')
            }
            
          } else {
            // For purchase orders: Use purchase_order_cancel mutation
            updateProgress(`🔄 Canceling purchase order ${order.po_number}...`)
            
            console.log(`🔍 CLIENT DEBUG: Canceling purchase order:`, {
              po_number: order.po_number,
              id: order.id,
              legacy_id: order.legacy_id,
              shiphero_id: order.shiphero_id,
              orderType,
              use_cancel_mutation: true,
              fullOrderObject: order
            })
            
            const response = await fetch('/api/shiphero/cancel-orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                orders: [{ id: order.shiphero_id, legacy_id: order.legacy_id }],
                type: orderType,
                use_cancel_mutation: true // Use purchase_order_cancel mutation
              })
            })
            
            console.log(`🔍 CLIENT DEBUG: API response status:`, response.status, response.statusText)

            const result = await response.json()
            console.log(`🔍 CLIENT DEBUG: API response result:`, result)
            
            if (result.success) {
              updateProgress(`✅ ${order.po_number}: Canceled`, [`✅ ${order.po_number}: Canceled`], [], true)
              successCount++
            } else {
              console.error(`❌ CLIENT DEBUG: Purchase order cancellation failed:`, result)
              console.error(`❌ CLIENT DEBUG: Specific error details:`, result.errors)
              const errorMessage = result.errors?.[0]?.error || 'Failed to cancel purchase order'
              console.error(`❌ CLIENT DEBUG: Error message:`, errorMessage)
              throw new Error(errorMessage)
            }
          }
        } catch (orderError: any) {
          const errorMessage = `❌ Error processing ${orderType} order ${order.order_number || order.po_number}: ${orderError.message}`
          updateProgress(`❌ Failed to process ${order.order_number || order.po_number}`, [], [errorMessage], true)
          console.error(errorMessage)
          errorCount++
        }
      }

      // Complete progress tracking
      completeProgress(successCount, errorCount, orderType)

      if (successCount === ordersToProcess.length) {
        // Mark this workflow as canceled
        setCanceledWorkflows(prev => new Set([...prev, `${orderType}-${workflow}`]))
        toast({
          title: "Orders Canceled",
          description: `Successfully canceled ${successCount} ${orderType} orders in ${workflow} workflow.`,
        })
      } else if (successCount > 0) {
        toast({
          title: "Partial Success",
          description: `Processed ${successCount}/${ordersToProcess.length} ${orderType} orders. ${errorCount} failed.`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Processing Failed",
          description: `Failed to process any ${orderType} orders. Please try again.`,
          variant: "destructive"
        })
      }

    } catch (error: any) {
      console.error('Error processing orders:', error)
      toast({
        title: "Processing Failed",
        description: "Failed to process orders. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsCanceling(false)
    }
  }

  // Cancel all orders of a specific type
  const cancelAllOrders = async (orderType: 'sales' | 'purchase') => {
    try {
      setIsCanceling(true)
      const accessToken = await getAccessToken()

      let ordersToProcess
      if (orderType === 'sales') {
        ordersToProcess = (data.orders?.sales_orders || []).map(order => ({ 
          id: order.shiphero_id, 
          legacy_id: order.legacy_id,
          order_number: order.order_number
        }))
      } else {
        ordersToProcess = (data.orders?.purchase_orders || []).map(order => ({ 
          id: order.shiphero_id, 
          legacy_id: order.legacy_id,
          po_number: order.po_number,
          shiphero_id: order.shiphero_id
        }))
      }

      if (ordersToProcess.length === 0) {
        toast({
          title: "No Orders Found",
          description: `No ${orderType} orders found to process.`,
          variant: "destructive"
        })
        return
      }

      let successCount = 0
      let errorCount = 0

      for (const order of ordersToProcess) {
        try {
          if (orderType === 'sales') {
            // For sales orders: Use order_cancel mutation
            console.log(`🔄 Canceling sales order: ${order.order_number}`)
            
            const cancelResponse = await fetch('/api/shiphero/cancel-orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                orders: [{ id: order.id, legacy_id: order.legacy_id }],
                type: 'sales',
                use_cancel_mutation: true // Use order_cancel mutation
              })
            })
            
            const cancelResult = await cancelResponse.json()
            if (cancelResult.success) {
              console.log(`✅ Successfully canceled sales order: ${order.order_number}`)
              successCount++
            } else {
              throw new Error(cancelResult.errors?.[0]?.error || 'Failed to cancel sales order')
            }
            
          } else {
            // For purchase orders: Use purchase_order_cancel mutation
            console.log(`🔍 CLIENT DEBUG (cancelAll): Canceling purchase order:`, {
              po_number: order.po_number,
              id: order.id,
              legacy_id: order.legacy_id,
              orderType,
              use_cancel_mutation: true
            })
            
            const response = await fetch('/api/shiphero/cancel-orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                orders: [order],
                type: orderType,
                use_cancel_mutation: true // Use purchase_order_cancel mutation
              })
            })
            
            console.log(`🔍 CLIENT DEBUG (cancelAll): API response status:`, response.status, response.statusText)

            const result = await response.json()
            console.log(`🔍 CLIENT DEBUG (cancelAll): API response result:`, result)
            
            if (result.success) {
              console.log(`✅ Successfully canceled purchase order: ${order.po_number}`)
              successCount++
            } else {
              console.error(`❌ CLIENT DEBUG (cancelAll): Purchase order cancellation failed:`, result)
              console.error(`❌ CLIENT DEBUG (cancelAll): Specific error details:`, result.errors)
              const errorMessage = result.errors?.[0]?.error || 'Failed to cancel purchase order'
              console.error(`❌ CLIENT DEBUG (cancelAll): Error message:`, errorMessage)
              throw new Error(errorMessage)
            }
          }
        } catch (orderError: any) {
          console.error(`❌ Error processing ${orderType} order ${order.order_number || order.po_number}:`, orderError)
          errorCount++
        }
      }

      if (successCount === ordersToProcess.length) {
        // Mark all orders of this type as canceled
        if (orderType === 'sales') {
          setCanceledAllSales(true)
        } else {
          setCanceledAllPurchase(true)
        }
        toast({
          title: "All Orders Canceled",
          description: `Successfully canceled all ${successCount} ${orderType} orders.`,
        })
      } else if (successCount > 0) {
        toast({
          title: "Partial Success",
          description: `Processed ${successCount}/${ordersToProcess.length} ${orderType} orders. ${errorCount} failed.`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Processing Failed",
          description: `Failed to process any ${orderType} orders. Please try again.`,
          variant: "destructive"
        })
      }

    } catch (error: any) {
      console.error('Error canceling orders:', error)
      toast({
        title: "Processing Failed",
        description: "Failed to process orders. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsCanceling(false)
    }
  }

  // Group orders by workflow (with null checks)
  const salesOrdersByWorkflow = (data.orders?.sales_orders || []).reduce((acc, order) => {
    if (!acc[order.workflow]) acc[order.workflow] = []
    acc[order.workflow].push(order)
    return acc
  }, {} as Record<string, typeof data.orders.sales_orders>)

  const purchaseOrdersByWorkflow = (data.orders?.purchase_orders || []).reduce((acc, order) => {
    if (!acc[order.workflow]) acc[order.workflow] = []
    acc[order.workflow].push(order)
    return acc
  }, {} as Record<string, typeof data.orders.purchase_orders>)

  // Create Google Maps URL
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.warehouseAddress)}`

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Tour Summary
            </DialogTitle>
            <DialogDescription>
              Complete details and order information for this tour
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Tour Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tour Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <Calendar className="h-4 w-4" />
                      Date
                    </div>
                    <div className="text-lg">{data.tourDate}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <Clock className="h-4 w-4" />
                      Time
                    </div>
                    <div className="text-lg">{data.tourTime}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <MapPin className="h-4 w-4" />
                    Warehouse
                  </div>
                  <div className="text-lg">
                    <a 
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {data.warehouseName}
                    </a>
                  </div>
                  <div className="text-sm text-gray-600">{data.warehouseAddress}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <Users className="h-4 w-4" />
                      Host
                    </div>
                    <div className="text-lg">{data.hostName}</div>
                    {data.hostEmail && <div className="text-sm text-gray-600">{data.hostEmail}</div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <Users className="h-4 w-4" />
                      Participants
                    </div>
                    <div className="text-lg">{data.participantCount}</div>
                  </div>
                </div>

                {data.shipheroUrl && (
                  <div>
                    <Button asChild variant="outline" className="w-full">
                      <a href={data.shipheroUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View All Orders in ShipHero
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sales Orders */}
            {(data.orders?.sales_orders?.length || 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Sales Orders ({data.orders?.sales_orders?.length || 0})
                  </CardTitle>
                  <CardDescription>
                    Fulfillment workflow orders for tour participants
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(salesOrdersByWorkflow).map(([workflow, orders]) => (
                    <div key={workflow} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-3">
                          <Badge className={workflowLabels[workflow]?.color || "bg-gray-100 text-gray-800"}>
                            {workflowLabels[workflow]?.icon}
                            <span className="ml-1">{workflowLabels[workflow]?.label || workflow}</span>
                          </Badge>
                          <span className="text-sm font-medium text-gray-700">({orders.length} orders)</span>
                        </div>
                        <Button
                          size="sm"
                          variant={canceledWorkflows.has(`sales-${workflow}`) ? "secondary" : "destructive"}
                          onClick={() => cancelOrdersByWorkflow(workflow, 'sales')}
                          disabled={isCanceling || canceledWorkflows.has(`sales-${workflow}`)}
                        >
                          {canceledWorkflows.has(`sales-${workflow}`) ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Canceled
                            </>
                          ) : isCanceling ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Canceling...
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              Cancel All
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {/* Table-like layout for orders */}
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                          <div>Order Number</div>
                          <div>Recipient</div>
                        </div>
                        {orders.map((order) => (
                          <div key={order.order_number} className="grid grid-cols-2 gap-4 p-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-b-0">
                            <div>
                              <a
                                href={`https://app.shiphero.com/dashboard/orders/details/${order.legacy_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {order.order_number}
                              </a>
                            </div>
                            <div className="text-sm text-gray-600">
                              {order.recipient.replace(' (extra)', '')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {(data.orders?.sales_orders?.length || 0) > 0 && (
                    <div className="pt-4 border-t">
                      <Button
                        variant={canceledAllSales ? "secondary" : "destructive"}
                        onClick={() => cancelAllOrders('sales')}
                        disabled={isCanceling || canceledAllSales}
                        className="w-full"
                      >
                        {canceledAllSales ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            All Sales Orders Canceled
                          </>
                        ) : isCanceling ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Canceling All Sales Orders...
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel All Sales Orders
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Purchase Orders */}
            {(data.orders?.purchase_orders?.length || 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Purchase Orders ({data.orders?.purchase_orders?.length || 0})
                  </CardTitle>
                  <CardDescription>
                    Inbound workflow orders for inventory receiving
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(purchaseOrdersByWorkflow).map(([workflow, orders]) => (
                    <div key={workflow} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-3">
                          <Badge className={workflowLabels[workflow]?.color || "bg-gray-100 text-gray-800"}>
                            {workflowLabels[workflow]?.icon}
                            <span className="ml-1">{workflowLabels[workflow]?.label || workflow}</span>
                          </Badge>
                          <span className="text-sm font-medium text-gray-700">({orders.length} orders)</span>
                        </div>
                        <Button
                          size="sm"
                          variant={canceledWorkflows.has(`purchase-${workflow}`) ? "secondary" : "destructive"}
                          onClick={() => cancelOrdersByWorkflow(workflow, 'purchase')}
                          disabled={isCanceling || canceledWorkflows.has(`purchase-${workflow}`)}
                        >
                          {canceledWorkflows.has(`purchase-${workflow}`) ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Canceled
                            </>
                          ) : isCanceling ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Canceling...
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              Cancel All
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {/* Table-like layout for purchase orders */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                          Purchase Order Number
                        </div>
                        {orders.map((order) => (
                          <div key={order.po_number} className="p-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-b-0">
                            <a
                              href={`https://app.shiphero.com/dashboard/purchase-orders/details/${order.legacy_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {order.po_number}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {(data.orders?.purchase_orders?.length || 0) > 0 && (
                    <div className="pt-4 border-t">
                      <Button
                        variant={canceledAllPurchase ? "secondary" : "destructive"}
                        onClick={() => cancelAllOrders('purchase')}
                        disabled={isCanceling || canceledAllPurchase}
                        className="w-full"
                      >
                        {canceledAllPurchase ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            All Purchase Orders Canceled
                          </>
                        ) : isCanceling ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Canceling All Purchase Orders...
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel All Purchase Orders
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      {showProgressDialog && (
        <Dialog open={showProgressDialog} onOpenChange={() => setShowProgressDialog(false)}>
          <DialogContent className="max-w-2xl w-[90vw] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {progressStatus.current === progressStatus.total ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                )}
                {progressStatus.current === progressStatus.total ? "Processing Complete" : "Processing Orders"}
              </DialogTitle>
              <DialogDescription>
                {progressStatus.current === progressStatus.total 
                  ? "All order cancellations have been processed."
                  : "Please wait while we process the order cancellations..."
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-gray-600">
                  {progressStatus.current} / {progressStatus.total}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progressStatus.current === progressStatus.total 
                      ? 'bg-green-600' 
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${(progressStatus.current / progressStatus.total) * 100}%` }}
                />
              </div>

              <div className="text-sm text-gray-600">
                {progressStatus.message}
              </div>

              {progressStatus.logs.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded text-sm font-mono">
                  {progressStatus.logs.map((log, index) => (
                    <div key={index} className="text-green-600">{log}</div>
                  ))}
                  {progressStatus.errors.map((error, index) => (
                    <div key={index} className="text-red-600">{error}</div>
                  ))}
                </div>
              )}

              {progressStatus.current === progressStatus.total && (
                <div className="pt-2">
                  <Button 
                    onClick={() => setShowProgressDialog(false)} 
                    className="w-full"
                    variant="default"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Done
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}