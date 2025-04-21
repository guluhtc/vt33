import { createClient } from '@supabase/supabase-js'

export interface VerificationResult {
  isValid: boolean;
  token?: string;
  error?: string;
}

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function verifyToken(userId: string, token: string): Promise<VerificationResult> {
  try {
    // Check if token exists and is valid
    const { data, error } = await supabaseAdmin
      .from('token_verifications')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token)
      .single()

    if (error) {
      console.error('Token verification DB error:', error)
      return { isValid: false, error: 'Invalid or expired token' }
    }

    if (!data) {
      return { isValid: false, error: 'Token not found' }
    }

    // Check if token is expired
    const expiresAt = new Date(data.expires_at)
    if (expiresAt < new Date()) {
      return { isValid: false, error: 'Token expired' }
    }

    // Mark token as verified if not already
    if (!data.verified_at) {
      const { error: updateError } = await supabaseAdmin
        .from('token_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', data.id)

      if (updateError) {
        console.error('Token verification update error:', updateError)
        // Continue even if update fails
      }
    }

    return { isValid: true, token: data.token }
  } catch (error) {
    console.error('Token verification error:', error)
    return { isValid: false, error: 'Error verifying token' }
  }
}

export async function createToken(userId: string): Promise<VerificationResult> {
  try {
    // Generate random token
    const token = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15)

    // Set expiration date (24 hours from now)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Insert token into database
    const { error } = await supabaseAdmin
      .from('token_verifications')
      .insert({
        user_id: userId,
        token: token,
        expires_at: expiresAt.toISOString()
      })

    if (error) {
      console.error('Token creation error:', error)
      return { isValid: false, error: 'Error creating token' }
    }

    return { isValid: true, token }
  } catch (error) {
    console.error('Token creation error:', error)
    return { isValid: false, error: 'Error creating token' }
  }
}