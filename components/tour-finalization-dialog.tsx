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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { WorkflowOption } from "@/lib/shiphero/tour-finalization-service"

interface TourFinalizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinalize: (selectedOptions: WorkflowOption[]) => Promise<void>
  isLoading: boolean
  tourId: string
}

const workflowOptions = [
  {
    id: "standard_receiving" as WorkflowOption,
    name: "Standard Receiving",
    description: "Creates a dedicated purchase order with 6 specific SKUs for receiving workflow training",
    category: "Purchase Orders",
    badge: "Training"
  },
  {
    id: "bulk_shipping" as WorkflowOption,
    name: "Bulk Shipping",
    description: "Creates 10 sales orders with same SKU but different addresses for bulk shipping training",
    category: "Sales Orders",
    badge: "Training"
  },
  {
    id: "single_item_batch" as WorkflowOption,
    name: "Single-Item Batch",
    description: "Creates 5 single-item orders for batch picking training (SKUs can repeat)",
    category: "Sales Orders",
    badge: "Training"
  },
  {
    id: "multi_item_batch" as WorkflowOption,
    name: "Multi-Item Batch",
    description: "Creates 5 multi-item orders for complex batch picking training",
    category: "Sales Orders",
    badge: "Training"
  }
]

const categories = [
  "As-Is Workflows",
  "Purchase Orders", 
  "Sales Orders"
]

export function TourFinalizationDialog({
  open,
  onOpenChange,
  onFinalize,
  isLoading,
  tourId
}: TourFinalizationDialogProps) {
  const [selectedOptions, setSelectedOptions] = useState<WorkflowOption[]>([])

  const handleOptionChange = (optionId: WorkflowOption, checked: boolean) => {
    if (checked) {
      setSelectedOptions(prev => [...prev, optionId])
    } else {
      setSelectedOptions(prev => prev.filter(id => id !== optionId))
    }
  }

  const handleFinalize = async () => {
    if (selectedOptions.length === 0) return
    await onFinalize(selectedOptions)
    setSelectedOptions([])
  }

  const handleCancel = () => {
    setSelectedOptions([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalize Tour</DialogTitle>
          <DialogDescription>
            Select the workflows you want to create for this tour. Each workflow will generate specific orders in ShipHero for training purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map(category => {
            const categoryOptions = workflowOptions.filter(option => option.category === category)
            
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{category}</h4>
                  <Separator className="flex-1" />
                </div>
                
                <div className="space-y-3">
                  {categoryOptions.map(option => (
                    <div key={option.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                      <Checkbox
                        id={option.id}
                        checked={selectedOptions.includes(option.id)}
                        onCheckedChange={(checked) => handleOptionChange(option.id, checked as boolean)}
                        disabled={isLoading}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={option.id} className="font-medium cursor-pointer">
                            {option.name}
                          </Label>
                          <Badge variant={option.badge === "Original" ? "default" : "secondary"} className="text-xs">
                            {option.badge}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={selectedOptions.length === 0 || isLoading}
          >
            {isLoading ? "Finalizing..." : `Finalize with ${selectedOptions.length} workflow${selectedOptions.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
