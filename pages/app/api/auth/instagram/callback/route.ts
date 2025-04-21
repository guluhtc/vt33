import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { InstagramBusinessAuth } from '@/lib/instagram/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const next = searchParams.get('next') || '/dashboard'

    if (error) {
      console.error('Instagram OAuth error:', error)
      return NextResponse.redirect(new URL('/login?error=instagram_auth', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=invalid_request', request.url))
    }

    // Exchange code for short-lived token
    const tokenData = await InstagramBusinessAuth.exchangeCodeForToken(code)
    
    // Exchange for long-lived token
    const longLivedTokenData = await InstagramBusinessAuth.getLongLivedToken(tokenData.access_token)
    
    // Get business profile data
    const profileData = await InstagramBusinessAuth.getBusinessProfile(longLivedTokenData.access_token)

    // Get current user session
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.redirect(new URL('/login?error=no_session', request.url))
    }

    // Store Instagram business account data
    await InstagramBusinessAuth.storeBusinessAccount(session.user.id, {
      ...profileData,
      access_token: longLivedTokenData.access_token,
      expires_in: longLivedTokenData.expires_in
    })

    return NextResponse.redirect(new URL(next, request.url))
  } catch (error) {
    console.error('Instagram callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unknown', request.url))
  }
}