"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// Sheet imports removed - no longer using view details functionality
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, MapPin, Users, ChevronLeft, ChevronRight, ShoppingCart, FileText, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { TourFinalizationService, WorkflowOption } from "@/lib/shiphero/tour-finalization-service-clean"
import { TourSummaryDialog } from "@/components/tour-summary-dialog"

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
  // Products are managed through ShipHero inventory API
}

const ITEMS_PER_PAGE = 10

export function ViewToursPage() {
  const [tours, setTours] = useState<Tour[]>([])
  const [filteredTours, setFilteredTours] = useState<Tour[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  // selectedTour state removed - no longer using view details functionality
  const [currentPage, setCurrentPage] = useState(1)
  const [isFinalizingTour, setIsFinalizingTour] = useState(false)
  const [finalizingTourId, setFinalizingTourId] = useState<string | null>(null)
  const [tourSummaryData, setTourSummaryData] = useState<any>(null)
  const [showTourSummary, setShowTourSummary] = useState(false)

  const [sortField, setSortField] = useState<string>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const { toast } = useToast()
  const supabase = createClient()

  // Generate ShipHero URL with tour tag filter and date range
  const generateShipHeroFilterUrl = (tourNumericId: number): string => {
    const tourTag = `tour-${tourNumericId}`
    
    // Use current date for order date range (since orders are created "today")
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 1) // Day before order creation
    
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + 7) // Week after order creation for buffer
    
    // Format dates as MM%2FDD%2FYYYY (URL encoded MM/DD/YYYY)
    const formatDateForUrl = (date: Date): string => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${month}%2F${day}%2F${year}`
    }
    
    const startDateStr = formatDateForUrl(startDate)
    const endDateStr = formatDateForUrl(endDate)
    
    return `https://app.shiphero.com/dashboard/orders/v2/manage?tags=${tourTag}&start_date=${startDateStr}&preselectedDate=custom&end_date=${endDateStr}&fulfillment_status=unfulfilled`
  }

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


  const handleFinalizeTour = async (tourId: string) => {
    console.log('🚀 DEPLOYMENT MARKER V8 - Finalize button clicked - TIMESTAMP:', new Date().toISOString())
    console.log('🚀 FINALIZE TOUR CLICKED - tourId:', tourId)
    setIsFinalizingTour(true)
    setFinalizingTourId(tourId)
    
    try {
      console.log('📋 Fetching tour data for workflows...')
      // Get the tour to check for pre-selected workflows
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('selected_workflows')
        .eq('id', tourId)
        .single()

      console.log('📊 Tour data response:', { tourData, tourError })

      if (tourError) throw new Error(`Failed to fetch tour: ${tourError.message}`)

      const selectedWorkflows = tourData.selected_workflows || []
      console.log('🎯 Selected workflows from tour:', selectedWorkflows)
      
      if (selectedWorkflows.length === 0) {
        console.log('⚠️ No workflows selected, showing toast')
      toast({
          title: "No Workflows Selected",
          description: "This tour has no workflows selected. Please edit the tour to add training workflows before finalizing.",
          variant: "destructive",
        })
        return
      }

      console.log(`🔥 Starting finalization for tour ${tourId} with workflows:`, selectedWorkflows)
      
      const finalizationService = new TourFinalizationService()
      console.log('🛠️ TourFinalizationService created, calling finalizeTour...')
      const result = await finalizationService.finalizeTour(tourId, selectedWorkflows)
      console.log('✅ Finalization result:', result)
      
      if (result.success) {
        // Refresh tours to get updated order information
        await fetchTours()
        
        // Show success popup with a brief delay to ensure it's visible
        const hasErrors = result.workflow_errors && result.workflow_errors.length > 0
        console.log('🎉 TOUR FINALIZATION SUCCESS - About to show toast, hasErrors:', hasErrors)
        setTimeout(() => {
          console.log('🎉 SHOWING TOUR FINALIZATION TOAST NOW')
          toast({
            title: hasErrors ? "⚠️ Tour Finalized with Warnings" : "🎉 Tour Finalized Successfully!",
            description: hasErrors 
              ? `Tour finalized with ${result.workflow_errors.length} workflow error(s). Created ${result.sales_orders?.length || 0} sales orders and ${result.purchase_orders?.length || 0} purchase orders.`
              : `Tour finalized successfully! Created ${result.sales_orders?.length || 0} sales orders and ${result.purchase_orders?.length || 0} purchase orders.`,
            variant: hasErrors ? "destructive" : "default",
            duration: hasErrors ? 8000 : 7000, // Show errors longer
          })
          console.log('🎉 TOUR FINALIZATION TOAST CALLED')
        }, 200)
        
        // selectedTour update logic removed - no longer using view details functionality

        // Finalization results popup removed - using tour summary instead
      } else {
        throw new Error(result.message)
      }
      
    } catch (error: any) {
      console.error('❌ ERROR finalizing tour:', error)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      toast({
        title: "❌ Tour Finalization Failed",
        description: error.message || "Failed to finalize tour. Please try again.",
        variant: "destructive",
        duration: 8000,
      })
    } finally {
      console.log('🏁 Finalization process complete, cleaning up state')
      setIsFinalizingTour(false)
      setFinalizingTourId(null)
    }
  }

  // Removed cancel dialog functions - no longer needed

  const handleClearAllTours = async () => {
    if (!confirm('⚠️ ARE YOU SURE? This will permanently delete ALL tours from the database. This action cannot be undone!')) {
      return
    }

    if (!confirm('🚨 FINAL WARNING: This will delete ALL tour data including participants, orders, and history. Type YES to confirm you understand this is for TESTING ONLY.')) {
      return
    }

    try {
      console.log('🗑️ CLEARING ALL TOURS - Starting deletion process...')
      
      const supabase = createClient()
      
      // Delete all tours (cascade should handle related data)
      const { error: deleteError } = await supabase
        .from('tours')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all tours
      
      if (deleteError) {
        console.error('❌ Error deleting tours:', deleteError)
        toast({
          title: "Error",
          description: `Failed to clear tours: ${deleteError.message}`,
          variant: "destructive"
        })
        return
      }

      console.log('✅ All tours cleared successfully')
      toast({
        title: "Success",
        description: "All tours have been cleared from the database",
        variant: "default"
      })

      // Refresh the tours list
      fetchTours()
      
    } catch (error) {
      console.error('❌ Error clearing tours:', error)
      toast({
        title: "Error",
        description: "Failed to clear tours. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleViewInstructions = async (tourId: string) => {
    try {
      console.log('🔍 DEBUG: Fetching tour summary for ID:', tourId)
      
      // Fetch comprehensive tour data including order summary
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
          .select(`
            id,
            date,
            time,
            status,
            tour_numeric_id,
          selected_workflows,
          selected_skus,
          order_summary,
          warehouse:warehouses(id, name, code, address, address2, city, state, zip, country, shiphero_warehouse_id),
            host:team_members(id, first_name, last_name, email),
          participants:tour_participants(id, first_name, last_name, email, company, title)
          `)
          .eq('id', tourId)
          .single()
        
      console.log('🔍 DEBUG: Tour data response:', { tourData, tourError })
      console.log('🔍 DEBUG: Order summary data:', tourData?.order_summary)

      if (tourError || !tourData) {
        console.error('❌ DEBUG: Failed to fetch tour data:', tourError)
        throw new Error('Failed to fetch tour data')
      }

      // Check if we have order summary data
      if (!tourData.order_summary) {
        console.warn('⚠️ DEBUG: No order_summary found in database')
        toast({
          title: "No Tour Summary Available",
          description: "This tour was finalized before comprehensive summaries were saved. Please re-finalize the tour to generate a summary.",
          variant: "destructive",
        })
        return
      }

      console.log('✅ DEBUG: Order summary found, creating tour summary...')

      try {
        // Format the date safely
        const [year, month, day] = tourData.date.split('-').map(Number);
        const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });

        console.log('🔍 DEBUG: Date formatted successfully:', formattedDate)

        // Handle array vs object data structure from Supabase joins
        const warehouse = Array.isArray(tourData.warehouse) ? tourData.warehouse[0] : tourData.warehouse
        const host = Array.isArray(tourData.host) ? tourData.host[0] : tourData.host
        const participants = Array.isArray(tourData.participants) ? tourData.participants : []

        // Create comprehensive tour summary
        const tourSummary = {
          tourId: tourData.id,
          tourDate: tourData.date,
          tourTime: tourData.time,
          tourNumericId: tourData.tour_numeric_id,
          status: tourData.status,
          warehouseName: warehouse?.name || 'Unknown Warehouse',
          warehouseCode: warehouse?.code || '',
          warehouseAddress: `${warehouse?.address || ''} ${warehouse?.city || ''} ${warehouse?.state || ''} ${warehouse?.zip || ''}`.trim() || 'Address not available',
          hostName: `${host?.first_name || ''} ${host?.last_name || ''}`.trim(),
          hostEmail: host?.email || '',
          selectedWorkflows: tourData.selected_workflows || [],
          selectedSkus: tourData.selected_skus || [],
          participantCount: participants?.length || 0,
          participants: participants || [],
          orders: {
            sales_orders: tourData.order_summary?.sales_orders || [],
            purchase_orders: tourData.order_summary?.purchase_orders || []
          },
          summary: tourData.order_summary?.summary || {},
          instructions: `# 🎯 Tour Summary

## 📋 Tour Information
- **Tour ID:** ${tourData.tour_numeric_id}
- **Date:** ${formattedDate}
- **Time:** ${tourData.time}
- **Status:** ${tourData.status?.toUpperCase()}
- **Warehouse:** ${warehouse?.name} (${warehouse?.code})
- **Address:** ${warehouse?.address}, ${warehouse?.city}, ${warehouse?.state} ${warehouse?.zip}

## 👥 Tour Host & Participants
- **Host:** ${host?.first_name} ${host?.last_name} (${host?.email})
- **Participants:** ${participants?.length || 0} registered

## 📦 Order Summary
- **Total Orders Created:** ${tourData.order_summary?.summary?.total_orders || 0}
- **Sales Orders:** ${tourData.order_summary?.summary?.total_sales_orders || 0}
- **Purchase Orders:** ${tourData.order_summary?.summary?.total_purchase_orders || 0}

### 🔗 Quick Links
- [View All Tour Orders in ShipHero](${generateShipHeroFilterUrl(tourData.tour_numeric_id)})

---

*This summary was generated automatically when the tour was finalized.*`
        }

        console.log('✅ DEBUG: Tour summary object created successfully')
        
        // Set the tour summary data for the new dialog
        setTourSummaryData(tourSummary)
        setShowTourSummary(true)
        
        console.log('✅ DEBUG: Tour summary dialog should now be visible')
        
      } catch (error) {
        console.error('❌ DEBUG: Error creating tour summary:', error)
        throw error
      }

      toast({
        title: "Tour Summary Retrieved",
        description: `Comprehensive tour summary with ${tourData.order_summary?.summary?.total_orders || 0} orders`,
      })
    } catch (error: any) {
      toast({
        title: "Failed to Load Tour Summary",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Pagination logic with sorting
  const sortedTours = sortTours(filteredTours)
  const totalPages = Math.ceil(sortedTours.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentTours = sortedTours.slice(startIndex, endIndex)

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone conversion issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString("en-US", {
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

  const SortableHeader = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
    const isActive = sortField === field
    const Icon = isActive 
      ? (sortDirection === 'asc' ? ArrowUp : ArrowDown)
      : ArrowUpDown

    return (
      <TableHead 
        className={`cursor-pointer hover:bg-muted/50 select-none ${className || ''}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-2">
          <span className="truncate">{children}</span>
          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </TableHead>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            View Tours
          </CardTitle>
          <CardDescription>Browse and manage existing warehouse tours</CardDescription>
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleClearAllTours}
              className="bg-red-600 hover:bg-red-700"
            >
                                            {/* XCircle icon removed with cancel button */}
              Clear All Tours
            </Button>
          </div>
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
                  <SortableHeader field="date" className="w-[15%]">Date & Time</SortableHeader>
                  <SortableHeader field="warehouse" className="w-[25%]">Warehouse</SortableHeader>
                  <SortableHeader field="host" className="w-[15%] hidden md:table-cell">Host</SortableHeader>
                  <SortableHeader field="participants" className="w-[15%] hidden lg:table-cell">Participants</SortableHeader>
                  <SortableHeader field="status" className="w-[15%] hidden xl:table-cell">Status</SortableHeader>
                  <TableHead className="w-[15%]">Actions</TableHead>
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
                          <div className="font-medium truncate">{formatDate(tour.date)}</div>
                          <div className="text-sm text-muted-foreground">{formatTime(tour.time)}</div>
                          {/* Show mobile info */}
                          <div className="md:hidden text-xs text-muted-foreground mt-1">
                            {tour.host && `Host: ${tour.host.first_name} ${tour.host.last_name}`}
                          </div>
                          <div className="lg:hidden text-xs text-muted-foreground mt-1">
                            {tour.participants.length} participant{tour.participants.length !== 1 ? 's' : ''}
                          </div>
                          <div className="xl:hidden text-xs text-muted-foreground mt-1">
                            <Badge 
                              variant={
                                tour.status === 'finalized' 
                                  ? (tour.order_summary?.workflow_errors?.length > 0 ? 'destructive' : 'default')
                                  : 'secondary'
                              } 
                              className="text-xs"
                            >
                              {tour.status === 'finalized' && tour.order_summary?.workflow_errors?.length > 0
                                ? `finalized (${tour.order_summary.workflow_errors.length} errors)`
                                : tour.status || 'scheduled'
                              }
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium truncate" title={tour.warehouse.name}>
                            {tour.warehouse.name}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{tour.warehouse.address}</span>
                          </div>
                          {tour.shiphero_purchase_order_url && (
                            <div className="mt-1">
                              <a 
                                href={tour.shiphero_purchase_order_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs underline cursor-pointer truncate block"
                              >
                                PO: {tour.shiphero_purchase_order_number || 'View Order'}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div>
                          {tour.host ? (
                            <>
                              <div className="font-medium truncate" title={`${tour.host.first_name} ${tour.host.last_name}`}>
                                {tour.host.first_name} {tour.host.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground truncate" title={tour.host.email}>
                                {tour.host.email}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">No host assigned</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Users className="h-3 w-3" />
                          {tour.participants.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Badge 
                          variant={
                            tour.status === 'finalized' 
                              ? (tour.order_summary?.workflow_errors?.length > 0 ? 'destructive' : 'default')
                              : 'secondary'
                          }
                          className="capitalize"
                        >
                          {tour.status === 'finalized' && tour.order_summary?.workflow_errors?.length > 0
                            ? `finalized (${tour.order_summary.workflow_errors.length} errors)`
                            : tour.status || 'scheduled'
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {/* Primary Action - Finalize Tour */}
                          {tour.status === 'scheduled' && (
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleFinalizeTour(tour.id)}
                              disabled={isFinalizingTour && (finalizingTourId === tour.id || finalizingTourId === null)}
                              className={`w-full bg-blue-600 hover:bg-blue-700 ${isFinalizingTour && finalizingTourId === tour.id ? 'cursor-wait' : ''}`}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              {isFinalizingTour ? 'Finalizing...' : 'Finalize Tour'}
                            </Button>
                          )}
                          
                          {/* View Summary for Finalized Tours */}
                          {tour.status === 'finalized' && (
                            <>
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleViewInstructions(tour.id)}
                                className="w-full bg-green-600 hover:bg-green-700"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Summary
                              </Button>
                              
                              {/* Cancel button removed per user request */}
                            </>
                            )}
                          
                          
                          {/* View details functionality removed per user request */}
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

      {/* Tour Summary Dialog */}
      <TourSummaryDialog
        isOpen={showTourSummary}
        onClose={() => setShowTourSummary(false)}
        data={tourSummaryData}
      />

    </div>
  )
}

// TourDetailsSheet component removed per user request
