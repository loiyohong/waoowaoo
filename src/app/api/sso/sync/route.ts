// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey } from '@/lib/crypto-utils'
import { logAuthAction } from '@/lib/logging/semantic'

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

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return new NextResponse('Missing Authorization', { status: 401 })
        }

        const token = authHeader.substring(7)
        const payload = verifyToken(token)

        if (!payload || !payload.userId) {
            return new NextResponse('Invalid Signature', { status: 403 })
        }

        // Check timestamp to prevent replay attacks (5 minute window)
        const now = Date.now()
        if (Math.abs(now - payload.timestamp) > 5 * 60 * 1000) {
            return new NextResponse('Token Expired', { status: 403 })
        }

        const { userId, email, apiKeys } = payload

        // Sync User and Preferences
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.upsert({
                where: { name: userId },
                update: {
                    email: email,
                },
                create: {
                    name: userId,
                    email: email,
                },
            })

            // Encrypt keys before saving
            const encryptedKeys = {
                llmApiKey: apiKeys.llmApiKey ? encryptApiKey(apiKeys.llmApiKey) : null,
                falApiKey: apiKeys.falApiKey ? encryptApiKey(apiKeys.falApiKey) : null,
                googleAiKey: apiKeys.googleAiKey ? encryptApiKey(apiKeys.googleAiKey) : null,
                arkApiKey: apiKeys.arkApiKey ? encryptApiKey(apiKeys.arkApiKey) : null,
                qwenApiKey: apiKeys.qwenApiKey ? encryptApiKey(apiKeys.qwenApiKey) : null,
            }

            await tx.userPreference.upsert({
                where: { userId: user.id },
                update: encryptedKeys,
                create: {
                    userId: user.id,
                    ...encryptedKeys
                },
            })
        })

        logAuthAction('SSO_SYNC', userId, { success: true })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('SSO Sync Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
