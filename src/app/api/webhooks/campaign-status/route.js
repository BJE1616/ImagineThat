import { sendTemplateEmail } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const payload = await request.json()
        const { type, record, old_record } = payload

        if (type !== 'UPDATE') return Response.json({ message: 'Ignored' })

        const newStatus = record?.status
        const oldStatus = old_record?.status

        // Campaign just completed
        if (newStatus === 'completed' && oldStatus === 'active') {
            await sendCampaignCompletedEmail(record)
        }

        // Campaign just activated (from queued)
        if (newStatus === 'active' && oldStatus === 'queued') {
            await sendCampaignActivatedEmail(record)
        }

        return Response.json({ success: true })

    } catch (error) {
        console.error('Webhook error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}

async function sendCampaignCompletedEmail(campaign) {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('email, username')
            .eq('id', campaign.user_id)
            .single()

        if (!user) return

        const totalViews = (campaign.views_from_game || 0) +
            (campaign.views_from_flips || 0) +
            (campaign.views_from_card_back || 0) +
            (campaign.bonus_views || 0)

        const bonusTotal = totalViews - (campaign.views_guaranteed || 0)

        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return 'N/A'
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }

        const result = await sendTemplateEmail('campaign_completed', user.email, {
            username: user.username,
            views_guaranteed: (campaign.views_guaranteed || 0).toLocaleString(),
            total_views: totalViews.toLocaleString(),
            bonus_total: bonusTotal.toLocaleString(),
            views_from_flips: (campaign.views_from_flips || 0).toLocaleString(),
            views_from_card_back: (campaign.views_from_card_back || 0).toLocaleString(),
            views_from_game: (campaign.views_from_game || 0).toLocaleString(),
            bonus_views: (campaign.bonus_views || 0).toLocaleString(),
            total_clicks: (campaign.total_clicks || 0).toLocaleString(),
            started_at: formatDate(campaign.started_at),
            completed_at: formatDate(campaign.completed_at)
        })

        if (result.success) {
            console.log('📧 Campaign completed email sent to:', result.testMode ? 'TEST MODE' : user.email)
        } else {
            console.error('Campaign completed email failed:', result.error)
        }

    } catch (error) {
        console.error('Campaign completed email error:', error)
    }
}

async function sendCampaignActivatedEmail(campaign) {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('email, username')
            .eq('id', campaign.user_id)
            .single()

        if (!user) return

        const result = await sendTemplateEmail('campaign_activated', user.email, {
            username: user.username,
            views: (campaign.views_guaranteed || 0).toLocaleString(),
            duration: '30 days'
        })

        if (result.success) {
            console.log('📧 Campaign activated email sent to:', result.testMode ? 'TEST MODE' : user.email)
        } else {
            console.error('Campaign activated email failed:', result.error)
        }

    } catch (error) {
        console.error('Campaign activated email error:', error)
    }
}