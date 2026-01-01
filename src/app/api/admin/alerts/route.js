import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Define which roles can see which alert types
const ALERT_PERMISSIONS = {
    prize_pick_winner: ['super_admin', 'admin', 'manager', 'support'],
    prize_notify_winner: ['super_admin', 'admin', 'manager', 'support'],
    prize_pay_winner: ['super_admin', 'admin', 'manager', 'support'],
    prize_setup_missing: ['super_admin', 'admin', 'manager'],
    health_critical: ['super_admin', 'admin'],
    health_warning: ['super_admin', 'admin'],
    payout_pending: ['super_admin', 'admin'],
    campaign_critical: ['super_admin', 'admin', 'manager'],
    campaign_warning: ['super_admin', 'admin', 'manager'],
}

export async function GET(request) {
    try {
        // Get user from authorization header or cookie
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        // Get user session
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            token || (await getTokenFromCookie(request))
        )

        if (authError || !user) {
            // Try alternative: get user from cookie
            const cookieHeader = request.headers.get('cookie')
            if (cookieHeader) {
                const { data: sessionData } = await supabaseAdmin.auth.getSession()
                if (!sessionData?.session?.user) {
                    return Response.json({ error: 'Unauthorized' }, { status: 401 })
                }
            } else {
                return Response.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        // Get user role
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role, is_admin')
            .eq('id', user?.id)
            .single()

        if (userError || !userData?.is_admin) {
            return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const userRole = userData.role || 'support'
        const alerts = []
        const now = new Date()

        // Get all dismissed alerts
        const { data: dismissals } = await supabaseAdmin
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
            const { data: unpickedPrizes } = await supabaseAdmin
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
            const { data: unnotifiedPayouts } = await supabaseAdmin
                .from('prize_payouts')
                .select(`
                    id, 
                    status, 
                    created_at,
                    user_id,
                    prize_id
                `)
                .eq('status', 'verified')
                .is('email_sent_at', null)

            for (const payout of unnotifiedPayouts || []) {
                // Get user info
                const { data: payoutUser } = await supabaseAdmin
                    .from('users')
                    .select('username')
                    .eq('id', payout.user_id)
                    .single()

                // Get prize info
                const { data: prize } = await supabaseAdmin
                    .from('weekly_prizes')
                    .select('game_type, week_start, total_prize_pool')
                    .eq('id', payout.prize_id)
                    .single()

                const alertKey = `payout_${payout.id}`
                if (!isDismissed('prize_notify_winner', alertKey)) {
                    const username = payoutUser?.username || 'Unknown'
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
            const { data: unpaidPayouts } = await supabaseAdmin
                .from('prize_payouts')
                .select(`
                    id, 
                    status, 
                    created_at,
                    user_id,
                    prize_id
                `)
                .eq('status', 'verified')
                .is('paid_at', null)

            for (const payout of unpaidPayouts || []) {
                // Get user info
                const { data: payoutUser } = await supabaseAdmin
                    .from('users')
                    .select('username, payout_method, payout_handle')
                    .eq('id', payout.user_id)
                    .single()

                // Get prize info
                const { data: prize } = await supabaseAdmin
                    .from('weekly_prizes')
                    .select('game_type, week_start, total_prize_pool')
                    .eq('id', payout.prize_id)
                    .single()

                const alertKey = `pay_${payout.id}`
                if (!isDismissed('prize_pay_winner', alertKey)) {
                    const username = payoutUser?.username || 'Unknown'
                    const paymentInfo = payoutUser?.payout_handle
                        ? `${payoutUser.payout_method || 'Payment'}: ${payoutUser.payout_handle}`
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

            const { data: nextWeekPrizes } = await supabaseAdmin
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
            const { data: healthCampaigns } = await supabaseAdmin
                .from('ad_campaigns')
                .select('amount_paid')
                .gte('created_at', monthStart)
                .neq('status', 'cancelled')

            const grossRevenue = healthCampaigns?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0
            const processingFees = (grossRevenue * 0.029) + ((healthCampaigns?.length || 0) * 0.30)
            const netRevenue = grossRevenue - processingFees

            // Get pending payouts
            const { data: pending } = await supabaseAdmin
                .from('payout_queue')
                .select('amount')

            const pendingPayouts = pending?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

            // Get token liability
            const { data: tokenSetting } = await supabaseAdmin
                .from('economy_settings')
                .select('setting_value')
                .eq('setting_key', 'token_value')
                .single()

            const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05

            const { data: balances } = await supabaseAdmin
                .from('bb_balances')
                .select('balance')

            const totalTokens = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const tokenLiability = totalTokens * tokenValue

            // Get recurring expenses
            const { data: recurring } = await supabaseAdmin
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
            const { data: pendingQueue } = await supabaseAdmin
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

        // ============================================
        // ALERT: Campaign Near Completion
        // ============================================
        if (canSee('campaign_critical') || canSee('campaign_warning')) {
            // Get thresholds from settings
            const { data: thresholdSettings } = await supabaseAdmin
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['campaign_alert_warning', 'campaign_alert_critical'])

            let warningThreshold = 75
            let criticalThreshold = 90
            thresholdSettings?.forEach(s => {
                if (s.setting_key === 'campaign_alert_warning') warningThreshold = parseInt(s.setting_value) || 75
                if (s.setting_key === 'campaign_alert_critical') criticalThreshold = parseInt(s.setting_value) || 90
            })

            // Get active campaigns
            const { data: activeCampaigns } = await supabaseAdmin
                .from('ad_campaigns')
                .select('id, business_card_id, contracted_views, bonus_views, total_views, status')
                .eq('status', 'active')

            for (const campaign of activeCampaigns || []) {
                const totalViews = (campaign.contracted_views || 0) + (campaign.bonus_views || 0)
                if (totalViews === 0) continue

                const percent = Math.min(100, Math.round((campaign.total_views / totalViews) * 100))

                // Get business name separately
                let businessName = 'Unknown Campaign'
                if (campaign.business_card_id) {
                    const { data: card } = await supabaseAdmin
                        .from('business_cards')
                        .select('business_name, full_business_name')
                        .eq('id', campaign.business_card_id)
                        .single()
                    businessName = card?.business_name || card?.full_business_name || 'Unknown Campaign'
                }

                if (percent >= criticalThreshold && canSee('campaign_critical')) {
                    const alertKey = `campaign_critical_${campaign.id}`
                    if (!isDismissed('campaign_critical', alertKey)) {
                        alerts.push({
                            type: 'campaign_critical',
                            key: alertKey,
                            severity: 'critical',
                            icon: '📢',
                            title: 'Campaign Almost Done!',
                            description: `${businessName} at ${percent}% — needs attention soon`,
                            actionUrl: '/admin/campaigns',
                            actionLabel: 'View Campaign',
                            createdAt: now.toISOString(),
                        })
                    }
                } else if (percent >= warningThreshold && canSee('campaign_warning')) {
                    const alertKey = `campaign_warning_${campaign.id}`
                    if (!isDismissed('campaign_warning', alertKey)) {
                        alerts.push({
                            type: 'campaign_warning',
                            key: alertKey,
                            severity: 'medium',
                            icon: '📊',
                            title: 'Campaign Nearing End',
                            description: `${businessName} at ${percent}% completion`,
                            actionUrl: '/admin/campaigns',
                            actionLabel: 'View Campaign',
                            createdAt: now.toISOString(),
                        })
                    }
                }
            }
        }

        // Sort by severity (critical first, then high, then medium)
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

        return Response.json({
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
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Dismiss an alert
export async function POST(request) {
    try {
        const { alertType, alertKey, notes, userId } = await request.json()

        if (!alertType || !alertKey) {
            return Response.json({ error: 'Missing alertType or alertKey' }, { status: 400 })
        }

        // Insert dismissal record
        const { error: insertError } = await supabaseAdmin
            .from('admin_alert_dismissals')
            .upsert({
                alert_type: alertType,
                alert_key: alertKey,
                dismissed_by: userId || null,
                dismissed_at: new Date().toISOString(),
                notes: notes || null,
            }, {
                onConflict: 'alert_type,alert_key'
            })

        if (insertError) {
            console.error('Error dismissing alert:', insertError)
            return Response.json({ error: 'Failed to dismiss alert' }, { status: 500 })
        }

        // Log to audit if userId provided
        if (userId) {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('email')
                .eq('id', userId)
                .single()

            await supabaseAdmin.from('admin_audit_log').insert({
                user_id: userId,
                user_email: userData?.email,
                action: 'alert_dismissed',
                table_name: 'admin_alert_dismissals',
                record_id: alertKey,
                description: `Dismissed alert: ${alertType} - ${alertKey}`,
                new_value: { alertType, alertKey, notes },
            })
        }

        return Response.json({ success: true })

    } catch (error) {
        console.error('Error dismissing alert:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}