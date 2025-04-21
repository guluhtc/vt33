import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { InstagramBusinessAuth } from '@/lib/instagram/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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

    // Create Supabase client
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Create user account if it doesn't exist
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: `${profileData.id}@instagram.user`,
      password: crypto.randomUUID(),
      options: {
        data: {
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
          instagram_is_business: true,
          instagram_connected_at: new Date().toISOString()
        }
      }
    })

    if (signUpError) {
      console.error('Error creating user:', signUpError)
      return NextResponse.redirect(new URL('/login?error=signup_failed', request.url))
    }

    if (!user) {
      console.error('No user created')
      return NextResponse.redirect(new URL('/login?error=no_user', request.url))
    }

    // Store Instagram business account data
    const { error: storeError } = await supabase
      .from('instagram_business_accounts')
      .upsert({
        user_id: user.id,
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

    if (storeError) {
      console.error('Error storing Instagram account:', storeError)
      return NextResponse.redirect(new URL('/login?error=store_failed', request.url))
    }

    // Sign in the user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: `${profileData.id}@instagram.user`,
      password: crypto.randomUUID()
    })

    if (signInError) {
      console.error('Error signing in:', signInError)
      return NextResponse.redirect(new URL('/login?error=signin_failed', request.url))
    }

    return NextResponse.redirect(new URL(next, request.url))
  } catch (error) {
    console.error('Instagram callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unknown', request.url))
  }
}