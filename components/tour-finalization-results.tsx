"use client"

import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, 
  Download, 
  Printer, 
  ExternalLink, 
  Package, 
  ShoppingCart, 
  Users, 
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  ArrowRight
} from "lucide-react"

interface FinalizationResult {
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
  selectedWorkflows: string[]
  selectedSkus: string[]
  participantCount: number
  participants?: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    company?: string
    title?: string
  }>
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
    created_at: string
  }
  instructions: string
}

interface TourFinalizationResultsProps {
  isOpen: boolean
  onClose: () => void
  result: FinalizationResult | null
}

export function TourFinalizationResults({ isOpen, onClose, result }: TourFinalizationResultsProps) {
  if (!result) return null

  const handlePrint = () => {
    window.print()
  }

  const handleSavePDF = () => {
    // This will trigger the browser's print dialog with PDF option
    window.print()
  }

  const workflowLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    'standard_receiving': { 
      label: 'Standard Receiving (STD_REC)', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-green-100 text-green-800 border-green-200' 
    },
    'multi_item_batch': { 
      label: 'Multi-Item Batch (MIB)', 
      icon: <ShoppingCart className="h-4 w-4" />, 
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    'pack_to_light': { 
      label: 'Pack to Light (P2L)', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    'single_item_batch': { 
      label: 'Single-Item Batch (SIB)', 
      icon: <ShoppingCart className="h-4 w-4" />, 
      color: 'bg-orange-100 text-orange-800 border-orange-200' 
    },
    'bulk_shipping': { 
      label: 'Bulk Shipping (BSHIP)', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-red-100 text-red-800 border-red-200' 
    },
    // Workflow prefixes for display
    'R2L': { 
      label: 'Receive-to-Light', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-green-100 text-green-800 border-green-200' 
    },
    'STD_REC': { 
      label: 'Standard Receiving', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-green-100 text-green-800 border-green-200' 
    },
    'p2l': { 
      label: 'Pack-to-Light', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-blue-100 text-blue-800 border-blue-200' 
    },
    'mib': { 
      label: 'Multi-Item Batch', 
      icon: <ShoppingCart className="h-4 w-4" />, 
      color: 'bg-purple-100 text-purple-800 border-purple-200' 
    },
    'sib': { 
      label: 'Single-Item Batch', 
      icon: <ShoppingCart className="h-4 w-4" />, 
      color: 'bg-orange-100 text-orange-800 border-orange-200' 
    },
    'bship': { 
      label: 'Bulk Shipping', 
      icon: <Package className="h-4 w-4" />, 
      color: 'bg-red-100 text-red-800 border-red-200' 
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="print:mb-6">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Tour Finalized Successfully
          </DialogTitle>
          <DialogDescription>
            Your tour has been finalized with all selected workflows. Review the instructions below and print or save for reference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 print:space-y-4">
          {/* Tour Overview */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Tour Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>{(() => {
                    const [year, month, day] = result.tourDate.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    return date.toLocaleDateString();
                  })()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Time:</span>
                  <span>{result.tourTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Warehouse:</span>
                  <span>{result.warehouseName} ({result.warehouseCode})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Participants:</span>
                  <span>{result.participantCount}</span>
                </div>
              </div>
              
              {result.tourNumericId && (
                <div className="pt-2">
                  <span className="text-sm font-medium">Tour ID:</span>
                  <span className="ml-2 text-sm font-mono">{result.tourNumericId}</span>
                  <a 
                    href={`https://app.shiphero.com/dashboard/orders/v2/manage?tags=tour-${result.tourNumericId}&start_date=${encodeURIComponent(new Date(Date.now() - 86400000).toLocaleDateString('en-US'))}&preselectedDate=custom&end_date=${encodeURIComponent(new Date(Date.now() + 604800000).toLocaleDateString('en-US'))}&fulfillment_status=unfulfilled`}
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
                <span className="ml-2 text-sm">{result.hostName}</span>
                {result.hostEmail && (
                  <span className="ml-2 text-sm text-muted-foreground">({result.hostEmail})</span>
                )}
              </div>
              <div className="pt-2">
                <span className="text-sm font-medium">Address:</span>
                <span className="ml-2 text-sm text-muted-foreground">{result.warehouseAddress}</span>
              </div>
              
              {result.summary && (
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-lg">{result.summary.total_orders}</div>
                      <div className="text-muted-foreground">Total Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-lg">{result.summary.total_sales_orders}</div>
                      <div className="text-muted-foreground">Sales Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-lg">{result.summary.total_purchase_orders}</div>
                      <div className="text-muted-foreground">Purchase Orders</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Workflows */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-4">
              <CardTitle>Selected Training Workflows</CardTitle>
              <CardDescription>
                The following workflows have been set up with corresponding orders in ShipHero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.selectedWorkflows.map((workflow) => {
                  const workflowInfo = workflowLabels[workflow]
                  return (
                    <Badge
                      key={workflow}
                      variant="outline"
                      className={`${workflowInfo?.color || 'bg-gray-100 text-gray-800'} flex items-center gap-1 px-3 py-1`}
                    >
                      {workflowInfo?.icon}
                      {workflowInfo?.label || workflow}
                    </Badge>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sales Orders */}
          {result.orders.sales_orders.length > 0 && (
            <Card className="print:shadow-none print:border-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Sales Orders Created ({result.orders.sales_orders.length})
                </CardTitle>
                <CardDescription>
                  Click order numbers to view individual orders in ShipHero
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.orders.sales_orders.map((order, index) => (
                  <div key={index} className="border rounded-lg p-4 print:border-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${workflowLabels[order.workflow]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {workflowLabels[order.workflow]?.label || order.workflow}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={`https://app.shiphero.com/dashboard/orders/details/${order.legacy_id}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-mono font-medium text-blue-600 hover:text-blue-800 underline"
                        >
                          {order.order_number}
                        </a>
                        <ExternalLink className="h-3 w-3 text-blue-600" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {order.recipient}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>ShipHero ID: {order.shiphero_id}</div>
                      <div>Legacy ID: {order.legacy_id}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Purchase Orders */}
          {result.orders.purchase_orders.length > 0 && (
            <Card className="print:shadow-none print:border-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Purchase Orders Created ({result.orders.purchase_orders.length})
                </CardTitle>
                <CardDescription>
                  Click PO numbers to view individual purchase orders in ShipHero
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.orders.purchase_orders.map((po, index) => (
                  <div key={index} className="border rounded-lg p-4 print:border-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={`text-xs ${workflowLabels[po.workflow]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {workflowLabels[po.workflow]?.label || po.workflow}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`https://app.shiphero.com/dashboard/purchase-orders/details/${po.legacy_id}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-mono font-medium text-blue-600 hover:text-blue-800 underline"
                      >
                        {po.po_number}
                      </a>
                      <ExternalLink className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>ShipHero ID: {po.shiphero_id}</div>
                      <div>Legacy ID: {po.legacy_id}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Selected SKUs */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-4">
              <CardTitle>Selected Products</CardTitle>
              <CardDescription>
                Products used across all training workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {result.selectedSkus.map((sku, index) => (
                  <div key={index} className="font-mono text-xs bg-gray-50 px-2 py-1 rounded">
                    {sku}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Training Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-gray-50 p-4 rounded-lg print:bg-white print:border">
                {result.instructions}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons - Hidden in print */}
          <div className="flex gap-3 pt-4 print:hidden">
            <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print Instructions
            </Button>
            <Button onClick={handleSavePDF} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Save as PDF
            </Button>
            <Button
              onClick={() => window.open('https://public-api.shiphero.com', '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open ShipHero
            </Button>
            <Button onClick={onClose} className="ml-auto">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
