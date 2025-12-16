import { sendEmail, emailTemplates } from '@/lib/email'

export async function POST(request) {
    try {
        const { type, to, data } = await request.json()

        let emailContent

        switch (type) {
            case 'welcome':
                emailContent = emailTemplates.welcome(data.username)
                break
            case 'campaign_activated':
                emailContent = emailTemplates.campaignActivated(data.username, data.views)
                break
            case 'campaign_completed':
                emailContent = emailTemplates.campaignCompleted(data.username, data.views)
                break
            case 'prize_winner':
                emailContent = emailTemplates.prizeWinner(data.username, data.rank, data.prize)
                break
            case 'matrix_complete':
                emailContent = emailTemplates.matrixComplete(data.username, data.payout)
                break
            default:
                return Response.json({ error: 'Invalid email type' }, { status: 400 })
        }

        const result = await sendEmail({
            to,
            subject: emailContent.subject,
            html: emailContent.html
        })

        return Response.json(result)

    } catch (error) {
        console.error('Email API error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}