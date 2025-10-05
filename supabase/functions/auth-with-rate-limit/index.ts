import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Phase 4: CSP Headers - Enhanced security headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// In-memory rate limit store (production: use Redis/Upstash for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 300000)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Initialize Supabase client for audit logging
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { email, password } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Rate limit: 5 attempts per minute per IP
    const now = Date.now()
    const rateLimitKey = `login:${clientIp}`
    const rateLimit = rateLimitStore.get(rateLimitKey)
    
    if (rateLimit) {
      if (now < rateLimit.resetAt) {
        if (rateLimit.count >= 5) {
          console.warn(`Rate limit exceeded for IP: ${clientIp}`)
          
          // Log rate limit violation
          await supabase.from('security_audit_logs').insert({
            event_type: 'rate_limit_exceeded',
            ip_address: clientIp,
            user_agent: userAgent,
            metadata: { email, attempts: rateLimit.count },
            severity: 'warning'
          })
          
          return new Response(
            JSON.stringify({ 
              error: 'Muitas tentativas de login. Aguarde 1 minuto antes de tentar novamente.' 
            }),
            { 
              status: 429, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        rateLimit.count++
      } else {
        // Reset counter after 1 minute
        rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + 60000 })
      }
    } else {
      rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + 60000 })
    }

    // Authentication via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login failed:', error.message)
      
      // Log failed login attempt
      await supabase.from('security_audit_logs').insert({
        event_type: 'login_failed',
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: { 
          email,
          error_message: error.message
        },
        severity: 'warning'
      })
      
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log successful login
    await supabase.from('security_audit_logs').insert({
      event_type: 'login_success',
      user_id: data.user?.id,
      ip_address: clientIp,
      user_agent: userAgent,
      metadata: { email },
      severity: 'info'
    })

    // Clear rate limit on successful login
    rateLimitStore.delete(rateLimitKey)

    console.log(`Successful login for email: ${email}`)
    
    // Return complete session data for client-side session management
    return new Response(
      JSON.stringify({
        session: data.session,
        user: data.user
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error in auth-with-rate-limit:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
