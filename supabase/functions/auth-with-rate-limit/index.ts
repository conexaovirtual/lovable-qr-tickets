import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const { email, password } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    
    // Rate limit: 5 attempts per minute per IP
    const now = Date.now()
    const rateLimitKey = `login:${clientIp}`
    const rateLimit = rateLimitStore.get(rateLimitKey)
    
    if (rateLimit) {
      if (now < rateLimit.resetAt) {
        if (rateLimit.count >= 5) {
          console.warn(`Rate limit exceeded for IP: ${clientIp}`)
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login failed:', error.message)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Clear rate limit on successful login
    rateLimitStore.delete(rateLimitKey)

    console.log(`Successful login for email: ${email}`)
    return new Response(
      JSON.stringify(data),
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
