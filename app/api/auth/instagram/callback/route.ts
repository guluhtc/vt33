import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('Instagram OAuth error:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=instagram_auth`)
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=invalid_request`)
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokenData = await tokenResponse.json()

    // Exchange short-lived token for long-lived token
    const longLivedTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${tokenData.access_token}`
    )

    if (!longLivedTokenResponse.ok) {
      throw new Error('Failed to exchange for long-lived token')
    }

    const longLivedTokenData = await longLivedTokenResponse.json()

    // Get current user session
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get('sb-access-token')?.value

    if (!sessionCookie) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_session`)
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionCookie)

    if (authError || !user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_session`)
    }

    // Store Instagram credentials
    const { error: dbError } = await supabase
      .from('instagram_accounts')
      .upsert({
        user_id: user.id,
        instagram_user_id: tokenData.user_id,
        access_token: longLivedTokenData.access_token,
        token_expires_at: new Date(Date.now() + longLivedTokenData.expires_in * 1000).toISOString()
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=database`)
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=true`)
  } catch (error) {
    console.error('Instagram callback error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=unknown`)
  }
}