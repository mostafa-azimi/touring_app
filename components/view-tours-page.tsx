"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Eye, Search, Calendar, MapPin, Users, Package, ChevronLeft, ChevronRight, ShoppingCart, FileText, Edit, X, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { ShipHeroOrderService } from "@/lib/shiphero/order-service"

interface Tour {
  id: string
  date: string
  time: string
  notes: string | null
  status?: string
  created_at: string
  warehouse: {
    id: string
    name: string
    code?: string
    address: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  participants: Array<{
    id: string
    name: string
    email: string
    company: string | null
    title: string | null
  }>
  swag_allocations: Array<{
    id: string
    quantity: number
    participant: {
      name: string
      email: string
    }
    swag_item: {
      name: string
    }
  }>
}

const ITEMS_PER_PAGE = 10

export function ViewToursPage() {
  const [tours, setTours] = useState<Tour[]>([])
  const [filteredTours, setFilteredTours] = useState<Tour[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchTours()
  }, [])

  useEffect(() => {
    // Filter tours based on search term
    if (!searchTerm.trim()) {
      setFilteredTours(tours)
    } else {
      const filtered = tours.filter(
        (tour) =>
          tour.warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tour.participants.some(
            (p) =>
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.email.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      )
      setFilteredTours(filtered)
    }
    setCurrentPage(1) // Reset to first page when searching
  }, [searchTerm, tours])

  const fetchTours = async () => {
    try {
      const { data, error } = await supabase
        .from("tours")
        .select(
          `
          id,
          date,
          time,
          notes,
          status,
          created_at,
          warehouse:warehouses(id, name, code, address, address2, city, state, zip, country),
          participants:tour_participants(id, name, email, company, title),
          swag_allocations:tour_swag_allocations(
            id,
            quantity,
            participant:tour_participants(name, email),
            swag_item:swag_items(name)
          )
        `,
        )
        .order("date", { ascending: false })
        .order("time", { ascending: false })

      if (error) throw error
      // Fix: Supabase returns warehouse, participants, swag_allocations as arrays due to the select syntax.
      // We need to flatten those to objects/arrays as expected by the Tour type.
      setTours(
        (data || []).map((tour: any) => ({
          ...tour,
          warehouse: Array.isArray(tour.warehouse) ? tour.warehouse[0] : tour.warehouse,
          participants: Array.isArray(tour.participants) ? tour.participants : [],
          swag_allocations: Array.isArray(tour.swag_allocations)
            ? tour.swag_allocations.map((alloc: any) => ({
                ...alloc,
                participant: Array.isArray(alloc.participant) ? alloc.participant[0] : alloc.participant,
                swag_item: Array.isArray(alloc.swag_item) ? alloc.swag_item[0] : alloc.swag_item,
              }))
            : [],
        }))
      )
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tours",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleValidateTour = async (tourId: string) => {
    try {
      // Update tour status to validated
      const { error: updateError } = await supabase
        .from('tours')
        .update({ status: 'validated' })
        .eq('id', tourId)

      if (updateError) {
        throw updateError
      }

      // Create both sales orders and purchase order
      const orderService = new ShipHeroOrderService()
      const [salesResult, poResult] = await Promise.all([
        orderService.createSalesOrdersForTour(tourId),
        orderService.createPurchaseOrderForTour(tourId)
      ])

      if (salesResult.success && poResult.success) {
        toast({
          title: "Tour Validated Successfully!",
          description: `Created ${salesResult.ordersCreated} sales orders and 1 purchase order`,
        })
        // Refresh tours to show updated status
        fetchTours()
      } else {
        const errors = [...(salesResult.errors || []), ...(poResult.errors || [])]
        toast({
          title: "Tour Validated with Errors",
          description: `Tour validated but some orders failed: ${errors.join(', ')}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error validating tour:', error)
      toast({
        title: "Error",
        description: "Failed to validate tour",
        variant: "destructive",
      })
    }
  }

  const handleCancelTour = async (tourId: string) => {
    if (!confirm('Are you sure you want to cancel this tour? This action cannot be undone.')) {
      return
    }

    try {
      // Update tour status to cancelled
      const { error: updateError } = await supabase
        .from('tours')
        .update({ status: 'cancelled' })
        .eq('id', tourId)

      if (updateError) {
        throw updateError
      }

      toast({
        title: "Tour Cancelled",
        description: "The tour has been cancelled successfully",
      })
      // Refresh tours to show updated status
      fetchTours()
    } catch (error) {
      console.error('Error cancelling tour:', error)
      toast({
        title: "Error",
        description: "Failed to cancel tour",
        variant: "destructive",
      })
    }
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredTours.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentTours = filteredTours.slice(startIndex, endIndex)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            View Tours
          </CardTitle>
          <CardDescription>Browse and manage existing warehouse tours</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by warehouse or participant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredTours.length} tour{filteredTours.length !== 1 ? "s" : ""} found
            </div>
          </div>

          {/* Tours Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Swag Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading tours...
                    </TableCell>
                  </TableRow>
                ) : currentTours.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No tours match your search criteria." : "No tours scheduled yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentTours.map((tour) => (
                    <TableRow key={tour.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{formatDate(tour.date)}</div>
                          <div className="text-sm text-muted-foreground">{formatTime(tour.time)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tour.warehouse.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {tour.warehouse.address}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Users className="h-3 w-3" />
                          {tour.participants.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Package className="h-3 w-3" />
                          {tour.swag_allocations.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={tour.status === 'validated' ? 'default' : tour.status === 'cancelled' ? 'destructive' : 'secondary'}
                          className="capitalize"
                        >
                          {tour.status || 'draft'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedTour(tour)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="w-[600px] sm:max-w-[600px]">
                              <TourDetailsSheet tour={tour} />
                            </SheetContent>
                          </Sheet>
                          
                          <Button variant="ghost" size="sm" title="Edit Tour">
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button variant="ghost" size="sm" title="Validate Tour" onClick={() => handleValidateTour(tour.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          
                          <Button variant="ghost" size="sm" title="Cancel Tour" onClick={() => handleCancelTour(tour.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredTours.length)} of {filteredTours.length} tours
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TourDetailsSheet({ tour }: { tour: Tour }) {
  const [isCreatingOrders, setIsCreatingOrders] = useState(false)
  const [isCreatingPO, setIsCreatingPO] = useState(false)
  const [isValidatingTour, setIsValidatingTour] = useState(false)
  const [isCancellingTour, setIsCancellingTour] = useState(false)
  const { toast } = useToast()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const handleCreateSalesOrders = async () => {
    setIsCreatingOrders(true)
    try {
      const orderService = new ShipHeroOrderService()
      const result = await orderService.createSalesOrdersForTour(tour.id)
      
      if (result.success) {
        toast({
          title: "Sales Orders Created",
          description: result.message,
        })
      } else {
        toast({
          title: "Failed to Create Sales Orders",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create sales orders. Please check your ShipHero configuration.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingOrders(false)
    }
  }

  const handleCreatePurchaseOrder = async () => {
    setIsCreatingPO(true)
    try {
      const orderService = new ShipHeroOrderService()
      const result = await orderService.createPurchaseOrderForTour(tour.id)
      
      if (result.success) {
        toast({
          title: "Purchase Order Created",
          description: result.message,
        })
      } else {
        toast({
          title: "Failed to Create Purchase Order",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create purchase order. Please check your ShipHero configuration.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingPO(false)
    }
  }

  const handleValidateTour = async () => {
    setIsValidatingTour(true)
    try {
      const supabase = createClient()
      
      // Update tour status to validated
      const { error: updateError } = await supabase
        .from('tours')
        .update({ status: 'validated' })
        .eq('id', tour.id)

      if (updateError) {
        throw updateError
      }

      // Create both sales orders and purchase order
      const orderService = new ShipHeroOrderService()
      const [salesResult, poResult] = await Promise.all([
        orderService.createSalesOrdersForTour(tour.id),
        orderService.createPurchaseOrderForTour(tour.id)
      ])

      if (salesResult.success && poResult.success) {
        toast({
          title: "Tour Validated Successfully!",
          description: `Created ${salesResult.ordersCreated} sales orders and 1 purchase order`,
        })
      } else {
        const errors = [...(salesResult.errors || []), ...(poResult.errors || [])]
        toast({
          title: "Tour Validated with Errors",
          description: `Tour validated but some orders failed: ${errors.join(', ')}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error validating tour:', error)
      toast({
        title: "Error",
        description: "Failed to validate tour",
        variant: "destructive",
      })
    } finally {
      setIsValidatingTour(false)
    }
  }

  const handleCancelTour = async () => {
    if (!confirm('Are you sure you want to cancel this tour? This action cannot be undone.')) {
      return
    }

    setIsCancellingTour(true)
    try {
      const supabase = createClient()
      
      // Update tour status to cancelled
      const { error: updateError } = await supabase
        .from('tours')
        .update({ status: 'cancelled' })
        .eq('id', tour.id)

      if (updateError) {
        throw updateError
      }

      toast({
        title: "Tour Cancelled",
        description: "The tour has been cancelled successfully",
      })
    } catch (error) {
      console.error('Error cancelling tour:', error)
      toast({
        title: "Error",
        description: "Failed to cancel tour",
        variant: "destructive",
      })
    } finally {
      setIsCancellingTour(false)
    }
  }

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Tour Details</SheetTitle>
        <SheetDescription>View complete information about this warehouse tour</SheetDescription>
      </SheetHeader>

      {/* Tour Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Tour Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="font-medium">{formatDate(tour.date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Time</p>
              <p className="font-medium">{formatTime(tour.time)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Warehouse</p>
            <p className="font-medium">{tour.warehouse.name}</p>
            <div className="text-sm text-muted-foreground">
              <p className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {tour.warehouse.city && tour.warehouse.state 
                  ? `${tour.warehouse.address}, ${tour.warehouse.city}, ${tour.warehouse.state} ${tour.warehouse.zip || ''}`.trim()
                  : tour.warehouse.address
                }
              </p>
              {tour.warehouse.code && (
                <p className="text-xs">Code: {tour.warehouse.code}</p>
              )}
            </div>
          </div>
          {tour.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p className="text-sm">{tour.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants ({tour.participants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tour.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants registered</p>
          ) : (
            <div className="space-y-3">
              {tour.participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{participant.name}</p>
                      {participant.title && (
                        <span className="text-sm text-muted-foreground">- {participant.title}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{participant.email}</p>
                    {participant.company && (
                      <p className="text-sm text-muted-foreground">{participant.company}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Swag Allocations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Swag Allocations ({tour.swag_allocations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tour.swag_allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No swag items allocated yet</p>
          ) : (
            <div className="space-y-3">
              {tour.swag_allocations.map((allocation) => (
                <div key={allocation.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{allocation.swag_item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      For: {allocation.participant.name} ({allocation.participant.email})
                    </p>
                  </div>
                  <Badge variant="secondary">Qty: {allocation.quantity}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ShipHero Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            ShipHero Orders
          </CardTitle>
          <CardDescription>
            Create sales orders for participants and purchase orders for inventory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Sales Orders</h4>
              <p className="text-sm text-muted-foreground">
                Create individual orders for each participant with their allocated swag items
              </p>
              <Button 
                onClick={handleCreateSalesOrders}
                disabled={isCreatingOrders || tour.participants.length === 0}
                className="w-full"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {isCreatingOrders ? "Creating..." : `Create ${tour.participants.length} Sales Orders`}
              </Button>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Purchase Order</h4>
              <p className="text-sm text-muted-foreground">
                Create a consolidated purchase order for all swag items needed
              </p>
              <Button 
                onClick={handleCreatePurchaseOrder}
                disabled={isCreatingPO || tour.swag_allocations.length === 0}
                variant="outline"
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                {isCreatingPO ? "Creating..." : "Create Purchase Order"}
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <p><strong>Note:</strong> Make sure you have configured your ShipHero tokens in Settings → ShipHero and that your warehouse has a ShipHero Warehouse ID.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
