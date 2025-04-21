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
      return NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
    }

    if (!code) {
      console.error('No code parameter found in callback URL')
      return NextResponse.redirect(new URL('/login?error=missing_code', request.url))
    }

    // Get current user session
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session } } = await supabase.auth.getSession()

    // If there's no existing session, we need to create one
    if (!session) {
      // Create a temporary user for the Instagram login
      const randomEmail = `instagram_user_${Date.now()}@techigem.com`
      const randomPassword = Math.random().toString(36).substring(2, 15)
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: randomEmail,
        password: randomPassword,
        options: {
          data: {
            source: 'instagram',
            instagram_code: code
          }
        }
      })
      
      if (signUpError) {
        console.error('Error creating temporary user:', signUpError)
        return NextResponse.redirect(new URL('/login?error=auth_error', request.url))
      }
      
      // Get the session after sign-up
      const { data: { session: newSession } } = await supabase.auth.getSession()
      if (!newSession) {
        console.error('Failed to create session for Instagram user')
        return NextResponse.redirect(new URL('/login?error=no_session_created', request.url))
      }
    }
    
    try {
      // Now we have a valid session, exchange the code for a token
      const tokenData = await InstagramBusinessAuth.exchangeCodeForToken(code)
      
      // Exchange for long-lived token
      const longLivedTokenData = await InstagramBusinessAuth.getLongLivedToken(tokenData.access_token)
      
      // Get business profile data
      const profileData = await InstagramBusinessAuth.getBusinessProfile(longLivedTokenData.access_token)
      
      // Get current user session again (it might be the new one or the existing one)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      if (!currentSession) {
        console.error('No session available after authentication flow')
        return NextResponse.redirect(new URL('/login?error=session_lost', request.url))
      }
      
      // Store Instagram business account data
      const { error: accountError } = await supabase
        .from('instagram_business_accounts')
        .upsert({
          user_id: currentSession.user.id,
          instagram_business_account_id: profileData.id,
          username: profileData.username,
          name: profileData.name,
          profile_picture_url: profileData.profile_picture_url,
          access_token: longLivedTokenData.access_token,
          token_expires_at: new Date(Date.now() + (longLivedTokenData.expires_in * 1000)).toISOString(),
          business_account_type: profileData.account_type,
          media_count: profileData.media_count,
          followers_count: profileData.followers_count,
          following_count: profileData.follows_count,
          website: profileData.website,
          biography: profileData.biography
        })

      if (accountError) {
        console.error('Error storing Instagram account:', accountError)
        throw accountError
      }
      
      // Update user profile with Instagram data
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: currentSession.user.id,
          email: currentSession.user.email,
          instagram_id: profileData.id,
          instagram_username: profileData.username,
          instagram_full_name: profileData.name,
          instagram_profile_picture: profileData.profile_picture_url,
          instagram_bio: profileData.biography,
          instagram_website: profileData.website,
          instagram_followers_count: profileData.followers_count,
          instagram_following_count: profileData.follows_count,
          instagram_media_count: profileData.media_count,
          instagram_account_type: profileData.account_type,
          instagram_is_business: profileData.account_type === 'BUSINESS',
          instagram_connected_at: new Date().toISOString()
        })
      
      if (userError) {
        console.error('Error updating user with Instagram data:', userError)
        // We can continue even if this fails
      }

      return NextResponse.redirect(new URL(next, request.url))
    } catch (error: any) {
      console.error('Instagram data processing error:', error)
      return NextResponse.redirect(
        new URL(`/login?error=instagram_processing&message=${encodeURIComponent(error.message || '')}`, request.url)
      )
    }
  } catch (error: any) {
    console.error('Instagram callback error:', error)
    return NextResponse.redirect(
      new URL(`/login?error=instagram_callback&message=${encodeURIComponent(error.message || '')}`, request.url)
    )
  }
}