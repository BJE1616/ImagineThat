import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const payload = await request.json()

        // Supabase sends: type, table, record, old_record
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

        // Get email settings
        const { data: settings } = await supabase
            .from('admin_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['email_test_mode', 'test_email_recipient'])

        const settingsObj = {}
        settings?.forEach(s => { settingsObj[s.setting_key] = s.setting_value })

        const testMode = settingsObj.email_test_mode === 'true'
        const testRecipient = settingsObj.test_email_recipient || 'bje1616@gmail.com'

        const emailTo = testMode ? testRecipient : user.email

        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
            from: 'ImagineThat <noreply@imaginethat.icu>',
            to: emailTo,
            subject: 'Campaign Complete! ✅',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #22c55e;">Campaign Complete!</h1>
                    <p>Hey ${user.username},</p>
                    <p>Your advertising campaign has finished delivering all guaranteed views.</p>
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white;">
                        <p style="margin: 0;"><strong>Total Views Delivered:</strong> ${totalViews.toLocaleString()}</p>
                    </div>
                    <p>Ready to reach more customers? Start a new campaign today!</p>
                    <a href="https://imaginethat.icu/advertise" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Start New Campaign</a>
                    <p style="margin-top: 30px; color: #666;">Thanks for advertising with us!<br>The ImagineThat Team</p>
                </div>
            `
        })

        console.log('📧 Campaign completed email sent to:', emailTo)

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

        // Get email settings
        const { data: settings } = await supabase
            .from('admin_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['email_test_mode', 'test_email_recipient'])

        const settingsObj = {}
        settings?.forEach(s => { settingsObj[s.setting_key] = s.setting_value })

        const testMode = settingsObj.email_test_mode === 'true'
        const testRecipient = settingsObj.test_email_recipient || 'bje1616@gmail.com'

        const emailTo = testMode ? testRecipient : user.email

        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
            from: 'ImagineThat <noreply@imaginethat.icu>',
            to: emailTo,
            subject: 'Your Campaign is Live! 🚀',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #22c55e;">Your Campaign is Active!</h1>
                    <p>Hey ${user.username},</p>
                    <p>Great news! Your queued advertising campaign is now live.</p>
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white;">
                        <p style="margin: 0;"><strong>Guaranteed Views:</strong> ${(campaign.views_guaranteed || 0).toLocaleString()}</p>
                    </div>
                    <p>Your business card is now being shown to players. Check your dashboard to track progress!</p>
                    <a href="https://imaginethat.icu/dashboard" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>
                    <p style="margin-top: 30px; color: #666;">Thanks for advertising with us!<br>The ImagineThat Team</p>
                </div>
            `
        })

        console.log('📧 Campaign activated email sent to:', emailTo)

    } catch (error) {
        console.error('Campaign activated email error:', error)
    }
}