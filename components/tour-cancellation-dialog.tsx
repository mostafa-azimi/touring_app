"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, X, CheckCircle, XCircle } from "lucide-react"

interface TourCancellationDialogProps {
  isOpen: boolean
  onClose: () => void
  tourId: string
  tourTitle: string
  onCancellationComplete: () => void
}

interface CancellationResult {
  success: boolean
  message: string
  data?: {
    tourId: string
    canceledAt: string
    canceledOrders: number
    canceledPurchaseOrders: number
    errors?: string[]
    partialSuccess?: boolean
  }
}

export function TourCancellationDialog({ 
  isOpen, 
  onClose, 
  tourId, 
  tourTitle,
  onCancellationComplete 
}: TourCancellationDialogProps) {
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancellationResult, setCancellationResult] = useState<CancellationResult | null>(null)
  const { toast } = useToast()

  const handleCancel = async () => {
    setIsCanceling(true)
    setCancellationResult(null)

    try {
      console.log(`🚫 Initiating tour cancellation: ${tourId}`)
      
      const response = await fetch(`/api/tours/${tourId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      setCancellationResult(result)

      if (result.success) {
        console.log(`✅ Tour cancellation successful:`, result)
        
        toast({
          title: "Tour Canceled",
          description: `Successfully canceled ${result.data.canceledOrders + result.data.canceledPurchaseOrders} orders`,
        })
        
        // Call completion callback to refresh the tours list
        onCancellationComplete()
        
        // Auto-close after 2 seconds on success
        setTimeout(() => {
          onClose()
          setCancellationResult(null)
        }, 2000)
        
      } else {
        console.error(`❌ Tour cancellation failed:`, result)
        
        toast({
          title: result.data?.partialSuccess ? "Partial Cancellation" : "Cancellation Failed",
          description: result.message,
          variant: result.data?.partialSuccess ? "default" : "destructive",
        })
      }

    } catch (error: any) {
      console.error('❌ Tour cancellation error:', error)
      
      setCancellationResult({
        success: false,
        message: 'Network error during cancellation'
      })
      
      toast({
        title: "Cancellation Error",
        description: "Failed to cancel tour due to network error",
        variant: "destructive",
      })
    } finally {
      setIsCanceling(false)
    }
  }

  const handleClose = () => {
    if (!isCanceling) {
      onClose()
      setCancellationResult(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Cancel Tour
          </DialogTitle>
          <DialogDescription>
            This will cancel all ShipHero orders and purchase orders associated with this tour.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Tour Details:</h4>
            <p className="text-sm text-muted-foreground">{tourTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {tourId}</p>
          </div>

          {cancellationResult && (
            <div className={`p-4 rounded-lg border ${
              cancellationResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {cancellationResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`font-medium ${
                  cancellationResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {cancellationResult.success ? 'Cancellation Successful' : 'Cancellation Issues'}
                </span>
              </div>
              
              <p className={`text-sm ${
                cancellationResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {cancellationResult.message}
              </p>

              {cancellationResult.data && (
                <div className="mt-2 space-y-1">
                  {cancellationResult.data.canceledOrders > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ✅ Canceled {cancellationResult.data.canceledOrders} sales orders
                    </p>
                  )}
                  {cancellationResult.data.canceledPurchaseOrders > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ✅ Canceled {cancellationResult.data.canceledPurchaseOrders} purchase orders
                    </p>
                  )}
                  {cancellationResult.data.errors && cancellationResult.data.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-700">Errors:</p>
                      {cancellationResult.data.errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">• {error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!cancellationResult && (
            <div className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <p className="font-medium text-yellow-800 mb-1">⚠️ Warning:</p>
              <ul className="space-y-1 text-yellow-700">
                <li>• This action cannot be undone</li>
                <li>• All associated orders will be canceled in ShipHero</li>
                <li>• Inventory allocations will be released</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isCanceling}
          >
            <X className="h-4 w-4 mr-2" />
            {cancellationResult?.success ? 'Close' : 'Cancel'}
          </Button>
          
          {!cancellationResult && (
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Canceling...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Cancel Tour
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
