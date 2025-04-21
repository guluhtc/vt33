export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: string
          created_at: string
          last_login: string | null
        }
        Insert: {
          id?: string
          email: string
          role?: string
          created_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: string
          created_at?: string
          last_login?: string | null
        }
      }
      instagram_business_accounts: {
        Row: {
          id: string
          user_id: string
          instagram_business_account_id: string
          username: string | null
          name: string | null
          profile_picture_url: string | null
          access_token: string
          token_type: string
          token_expires_at: string
          is_token_valid: boolean
          business_account_type: string | null
          media_count: number | null
          followers_count: number | null
          following_count: number | null
          website: string | null
          biography: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          instagram_business_account_id: string
          username?: string | null
          name?: string | null
          profile_picture_url?: string | null
          access_token: string
          token_type?: string
          token_expires_at: string
          is_token_valid?: boolean
          business_account_type?: string | null
          media_count?: number | null
          followers_count?: number | null
          following_count?: number | null
          website?: string | null
          biography?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          instagram_business_account_id?: string
          username?: string | null
          name?: string | null
          profile_picture_url?: string | null
          access_token?: string
          token_type?: string
          token_expires_at?: string
          is_token_valid?: boolean
          business_account_type?: string | null
          media_count?: number | null
          followers_count?: number | null
          following_count?: number | null
          website?: string | null
          biography?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}