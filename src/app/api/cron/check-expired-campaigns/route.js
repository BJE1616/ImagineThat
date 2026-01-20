import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Find all active campaigns that have expired
        const now = new Date().toISOString()
        
        const { data: expiredCampaigns, error: fetchError } = await supabase
            .from('ad_campaigns')
            .select('id, user_id, expires_at')
            .eq('status', 'active')
            .not('expires_at', 'is', null)
            .lte('expires_at', now)

        if (fetchError) throw fetchError

        if (!expiredCampaigns || expiredCampaigns.length === 0) {
            return Response.json({ 
                message: 'No expired campaigns found',
                checked_at: now 
            })
        }

        // Mark each expired campaign as completed
        const results = []
        for (const campaign of expiredCampaigns) {
            const { error: updateError } = await supabase
                .from('ad_campaigns')
                .update({
                    status: 'completed',
                    updated_at: now
                })
                .eq('id', campaign.id)

            if (updateError) {
                results.push({ id: campaign.id, success: false, error: updateError.message })
            } else {
                results.push({ id: campaign.id, success: true })
            }
        }

        console.log(`✅ Checked expired campaigns: ${expiredCampaigns.length} found, processed`)

        return Response.json({
            message: `Processed ${expiredCampaigns.length} expired campaigns`,
            results,
            checked_at: now
        })

    } catch (error) {
        console.error('Error checking expired campaigns:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}
