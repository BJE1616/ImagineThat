import { createClient } from '@supabase/supabase-js'
import { sendTemplateEmail } from '@/lib/email'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { data: pendingPayouts, error } = await supabase
            .from('payout_queue')
            .select('amount')
            .eq('status', 'pending')

        if (error) {
            console.error('Error fetching payout queue:', error)
            return Response.json({ error: 'Failed to fetch payouts' }, { status: 500 })
        }

        const count = pendingPayouts?.length || 0

        if (count === 0) {
            return Response.json({ success: true, message: 'No pending payouts', sent: false })
        }

        const totalAmount = pendingPayouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

        // Get admin emails by joining admin_users with users
        const { data: admins } = await supabase
            .from('admin_users')
            .select('user_id, role, users(email)')
            .in('role', ['super_admin', 'admin'])

        const adminEmails = admins?.filter(a => a.users?.email).map(a => a.users.email) || []

        if (adminEmails.length === 0) {
            return Response.json({ success: false, error: 'No admin emails found' }, { status: 500 })
        }

        let sentCount = 0
        for (const email of adminEmails) {
            try {
                await sendTemplateEmail('daily_payout_reminder', email, {
                    count: count.toString(),
                    total_amount: totalAmount.toFixed(2)
                })
                sentCount++
            } catch (emailError) {
                console.error(`Failed to send to ${email}:`, emailError)
            }
        }

        return Response.json({
            success: true,
            message: `Sent payout reminder to ${sentCount} admin(s)`,
            pending_count: count,
            total_amount: totalAmount.toFixed(2)
        })

    } catch (error) {
        console.error('Cron payout-reminder error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}