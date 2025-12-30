import { sendTemplateEmail } from '@/lib/email'

export async function POST(request) {
    try {
        const { type, to, data } = await request.json()

        if (!type || !to) {
            return Response.json({ error: 'Missing type or to' }, { status: 400 })
        }

        // Map type to template_key (handle both formats)
        const templateKey = type.replace('_', '_') // welcome, campaign_activated, etc.

        const result = await sendTemplateEmail(templateKey, to, data)

        return Response.json(result)

    } catch (error) {
        console.error('Email API error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}