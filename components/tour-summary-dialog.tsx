"use client"

import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  ExternalLink, 
  Package, 
  ShoppingCart, 
  Users, 
  MapPin,
  Calendar,
  Clock,
  CheckCircle
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
  summary?: {
    total_orders: number
    total_sales_orders: number
    total_purchase_orders: number
  }
}

interface TourSummaryDialogProps {
  isOpen: boolean
  onClose: () => void
  data: TourSummaryData | null
}

export function TourSummaryDialog({ isOpen, onClose, data }: TourSummaryDialogProps) {
  if (!data) return null

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const workflowLabels: Record<string, { label: string; color: string }> = {
    'bship': { label: 'Bulk Shipping', color: 'bg-red-100 text-red-800 border-red-200' },
    'sib': { label: 'Single Item Batch', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    'mib': { label: 'Multi Item Batch', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    'p2l': { label: 'Pack to Light', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    'STD_REC': { label: 'Standard Receiving', color: 'bg-green-100 text-green-800 border-green-200' },
    'R2L': { label: 'Receive to Light', color: 'bg-green-100 text-green-800 border-green-200' }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Tour Summary
          </DialogTitle>
          <DialogDescription>
            Complete tour details and order information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tour Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Tour Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(data.tourDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Time:</span>
                  <span>{data.tourTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Warehouse:</span>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.warehouseAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {data.warehouseName} ({data.warehouseCode})
                  </a>
                  <ExternalLink className="h-3 w-3 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Participants:</span>
                  <span>{data.participantCount}</span>
                </div>
              </div>
              
              {data.tourNumericId && (
                <div className="pt-2">
                  <span className="text-sm font-medium">Tour ID:</span>
                  <span className="ml-2 text-sm font-mono">{data.tourNumericId}</span>
                  <a 
                    href={`https://app.shiphero.com/dashboard/orders/v2/manage?tags=tour-${data.tourNumericId}&start_date=${encodeURIComponent(new Date(Date.now() - 86400000).toLocaleDateString('en-US'))}&preselectedDate=custom&end_date=${encodeURIComponent(new Date(Date.now() + 604800000).toLocaleDateString('en-US'))}&fulfillment_status=unfulfilled`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    View All Orders in ShipHero →
                  </a>
                </div>
              )}
              
              <div className="pt-2">
                <span className="text-sm font-medium">Host:</span>
                <span className="ml-2 text-sm">{data.hostName}</span>
                {data.hostEmail && (
                  <span className="ml-2 text-sm text-muted-foreground">({data.hostEmail})</span>
                )}
              </div>
              
              {data.summary && (
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-2xl text-blue-600">{data.summary.total_orders}</div>
                      <div className="text-muted-foreground">Total Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-2xl text-green-600">{data.summary.total_sales_orders}</div>
                      <div className="text-muted-foreground">Sales Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-2xl text-purple-600">{data.summary.total_purchase_orders}</div>
                      <div className="text-muted-foreground">Purchase Orders</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders by Workflow */}
          {(data.orders.sales_orders.length > 0 || data.orders.purchase_orders.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Orders by Workflow
                </CardTitle>
                <CardDescription>
                  Click order numbers to view in ShipHero
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  // Group all orders by workflow
                  const ordersByWorkflow: Record<string, { sales: typeof data.orders.sales_orders, purchase: typeof data.orders.purchase_orders }> = {}
                  
                  // Group sales orders
                  data.orders.sales_orders.forEach(order => {
                    if (!ordersByWorkflow[order.workflow]) {
                      ordersByWorkflow[order.workflow] = { sales: [], purchase: [] }
                    }
                    ordersByWorkflow[order.workflow].sales.push(order)
                  })
                  
                  // Group purchase orders
                  data.orders.purchase_orders.forEach(po => {
                    if (!ordersByWorkflow[po.workflow]) {
                      ordersByWorkflow[po.workflow] = { sales: [], purchase: [] }
                    }
                    ordersByWorkflow[po.workflow].purchase.push(po)
                  })
                  
                  return Object.entries(ordersByWorkflow).map(([workflow, orders]) => (
                    <div key={workflow} className="space-y-3">
                      {/* Workflow Heading */}
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Badge variant="outline" className={`${workflowLabels[workflow]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {workflowLabels[workflow]?.label || workflow}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ({orders.sales.length + orders.purchase.length} orders)
                        </span>
                      </div>
                      
                      {/* Sales Orders for this workflow */}
                      {orders.sales.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                            <ShoppingCart className="h-4 w-4" />
                            Sales Orders ({orders.sales.length})
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                            {orders.sales.map((order, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                                <a 
                                  href={`https://app.shiphero.com/dashboard/orders/details/${order.legacy_id}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                                >
                                  {order.order_number}
                                </a>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    {order.recipient.replace(' (extra)', '')}
                                  </span>
                                  <ExternalLink className="h-3 w-3 text-blue-600" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Purchase Orders for this workflow */}
                      {orders.purchase.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                            <Package className="h-4 w-4" />
                            Purchase Orders ({orders.purchase.length})
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                            {orders.purchase.map((po, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                                <a 
                                  href={`https://app.shiphero.com/dashboard/purchase-orders/details/${po.legacy_id}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                                >
                                  {po.po_number}
                                </a>
                                <ExternalLink className="h-3 w-3 text-blue-600" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                })()}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
