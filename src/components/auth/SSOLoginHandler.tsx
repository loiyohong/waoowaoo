// @ts-nocheck
'use client'

import { useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'

/**
 * SSO Login Handler
 * 
 * This component looks for a 'waoowaoo_sso_token' cookie set by the SSO login redirect.
 * If found, it triggers a 'credentials' sign-in automatically.
 */
export function SSOLoginHandler() {
    const { status } = useSession()

    useEffect(() => {
        if (status === 'unauthenticated') {
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=')
                acc[key] = value
                return acc
            }, {} as Record<string, string>)

            const ssoToken = cookies['waoowaoo_sso_token']

            if (ssoToken) {
                // Decode token to get the name (userId from NovelBox)
                try {
                    const [payload64] = ssoToken.split('.')
                    const payload = JSON.parse(atob(payload64.replace(/-/g, '+').replace(/_/g, '/')))
                    
                    if (payload && payload.userId) {
                        console.log('SSO: Identifying user and triggering auto-login...', payload.userId)
                        
                        signIn('credentials', {
                            username: payload.userId,
                            password: 'SSO_TOKEN_LOGIN',
                            redirect: true,
                            callbackUrl: window.location.pathname // Stay on the same page (usually /)
                        }).then(() => {
                            // Clear the cookie after use
                            document.cookie = 'waoowaoo_sso_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
                        })
                    }
                } catch (err) {
                    console.error('SSO: Failed to decode token', err)
                }
            }
        }
    }, [status])

    return null
}
