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
    const state = searchParams.get('state')
    const next = searchParams.get('next') || '/dashboard'

    if (error) {
      console.error('Instagram OAuth error:', error)
      return NextResponse.redirect(new URL('/login?error=instagram_auth', request.url))
    }

    if (!code || !state) {
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

    // Generate a random password for the user
    const password = crypto.randomUUID()
    const email = `${profileData.id}@instagram.user`

    // Create new user with Instagram data
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: profileData.name || '',
          instagram_id: profileData.id,
          instagram_username: profileData.username,
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
      // If user already exists, try to sign in
      if (signUpError.message?.includes('already registered')) {
        const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (signInError || !session) {
          console.error('Error signing in:', signInError)
          return NextResponse.redirect(new URL('/login?error=signin_failed', request.url))
        }

        // Update existing user's Instagram data
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: profileData.name || '',
            instagram_username: profileData.username,
            instagram_profile_picture: profileData.profile_picture_url,
            instagram_bio: profileData.biography,
            instagram_website: profileData.website,
            instagram_followers_count: profileData.followers_count,
            instagram_following_count: profileData.follows_count,
            instagram_media_count: profileData.media_count,
            instagram_account_type: profileData.account_type,
            instagram_is_business: true,
            instagram_connected_at: new Date().toISOString()
          })
          .eq('instagram_id', profileData.id)

        if (updateError) {
          console.error('Error updating user:', updateError)
          return NextResponse.redirect(new URL('/login?error=update_failed', request.url))
        }
      } else {
        console.error('Error creating user:', signUpError)
        return NextResponse.redirect(new URL('/login?error=signup_failed', request.url))
      }
    }

    // Store Instagram auth session
    const { error: sessionError } = await supabase
      .from('instagram_auth_sessions')
      .insert({
        user_id: user?.id,
        access_token: longLivedTokenData.access_token,
        token_type: longLivedTokenData.token_type,
        expires_at: new Date(Date.now() + (longLivedTokenData.expires_in * 1000)).toISOString(),
        scope: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights', 'instagram_manage_comments']
      })

    if (sessionError) {
      console.error('Error storing auth session:', sessionError)
      return NextResponse.redirect(new URL('/login?error=session_failed', request.url))
    }

    // Set session cookie and redirect
    return NextResponse.redirect(new URL(next, request.url))
  } catch (error) {
    console.error('Instagram callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unknown', request.url))
  }
}