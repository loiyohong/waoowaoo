// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { logAuthAction } from '@/lib/logging/semantic'

// Note: In a real Next.js app with next-auth, session establishment usually involves 
// setting the appropriate cookies. Since we are using JWT strategy, we need to 
// create a JWT that next-auth understands or use a custom solution.
// For this bridge, we will rely on next-auth's internal session handling if possible,
// or set a persistent cookie that the middleware/auth options can recognize.

const SSO_SECRET = process.env.SSO_SHARED_SECRET || 'changeme-sso-secret-32-chars-long-123'

function verifyToken(token: string): any {
    const [payload64, signature] = token.split('.')
    if (!payload64 || !signature) return null

    const expectedSignature = crypto
        .createHmac('sha256', SSO_SECRET)
        .update(payload64)
        .digest('base64url')

    if (signature !== expectedSignature) return null

    try {
        const payload = JSON.parse(Buffer.from(payload64, 'base64url').toString())
        return payload
    } catch {
        return null
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const token = searchParams.get('token')

        if (!token) {
            return new NextResponse('Missing Token', { status: 400 })
        }

        const payload = verifyToken(token)

        if (!payload || !payload.userId) {
            return new NextResponse('Invalid Token', { status: 403 })
        }

        // Check expiration
        if (payload.exp && Date.now() > payload.exp) {
            return new NextResponse('Token Expired', { status: 403 })
        }

        // Find the user synced in Phase 1
        const user = await prisma.user.findUnique({
            where: { name: payload.userId }
        })

        if (!user) {
            return new NextResponse('User Not Synced', { status: 404 })
        }

        // IMPORTANT: Here we should establish the next-auth session.
        // Since manually crafting next-auth JWTs is complex and version-dependent,
        // a common pattern for SSO is using a custom cookie or a one-time-login-code.
        // For simplicity and alignment with next-auth JWT strategy, we will redirect 
        // to a client-side page that performs the sign-in using the credentials provider 
        // with the SSO token as a "password" (trusted by the authorize function).
        
        // However, the cleanest "bridge" way is to set the session cookie directly if 
        // we can sign it with NEXTAUTH_SECRET. 
        
        // For now, let's use the redirect-to-signin-with-token approach or 
        // a dedicated internal login endpoint that understands this token.
        
        logAuthAction('SSO_LOGIN', user.name, { success: true })

        // Target URL after login - Use absolute NEXTAUTH_URL to avoid 0.0.0.0 mismatch in Docker/Proxy
        const targetUrl = new URL('/', process.env.NEXTAUTH_URL || req.url)
        
        // Set a temporary "sso_token" cookie that the client-side can use to trigger
        const response = NextResponse.redirect(targetUrl)
        response.cookies.set('waoowaoo_sso_token', token, {
            path: '/',
            httpOnly: false, // Accessible by client-side JS to trigger login
            maxAge: 60, // 1 minute
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        })

        return response

    } catch (error) {
        console.error('SSO Login Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
