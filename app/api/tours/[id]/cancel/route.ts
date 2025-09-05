import { NextRequest, NextResponse } from 'next/server'
import { TourCancellationService } from '@/lib/shiphero/tour-cancellation-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tourId = params.id

    // Validate tour ID format (basic UUID check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(tourId)) {
      return NextResponse.json(
        { error: 'Invalid tour ID format' },
        { status: 400 }
      )
    }

    console.log(`🚫 API: Starting tour cancellation for ${tourId}`)

    // Initialize cancellation service and cancel tour
    const cancellationService = new TourCancellationService()
    const result = await cancellationService.cancelTour(tourId)

    if (result.success) {
      console.log(`✅ API: Tour cancellation successful for ${tourId}`)
      return NextResponse.json({
        success: true,
        message: 'Tour canceled successfully',
        data: {
          tourId,
          canceledAt: result.timestamp,
          canceledOrders: result.canceledOrders.length,
          canceledPurchaseOrders: result.canceledPurchaseOrders.length,
          details: result
        }
      })
    } else {
      console.error(`❌ API: Tour cancellation failed for ${tourId}:`, result.errors)
      return NextResponse.json({
        success: false,
        message: 'Tour cancellation completed with errors',
        data: {
          tourId,
          errors: result.errors,
          partialSuccess: result.canceledOrders.length > 0 || result.canceledPurchaseOrders.length > 0,
          details: result
        }
      }, { status: 207 }) // 207 Multi-Status for partial success
    }

  } catch (error: any) {
    console.error('❌ API: Tour cancellation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Tour cancellation failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
