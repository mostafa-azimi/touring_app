"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface SwagItem {
  id: string
  name: string
  sku?: string
  vendor_id?: string
  quantity: number
  created_at: string
}

export function SwagItemsTab() {
  const [swagItems, setSwagItems] = useState<SwagItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SwagItem | null>(null)
  const [formData, setFormData] = useState({ name: "", sku: "", vendor_id: "", quantity: "" })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchSwagItems()
  }, [])

  const fetchSwagItems = async () => {
    try {
      const { data, error } = await supabase.from("swag_items").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setSwagItems(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch swag items",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const submitData = {
        name: formData.name,
        sku: formData.sku || null,
        vendor_id: formData.vendor_id || null,
        quantity: Number.parseInt(formData.quantity),
      }

      // Debug: Log the form data being submitted
      console.log("Submitting swag item data:", submitData)

      if (editingItem) {
        const { error } = await supabase.from("swag_items").update(submitData).eq("id", editingItem.id)
        if (error) {
          console.error("Swag item update error:", error)
          throw error
        }
        toast({ title: "Success", description: "Swag item updated successfully" })
      } else {
        const { error } = await supabase.from("swag_items").insert([submitData])
        if (error) {
          console.error("Swag item insert error:", error)
          throw error
        }
        toast({ title: "Success", description: "Swag item created successfully" })
      }

      setFormData({ name: "", sku: "", vendor_id: "", quantity: "" })
      setEditingItem(null)
      setIsDialogOpen(false)
      fetchSwagItems()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save swag item",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (item: SwagItem) => {
    setEditingItem(item)
    setFormData({ 
      name: item.name, 
      sku: item.sku || "",
      vendor_id: item.vendor_id || "",
      quantity: item.quantity.toString() 
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this swag item?")) return

    try {
      const { error } = await supabase.from("swag_items").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Success", description: "Swag item deleted successfully" })
      fetchSwagItems()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete swag item",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({ name: "", sku: "", vendor_id: "", quantity: "" })
    setEditingItem(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Swag Items</h3>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Swag Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Swag Item" : "Add New Swag Item"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the swag item information." : "Add a new swag item to inventory."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Company T-Shirt"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="TSH-001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vendor_id">Vendor ID</Label>
                    <Input
                      id="vendor_id"
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                      placeholder="VND-123"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="100"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : editingItem ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Vendor ID</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading swag items...
                </TableCell>
              </TableRow>
            ) : swagItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No swag items found. Add your first swag item to get started.
                </TableCell>
              </TableRow>
            ) : (
              swagItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sku || '-'}</TableCell>
                  <TableCell>{item.vendor_id || '-'}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
