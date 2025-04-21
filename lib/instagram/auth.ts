import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

const supabase = createClientComponentClient<Database>()

export class InstagramBusinessAuth {
  private static readonly GRAPH_API_URL = 'https://graph.instagram.com'
  private static readonly AUTH_URL = 'https://api.instagram.com/oauth/authorize'
  private static readonly TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
  private static readonly LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'

  static getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
      response_type: 'code',
      scope: [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights',
        'instagram_manage_comments'
      ].join(' '),
      state: crypto.randomUUID()
    })

    return `${this.AUTH_URL}?${params.toString()}`
  }

  static async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    user_id: string;
  }> {
    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
        code,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to exchange code for token: ${error}`)
    }

    return response.json()
  }

  static async getLongLivedToken(shortLivedToken: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    const response = await fetch(
      `${this.LONG_LIVED_TOKEN_URL}?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get long-lived token: ${error}`)
    }

    return response.json()
  }

  static async getBusinessProfile(accessToken: string): Promise<any> {
    const response = await fetch(
      `${this.GRAPH_API_URL}/me?fields=id,username,name,profile_picture_url,account_type,media_count,followers_count,follows_count,website,biography&access_token=${accessToken}`
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to fetch business profile: ${error}`)
    }

    return response.json()
  }
}