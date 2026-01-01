import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Define which roles can see which alert types
const ALERT_PERMISSIONS = {
    prize_pick_winner: ['super_admin', 'admin', 'manager', 'support'],
    prize_notify_winner: ['super_admin', 'admin', 'manager', 'support'],
    prize_pay_winner: ['super_admin', 'admin', 'manager', 'support'],
    prize_setup_missing: ['super_admin', 'admin', 'manager'],
    health_critical: ['super_admin', 'admin'],
    health_warning: ['super_admin', 'admin'],
    payout_pending: ['super_admin', 'admin'],
}

export async function GET() {
    try {
        const supabase = createRouteHandlerClient({ cookies })

        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user role
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, is_admin')
            .eq('id', user.id)
            .single()

        if (userError || !userData?.is_admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const userRole = userData.role || 'support'
        const alerts = []
        const now = new Date()

        // Get all dismissed alerts
        const { data: dismissals } = await supabase
            .from('admin_alert_dismissals')
            .select('alert_type, alert_key')

        const dismissedSet = new Set(
            (dismissals || []).map(d => `${d.alert_type}:${d.alert_key}`)
        )

        const isDismissed = (type, key) => dismissedSet.has(`${type}:${key}`)
        const canSee = (type) => ALERT_PERMISSIONS[type]?.includes(userRole)

        // ============================================
        // ALERT: Pick Winner (week ended, no winner)
        // ============================================
        if (canSee('prize_pick_winner')) {
            const { data: unpickedPrizes } = await supabase
                .from('weekly_prizes')
                .select('id, week_start, game_type, total_prize_pool, week_end_time')
                .is('winner_user_id', null)
                .lt('week_end_time', now.toISOString())
                .eq('is_active', true)

            for (const prize of unpickedPrizes || []) {
                const alertKey = `${prize.game_type}_${prize.week_start}`
                if (!isDismissed('prize_pick_winner', alertKey)) {
                    const weekDate = new Date(prize.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    alerts.push({
                        type: 'prize_pick_winner',
                        key: alertKey,
                        severity: 'critical',
                        icon: '🎲',
                        title: 'Pick Winner!',
                        description: `${prize.game_type.charAt(0).toUpperCase() + prize.game_type.slice(1)} week of ${weekDate} — $${prize.total_prize_pool} prize`,
                        actionUrl: '/admin/winners',
                        actionLabel: 'Pick Winner',
                        createdAt: prize.week_end_time,
                    })
                }
            }
        }

        // ============================================
        // ALERT: Notify Winner (verified, no email sent)
        // ============================================
        if (canSee('prize_notify_winner')) {
            const { data: unnotifiedPayouts } = await supabase
                .from('prize_payouts')
                .select(`
                    id, 
                    status, 
                    created_at,
                    users!prize_payouts_user_id_fkey(username),
                    weekly_prizes!prize_payouts_prize_id_fkey(game_type, week_start, total_prize_pool)
                `)
                .eq('status', 'verified')
                .is('email_sent_at', null)

            for (const payout of unnotifiedPayouts || []) {
                const alertKey = `payout_${payout.id}`
                if (!isDismissed('prize_notify_winner', alertKey)) {
                    const prize = payout.weekly_prizes
                    const username = payout.users?.username || 'Unknown'
                    alerts.push({
                        type: 'prize_notify_winner',
                        key: alertKey,
                        severity: 'high',
                        icon: '📧',
                        title: 'Notify Winner!',
                        description: `${username} won ${prize?.game_type || 'prize'} — needs email notification`,
                        actionUrl: '/admin/winners',
                        actionLabel: 'Send Email',
                        createdAt: payout.created_at,
                    })
                }
            }
        }

        // ============================================
        // ALERT: Pay Winner (verified, not paid)
        // ============================================
        if (canSee('prize_pay_winner')) {
            const { data: unpaidPayouts } = await supabase
                .from('prize_payouts')
                .select(`
                    id, 
                    status, 
                    created_at,
                    users!prize_payouts_user_id_fkey(username, payout_method, payout_handle),
                    weekly_prizes!prize_payouts_prize_id_fkey(game_type, week_start, total_prize_pool)
                `)
                .eq('status', 'verified')
                .is('paid_at', null)

            for (const payout of unpaidPayouts || []) {
                const alertKey = `pay_${payout.id}`
                if (!isDismissed('prize_pay_winner', alertKey)) {
                    const prize = payout.weekly_prizes
                    const user = payout.users
                    const username = user?.username || 'Unknown'
                    const paymentInfo = user?.payout_handle
                        ? `${user.payout_method || 'Payment'}: ${user.payout_handle}`
                        : 'No payment info'
                    alerts.push({
                        type: 'prize_pay_winner',
                        key: alertKey,
                        severity: 'medium',
                        icon: '💸',
                        title: `Pay @${username}`,
                        description: `$${prize?.total_prize_pool || 0} ${prize?.game_type || 'prize'} — ${paymentInfo}`,
                        actionUrl: '/admin/winners',
                        actionLabel: 'Process Payment',
                        createdAt: payout.created_at,
                    })
                }
            }
        }

        // ============================================
        // ALERT: Setup Next Week Prize
        // ============================================
        if (canSee('prize_setup_missing')) {
            // Check if next week has prizes configured
            const nextWeekStart = new Date()
            nextWeekStart.setDate(nextWeekStart.getDate() + (7 - nextWeekStart.getDay()))
            nextWeekStart.setHours(0, 0, 0, 0)
            const nextWeekStr = nextWeekStart.toISOString().split('T')[0]

            const { data: nextWeekPrizes } = await supabase
                .from('weekly_prizes')
                .select('id, game_type')
                .eq('week_start', nextWeekStr)

            // Check for each game type
            const gameTypes = ['slots', 'plinko', 'wheel']
            for (const gameType of gameTypes) {
                const hasPrize = nextWeekPrizes?.some(p => p.game_type === gameType)
                const alertKey = `setup_${gameType}_${nextWeekStr}`

                if (!hasPrize && !isDismissed('prize_setup_missing', alertKey)) {
                    alerts.push({
                        type: 'prize_setup_missing',
                        key: alertKey,
                        severity: 'high',
                        icon: '🎁',
                        title: 'Setup Prize!',
                        description: `No ${gameType} prize configured for next week`,
                        actionUrl: '/admin/prizes',
                        actionLabel: 'Configure Prize',
                        createdAt: now.toISOString(),
                    })
                }
            }
        }

        // ============================================
        // ALERT: Health Critical (negative available)
        // ============================================
        if (canSee('health_critical') || canSee('health_warning')) {
            // Simplified health check - get key financial data
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

            // Get revenue
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('amount_paid')
                .gte('created_at', monthStart)
                .neq('status', 'cancelled')

            const grossRevenue = campaigns?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0
            const processingFees = (grossRevenue * 0.029) + ((campaigns?.length || 0) * 0.30)
            const netRevenue = grossRevenue - processingFees

            // Get pending payouts
            const { data: pending } = await supabase
                .from('payout_queue')
                .select('amount')

            const pendingPayouts = pending?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

            // Get token liability
            const { data: tokenSetting } = await supabase
                .from('economy_settings')
                .select('setting_value')
                .eq('setting_key', 'token_value')
                .single()

            const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05

            const { data: balances } = await supabase
                .from('bb_balances')
                .select('balance')

            const totalTokens = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const tokenLiability = totalTokens * tokenValue

            // Get recurring expenses
            const { data: recurring } = await supabase
                .from('recurring_expenses')
                .select('amount, frequency')
                .eq('is_active', true)

            let monthlyExpenses = 0
            recurring?.forEach(exp => {
                if (exp.frequency === 'monthly') monthlyExpenses += parseFloat(exp.amount) || 0
                else if (exp.frequency === 'yearly') monthlyExpenses += (parseFloat(exp.amount) || 0) / 12
            })

            const trueAvailable = netRevenue - monthlyExpenses - pendingPayouts - tokenLiability

            // Critical: Negative
            if (canSee('health_critical') && trueAvailable < 0) {
                const alertKey = 'health_critical_current'
                if (!isDismissed('health_critical', alertKey)) {
                    alerts.push({
                        type: 'health_critical',
                        key: alertKey,
                        severity: 'critical',
                        icon: '🚨',
                        title: 'Health Critical!',
                        description: `Operating at $${Math.abs(trueAvailable).toFixed(2)} deficit this month`,
                        actionUrl: '/admin/health',
                        actionLabel: 'View Health',
                        createdAt: now.toISOString(),
                    })
                }
            }
            // Warning: Low but positive
            else if (canSee('health_warning') && trueAvailable >= 0 && trueAvailable < 100) {
                const alertKey = 'health_warning_current'
                if (!isDismissed('health_warning', alertKey)) {
                    alerts.push({
                        type: 'health_warning',
                        key: alertKey,
                        severity: 'medium',
                        icon: '⚠️',
                        title: 'Health Warning',
                        description: `Only $${trueAvailable.toFixed(2)} available — tight margins`,
                        actionUrl: '/admin/health',
                        actionLabel: 'View Health',
                        createdAt: now.toISOString(),
                    })
                }
            }
        }

        // ============================================
        // ALERT: Pending Payouts in Queue
        // ============================================
        if (canSee('payout_pending')) {
            const { data: pendingQueue } = await supabase
                .from('payout_queue')
                .select('id, amount, reason, created_at')
                .eq('status', 'pending')

            if (pendingQueue && pendingQueue.length > 0) {
                const alertKey = 'payout_queue_pending'
                if (!isDismissed('payout_pending', alertKey)) {
                    const totalAmount = pendingQueue.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                    alerts.push({
                        type: 'payout_pending',
                        key: alertKey,
                        severity: 'medium',
                        icon: '💳',
                        title: `${pendingQueue.length} Pending Payout${pendingQueue.length > 1 ? 's' : ''}`,
                        description: `$${totalAmount.toFixed(2)} waiting to be processed`,
                        actionUrl: '/admin/payout-queue',
                        actionLabel: 'Process Payouts',
                        createdAt: pendingQueue[0].created_at,
                    })
                }
            }
        }

        // Sort by severity (critical first, then high, then medium)
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

        return NextResponse.json({
            alerts,
            count: alerts.length,
            countBySeverity: {
                critical: alerts.filter(a => a.severity === 'critical').length,
                high: alerts.filter(a => a.severity === 'high').length,
                medium: alerts.filter(a => a.severity === 'medium').length,
            }
        })

    } catch (error) {
        console.error('Error fetching alerts:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Dismiss an alert
export async function POST(request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { alertType, alertKey, notes } = await request.json()

        if (!alertType || !alertKey) {
            return NextResponse.json({ error: 'Missing alertType or alertKey' }, { status: 400 })
        }

        // Insert dismissal record
        const { error: insertError } = await supabase
            .from('admin_alert_dismissals')
            .upsert({
                alert_type: alertType,
                alert_key: alertKey,
                dismissed_by: user.id,
                dismissed_at: new Date().toISOString(),
                notes: notes || null,
            }, {
                onConflict: 'alert_type,alert_key'
            })

        if (insertError) {
            console.error('Error dismissing alert:', insertError)
            return NextResponse.json({ error: 'Failed to dismiss alert' }, { status: 500 })
        }

        // Log to audit
        const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', user.id)
            .single()

        await supabase.from('admin_audit_log').insert({
            user_id: user.id,
            user_email: userData?.email,
            action: 'alert_dismissed',
            table_name: 'admin_alert_dismissals',
            record_id: alertKey,
            description: `Dismissed alert: ${alertType} - ${alertKey}`,
            new_value: { alertType, alertKey, notes },
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error dismissing alert:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}