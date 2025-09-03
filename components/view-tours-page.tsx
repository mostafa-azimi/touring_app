"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Eye, Search, Calendar, MapPin, Users, ChevronLeft, ChevronRight, ShoppingCart, FileText, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { ShipHeroOrderService } from "@/lib/shiphero/order-service"
import { TourFinalizationService, WorkflowOption } from "@/lib/shiphero/tour-finalization-service"
import { TourFinalizationDialog } from "@/components/tour-finalization-dialog"

interface Tour {
  id: string
  date: string
  time: string

  status?: string
  created_at: string
  tour_numeric_id?: number
  shiphero_purchase_order_id?: string
  shiphero_purchase_order_number?: string
  shiphero_purchase_order_url?: string
  host_shiphero_sales_order_id?: string
  host_shiphero_sales_order_number?: string
  host_shiphero_sales_order_url?: string
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
  host?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  participants: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    company: string | null
    title: string | null
    shiphero_sales_order_id?: string
    shiphero_sales_order_number?: string
    shiphero_sales_order_url?: string
  }>
  // Removed swag_allocations - swag items will be added manually
}

const ITEMS_PER_PAGE = 10

export function ViewToursPage() {
  const [tours, setTours] = useState<Tour[]>([])
  const [filteredTours, setFilteredTours] = useState<Tour[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isFinalizingTour, setIsFinalizingTour] = useState(false)
  const [finalizingTourId, setFinalizingTourId] = useState<string | null>(null)
  const [cancellingTourId, setCancellingTourId] = useState<string | null>(null)
  const [finalizationDialogOpen, setFinalizationDialogOpen] = useState(false)
  const [tourToFinalize, setTourToFinalize] = useState<string | null>(null)

  const [sortField, setSortField] = useState<string>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
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
              `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.email.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      )
      setFilteredTours(filtered)
    }
    setCurrentPage(1) // Reset to first page when searching
  }, [searchTerm, tours])

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, start with ascending
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortTours = (tours: Tour[]) => {
    return [...tours].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'date':
          aValue = new Date(`${a.date} ${a.time}`)
          bValue = new Date(`${b.date} ${b.time}`)
          break
        case 'warehouse':
          aValue = a.warehouse.name.toLowerCase()
          bValue = b.warehouse.name.toLowerCase()
          break
        case 'host':
          aValue = a.host ? `${a.host.first_name} ${a.host.last_name}`.toLowerCase() : ''
          bValue = b.host ? `${b.host.first_name} ${b.host.last_name}`.toLowerCase() : ''
          break
        case 'participants':
          aValue = a.participants.length
          bValue = b.participants.length
          break
        case 'status':
          aValue = (a.status || '').toLowerCase()
          bValue = (b.status || '').toLowerCase()
          break
        default:
          aValue = a.date
          bValue = b.date
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  const fetchTours = async () => {
    try {
      let query = supabase
        .from("tours")
        .select(
          `
          id,
          date,
          time,
          status,
          created_at,
          tour_numeric_id,
          shiphero_purchase_order_id,
          shiphero_purchase_order_number,
          shiphero_purchase_order_url,
          host_shiphero_sales_order_id,
          host_shiphero_sales_order_number,
          host_shiphero_sales_order_url,
          warehouse:warehouses(id, name, code, address, address2, city, state, zip, country),
          host:team_members(id, first_name, last_name, email),
          participants:tour_participants(id, first_name, last_name, email, company, title, shiphero_sales_order_id, shiphero_sales_order_number, shiphero_sales_order_url)
        `,
        )

      // Always filter out cancelled tours for clean UI
      query = query.neq('status', 'cancelled')

      const { data, error } = await query
        .order("date", { ascending: false })
        .order("time", { ascending: false })

      if (error) throw error
      // Fix: Supabase returns warehouse, participants as arrays due to the select syntax.
      // We need to flatten those to objects/arrays as expected by the Tour type.
      setTours(
        (data || []).map((tour: any) => ({
          ...tour,
          warehouse: Array.isArray(tour.warehouse) ? tour.warehouse[0] : tour.warehouse,
          participants: Array.isArray(tour.participants) ? tour.participants : [],
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

  // REMOVED: handleValidateTour function - tours now go directly to finalize

  const handleCancelTour = async (tourId: string) => {
    if (cancellingTourId === tourId) return // Prevent double-clicks
    
    if (!confirm('Are you sure you want to cancel this tour? This action cannot be undone.')) {
      return
    }

    setCancellingTourId(tourId)

    // Optimistically update UI first for immediate feedback
    setTours(prevTours => 
      prevTours.map(tour => 
        tour.id === tourId 
          ? { ...tour, status: 'cancelled' } 
          : tour
      )
    )

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
    } catch (error) {
      console.error('Error cancelling tour:', error)
      
      // Revert optimistic update on error
      setTours(prevTours => 
        prevTours.map(tour => 
          tour.id === tourId 
            ? { ...tour, status: 'scheduled' } // Revert to original status
            : tour
        )
      )
      
      toast({
        title: "Error",
        description: "Failed to cancel tour",
        variant: "destructive",
      })
    } finally {
      setCancellingTourId(null)
    }
  }

  const handleFinalizeTourClick = (tourId: string) => {
    setTourToFinalize(tourId)
    setFinalizationDialogOpen(true)
  }

  const handleFinalizeTour = async (selectedOptions: WorkflowOption[]) => {
    if (!tourToFinalize) return

    setIsFinalizingTour(true)
    setFinalizingTourId(tourToFinalize)
    
    try {
      console.log(`Finalizing tour ${tourToFinalize} with options:`, selectedOptions)
      
      const finalizationService = new TourFinalizationService()
      const result = await finalizationService.finalizeTour(tourToFinalize, selectedOptions)
      
      if (result.success) {
        // Refresh tours to get updated order information
        await fetchTours()
        
        // Update selected tour if it's currently open by fetching fresh data
        if (selectedTour && selectedTour.id === tourToFinalize) {
          const { data: updatedTourData } = await supabase
            .from("tours")
            .select(`
              id,
              date,
              time,
              status,
              created_at,
              tour_numeric_id,
              shiphero_purchase_order_id,
              shiphero_purchase_order_number,
              shiphero_purchase_order_url,
              host_shiphero_sales_order_id,
              host_shiphero_sales_order_number,
              host_shiphero_sales_order_url,
              warehouse:warehouses(id, name, code, address, address2, city, state, zip, country),
              host:team_members(id, first_name, last_name, email),
              participants:tour_participants(id, first_name, last_name, email, company, title, shiphero_sales_order_id, shiphero_sales_order_number, shiphero_sales_order_url)
            `)
            .eq('id', tourToFinalize)
            .single()
          
          if (updatedTourData) {
            const processedTour = {
              ...updatedTourData,
              warehouse: Array.isArray(updatedTourData.warehouse) ? updatedTourData.warehouse[0] : updatedTourData.warehouse,
              host: Array.isArray(updatedTourData.host) ? updatedTourData.host[0] : updatedTourData.host,
              participants: Array.isArray(updatedTourData.participants) ? updatedTourData.participants : [],
            }
            setSelectedTour(processedTour)
          }
        }

        toast({
          title: "🎉 Tour Finalized Successfully!",
          description: result.message,
        })
      } else {
        throw new Error(result.message)
      }
      
      // Close dialog and reset state
      setFinalizationDialogOpen(false)
      setTourToFinalize(null)
      
    } catch (error: any) {
      console.error('Tour finalization error:', error)
      toast({
        title: "Tour Finalization Failed",
        description: error.message || "Failed to finalize tour. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsFinalizingTour(false)
      setFinalizingTourId(null)
    }
  }

  // Pagination logic with sorting
  const sortedTours = sortTours(filteredTours)
  const totalPages = Math.ceil(sortedTours.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentTours = sortedTours.slice(startIndex, endIndex)

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

  // CSV Export functionality
  const exportToCSV = () => {
    const csvData = []
    
    // CSV Headers
    const headers = [
      'Tour Date',
      'Tour Time', 
      'Host First Name',
      'Host Last Name',
      'Warehouse Name',
      'Warehouse Location',
      'Tour Status',
      'Purchase Order Number',
      'Purchase Order URL',
      'Host Order Number',
      'Host Order URL',
      'Participant First Name',
      'Participant Last Name',
      'Participant Email',
      'Participant Company',
      'Participant Title',
      'Sales Order Number',
      'Sales Order URL'
    ]
    
    csvData.push(headers.join(','))
    
    // Process each tour
    sortedTours.forEach(tour => {
      const baseData = [
        tour.date,
        tour.time,
        tour.host?.first_name || '',
        tour.host?.last_name || '',
        tour.warehouse.name,
        `"${tour.warehouse.address}${tour.warehouse.city ? ', ' + tour.warehouse.city : ''}${tour.warehouse.state ? ', ' + tour.warehouse.state : ''}"`,
        tour.status || 'scheduled',
        tour.shiphero_purchase_order_number || '',
        tour.shiphero_purchase_order_url || '',
        tour.host_shiphero_sales_order_number || '',
        tour.host_shiphero_sales_order_url || ''
      ]
      
      // Add row for each participant
      if (tour.participants && tour.participants.length > 0) {
        tour.participants.forEach(participant => {
          const row = [
            ...baseData,
            participant.first_name,
            participant.last_name,
            participant.email,
            `"${participant.company || ''}"`,
            `"${participant.title || ''}"`,
            participant.shiphero_sales_order_number || '',
            participant.shiphero_sales_order_url || ''
          ]
          csvData.push(row.join(','))
        })
      } else {
        // Tour with no participants
        const row = [
          ...baseData,
          '', '', '', '', '', '', '' // Empty participant data
        ]
        csvData.push(row.join(','))
      }
    })
    
    // Create and download CSV file
    const csvContent = csvData.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    const filename = `tours_export_${new Date().toISOString().split('T')[0]}.csv`
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: "Export Successful",
      description: `Downloaded ${sortedTours.length} tours to ${filename}`,
    })
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const isActive = sortField === field
    const Icon = isActive 
      ? (sortDirection === 'asc' ? ArrowUp : ArrowDown)
      : ArrowUpDown

    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-2">
          {children}
          <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </TableHead>
    )
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
          {/* Search Bar and Controls */}
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
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={sortedTours.length === 0}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <div className="text-sm text-muted-foreground">
              {filteredTours.length} tour{filteredTours.length !== 1 ? "s" : ""} found
            </div>
          </div>

          {/* Tours Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="date">Date & Time</SortableHeader>
                  <SortableHeader field="warehouse">Warehouse</SortableHeader>
                  <SortableHeader field="host">Host</SortableHeader>
                  <SortableHeader field="participants">Participants</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
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
                          {tour.shiphero_purchase_order_url && (
                            <div className="mt-1">
                              <a 
                                href={tour.shiphero_purchase_order_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs underline cursor-pointer"
                              >
                                PO: {tour.shiphero_purchase_order_number || 'View Order'}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {tour.host ? (
                            <>
                              <div className="font-medium">{tour.host.first_name} {tour.host.last_name}</div>
                              <div className="text-sm text-muted-foreground">{tour.host.email}</div>
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">No host assigned</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Users className="h-3 w-3" />
                          {tour.participants.length}
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
                        <div className="flex flex-col gap-2">
                          {/* Primary Action - Finalize Tour */}
                          {tour.status === 'scheduled' && (
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleFinalizeTourClick(tour.id)}
                              disabled={isFinalizingTour && (finalizingTourId === tour.id || finalizingTourId === null)}
                              className={`w-full bg-blue-600 hover:bg-blue-700 ${isFinalizingTour && finalizingTourId === tour.id ? 'cursor-wait' : ''}`}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              {isFinalizingTour ? 'Finalizing...' : 'Finalize Tour'}
                            </Button>
                          )}
                          
                          {/* Secondary Actions */}
                          <div className="flex items-center gap-1">
                            <Sheet>
                              <SheetTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedTour(tour)} title="View Details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </SheetTrigger>
                              <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
                                <TourDetailsSheet tour={selectedTour || tour} onTourUpdated={fetchTours} />
                              </SheetContent>
                            </Sheet>
                            

                            
                            {tour.status !== 'cancelled' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Cancel Tour" 
                                onClick={() => handleCancelTour(tour.id)}
                                disabled={cancellingTourId === tour.id}
                                className={`text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 ${cancellingTourId === tour.id ? 'cursor-wait' : ''}`}
                              >
                                <X className={`h-4 w-4 ${cancellingTourId === tour.id ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                          </div>
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

function TourDetailsSheet({ tour, onTourUpdated }: { tour: Tour; onTourUpdated?: () => Promise<void> }) {
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

  // Generate ShipHero URL with tour tag filter and date range
  const generateShipHeroFilterUrl = (tourNumericId: number, tourDate: string): string => {
    const tourTag = `Tour_${tourNumericId}`
    
    // Parse the tour date and create date range (day before to week after for buffer)
    const date = new Date(tourDate)
    const startDate = new Date(date)
    startDate.setDate(date.getDate() - 1) // Day before tour
    
    const endDate = new Date(date)
    endDate.setDate(date.getDate() + 7) // Week after tour for buffer
    
    // Format dates as MM%2FDD%2FYYYY (URL encoded MM/DD/YYYY)
    const formatDateForUrl = (date: Date): string => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${month}%2F${day}%2F${year}`
    }
    
    const startDateStr = formatDateForUrl(startDate)
    const endDateStr = formatDateForUrl(endDate)
    
    return `https://app.shiphero.com/dashboard/orders/v2/manage?tags=${tourTag}&start_date=${startDateStr}&preselectedDate=custom&end_date=${endDateStr}`
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
          {tour.host && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Host</p>
              <p className="font-medium">{tour.host.first_name} {tour.host.last_name}</p>
              <p className="text-sm text-muted-foreground">{tour.host.email}</p>
            </div>
          )}
          {tour.tour_numeric_id && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tour ID</p>
              <div className="flex items-center gap-2">
                <p className="font-medium font-mono">{tour.tour_numeric_id}</p>
                <a 
                  href={generateShipHeroFilterUrl(tour.tour_numeric_id, tour.date)}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm underline cursor-pointer"
                >
                  View Orders in ShipHero →
                </a>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants ({tour.participants.length + (tour.host ? 1 : 0)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tour.participants.length === 0 && !tour.host ? (
            <p className="text-sm text-muted-foreground">No participants registered</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              {/* Show host first if exists */}
              {tour.host && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid gap-1">
                    <p className="font-medium">{tour.host.first_name} {tour.host.last_name}</p>
                    <p className="text-sm text-muted-foreground">{tour.host.email}</p>
                    {tour.host_shiphero_sales_order_url && (
                      <div className="mt-1">
                        <a 
                          href={tour.host_shiphero_sales_order_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs underline cursor-pointer"
                        >
                          SO: {tour.host_shiphero_sales_order_number || 'View Order'}
                        </a>
                      </div>
                    )}
                  </div>
                  <Badge variant="default" className="bg-blue-600">Host</Badge>
                </div>
              )}
              {/* Show regular participants */}
              {tour.participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{participant.first_name} {participant.last_name}</p>
                      {participant.title && (
                        <span className="text-sm text-muted-foreground">- {participant.title}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{participant.email}</p>
                    {participant.shiphero_sales_order_url && (
                      <div className="mt-1">
                        <a 
                          href={participant.shiphero_sales_order_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs underline cursor-pointer"
                        >
                          SO: {participant.shiphero_sales_order_number || 'View Order'}
                        </a>
                      </div>
                    )}
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



      {/* Purchase Order Details */}
      {tour.shiphero_purchase_order_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Purchase Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Order Number:</span>
                <span className="font-medium">{tour.shiphero_purchase_order_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">ShipHero Link:</span>
                <a 
                  href={tour.shiphero_purchase_order_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm underline cursor-pointer"
                >
                  View in ShipHero →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tour Finalization Dialog */}
      <TourFinalizationDialog
        open={finalizationDialogOpen}
        onOpenChange={setFinalizationDialogOpen}
        onFinalize={handleFinalizeTour}
        isLoading={isFinalizingTour}
        tourId={tourToFinalize || ''}
      />

    </div>
  )
}
