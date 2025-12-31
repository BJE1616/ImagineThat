import { sendTemplateEmail } from '@/lib/email'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
    try {
        const { type, to, data, subject, html } = await request.json()

        // Direct send mode (for edited emails)
        if (html && to && subject) {
            const result = await resend.emails.send({
                from: 'Imagine That <noreply@send.imaginethat.icu>',
                to: to,
                subject: subject,
                html: html
            })
            return Response.json({ success: true, id: result.data?.id })
        }

        // Template mode (original behavior)
        if (!type || !to) {
            return Response.json({ error: 'Missing type or to' }, { status: 400 })
        }

        const templateKey = type.replace('_', '_')
        const result = await sendTemplateEmail(templateKey, to, data)

        return Response.json(result)

    } catch (error) {
        console.error('Email API error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}