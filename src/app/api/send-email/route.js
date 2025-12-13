import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
    try {
        const { to, subject, html, replyTo } = await request.json()

        const { data, error } = await resend.emails.send({
            from: 'ImagineThat <hello@imaginethat.icu>',
            to: to,
            subject: subject,
            html: html,
            replyTo: replyTo || 'ImagineThat.icu@gmail.com'
        })

        if (error) {
            console.error('Email error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error) {
        console.error('Email error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}