import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 Test endpoint called - backend logging working!')
  console.log('📅 Timestamp:', new Date().toISOString())
  console.log('🔍 Request headers:', Object.fromEntries(request.headers.entries()))
  
  return NextResponse.json({
    message: 'Backend logging test successful',
    timestamp: new Date().toISOString(),
    logs: 'Check Vercel function logs for backend console output'
  })
}
