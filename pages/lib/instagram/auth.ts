import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export class InstagramBusinessAuth {
  private static readonly GRAPH_API_URL = 'https://graph.instagram.com'
  private static readonly AUTH_URL = 'https://www.instagram.com/oauth/authorize'
  private static readonly TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
  private static readonly LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'

  static getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
      response_type: 'code',
      scope: [
        'instagram_business_basic',
        'instagram_business_content_publish',
        'instagram_business_manage_comments',
        'instagram_business_manage_messages',
        'instagram_business_manage_insights'
      ].join(','),
      enable_fb_login: '0',
      force_authentication: '1'
    })

    return `${this.AUTH_URL}?${params.toString()}`
  }

  static async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    user_id: string;
  }> {
    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
        code,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to exchange code for token')
    }

    return response.json()
  }

  static async getLongLivedToken(shortLivedToken: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    const response = await fetch(`${this.LONG_LIVED_TOKEN_URL}?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`)

    if (!response.ok) {
      throw new Error('Failed to get long-lived token')
    }

    return response.json()
  }

  static async getBusinessProfile(accessToken: string): Promise<any> {
    const response = await fetch(
      `${this.GRAPH_API_URL}/me?fields=id,username,name,profile_picture_url,account_type,media_count,followers_count,follows_count,website,biography&access_token=${accessToken}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch business profile')
    }

    return response.json()
  }

  static async storeBusinessAccount(userId: string, data: any): Promise<void> {
    const { error } = await supabase
      .from('instagram_business_accounts')
      .upsert({
        user_id: userId,
        instagram_business_account_id: data.id,
        username: data.username,
        name: data.name,
        profile_picture_url: data.profile_picture_url,
        access_token: data.access_token,
        token_expires_at: new Date(Date.now() + (data.expires_in * 1000)),
        business_account_type: data.account_type,
        media_count: data.media_count,
        followers_count: data.followers_count,
        following_count: data.follows_count,
        website: data.website,
        biography: data.biography
      })

    if (error) {
      throw error
    }
  }
}