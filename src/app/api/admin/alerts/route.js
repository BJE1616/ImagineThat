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
    email_test_mode: ['super_admin', 'admin'],
    health_no_revenue: ['super_admin', 'admin'],
    health_critical: ['super_admin', 'admin'],
    health_warning: ['super_admin', 'admin'],
    health_burn_rate: ['super_admin', 'admin'],
    payout_pending: ['super_admin', 'admin'],
    campaign_critical: ['super_admin', 'admin', 'manager'],
    campaign_warning: ['super_admin', 'admin', 'manager'],
}

export async function GET(request) {
    try {
        // Admin layout already protects this route
        // Default to admin role for permission checks
        const userRole = 'admin'
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
        // ALERT: Email Test Mode ON
        // ============================================
        if (canSee('email_test_mode')) {
            const { data: testModeSetting } = await supabaseAdmin
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'email_test_mode')
                .single()

            if (testModeSetting?.setting_value === 'true') {
                // Not dismissable - always shows when test mode is on
                alerts.push({
                    type: 'email_test_mode',
                    key: 'email_test_mode_active',
                    severity: 'high',
                    icon: '🧪',
                    title: 'Email Test Mode ON',
                    description: 'Real users won\'t receive emails — only going to test recipient',
                    actionUrl: '/admin/email-testing',
                    actionLabel: 'Turn Off',
                    createdAt: now.toISOString(),
                })
            }
        }

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
                .select('id, status, created_at, user_id, prize_id')
                .eq('status', 'verified')
                .is('email_sent_at', null)

            for (const payout of unnotifiedPayouts || []) {
                const { data: payoutUser } = await supabaseAdmin
                    .from('users')
                    .select('username')
                    .eq('id', payout.user_id)
                    .single()

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
                .select('id, status, created_at, user_id, prize_id')
                .eq('status', 'verified')
                .is('paid_at', null)

            for (const payout of unpaidPayouts || []) {
                const { data: payoutUser } = await supabaseAdmin
                    .from('users')
                    .select('username, payout_method, payout_handle')
                    .eq('id', payout.user_id)
                    .single()

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
        // ALERT: Setup Prize (configurable days ahead)
        // ============================================
        if (canSee('prize_setup_missing')) {
            // Get the days ahead setting
            const { data: alertDaysSetting } = await supabaseAdmin
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'prize_alert_days_ahead')
                .single()

            const daysAhead = parseInt(alertDaysSetting?.setting_value) || 14
            const weeksAhead = Math.ceil(daysAhead / 7)

            // Generate week starts for all weeks in range
            const weekStarts = []
            for (let i = 1; i <= weeksAhead; i++) {
                const weekStart = new Date()
                const currentDay = weekStart.getDay()
                const daysUntilNextSunday = 7 - currentDay
                weekStart.setDate(weekStart.getDate() + daysUntilNextSunday + ((i - 1) * 7))
                weekStart.setHours(0, 0, 0, 0)
                weekStarts.push(weekStart.toISOString().split('T')[0])
            }

            // Fetch all prizes for those weeks
            const { data: futurePrizes } = await supabaseAdmin
                .from('weekly_prizes')
                .select('id, game_type, week_start')
                .in('week_start', weekStarts)

            const gameTypes = ['slots', 'match_easy', 'match_challenge', 'solitaire']
            const gameLabels = {
                'slots': 'Slots',
                'match_easy': 'Match Easy',
                'match_challenge': 'Match Challenge',
                'solitaire': 'Solitaire'
            }

            for (const weekStr of weekStarts) {
                const weekDate = new Date(weekStr + 'T00:00:00')
                const weekEnd = new Date(weekDate)
                weekEnd.setDate(weekDate.getDate() + 6)
                const dateLabel = `${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

                for (const gameType of gameTypes) {
                    const hasPrize = futurePrizes?.some(p => p.game_type === gameType && p.week_start === weekStr)
                    const alertKey = `setup_${gameType}_${weekStr}`

                    if (!hasPrize && !isDismissed('prize_setup_missing', alertKey)) {
                        alerts.push({
                            type: 'prize_setup_missing',
                            key: alertKey,
                            severity: 'high',
                            icon: '🎁',
                            title: 'Setup Prize!',
                            description: `No ${gameLabels[gameType]} prize for ${dateLabel}`,
                            actionUrl: '/admin/prizes',
                            actionLabel: 'Configure',
                            createdAt: now.toISOString(),
                        })
                    }
                }
            }
        }

        // ============================================
        // ALERT: Health Checks (No Revenue, Deficit, Low Funds, Burn Rate)
        // Matches Health Dashboard logic exactly
        // ============================================
        if (canSee('health_no_revenue') || canSee('health_critical') || canSee('health_warning') || canSee('health_burn_rate')) {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

            const { data: healthCampaigns } = await supabaseAdmin
                .from('ad_campaigns')
                .select('amount_paid')
                .gte('created_at', monthStart)
                .neq('status', 'cancelled')

            const grossRevenue = healthCampaigns?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0
            const campaignCount = healthCampaigns?.filter(c => c.amount_paid > 0).length || 0
            const processingFees = (grossRevenue * 0.029) + (campaignCount * 0.30)
            const netRevenue = grossRevenue - processingFees

            // Recurring expenses (monthly)
            const { data: recurring } = await supabaseAdmin
                .from('recurring_expenses')
                .select('amount, frequency')
                .eq('is_active', true)

            let recurringExpenses = 0
            recurring?.forEach(exp => {
                if (exp.frequency === 'monthly') recurringExpenses += parseFloat(exp.amount) || 0
                else if (exp.frequency === 'yearly') recurringExpenses += (parseFloat(exp.amount) || 0) / 12
            })

            // One-time expenses this month
            const { data: oneTime } = await supabaseAdmin
                .from('expenses')
                .select('amount')
                .gte('expense_date', monthStart.split('T')[0])

            const oneTimeExpenses = oneTime?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0
            const totalHardCosts = recurringExpenses + oneTimeExpenses

            // Pending payouts
            const { data: pending } = await supabaseAdmin
                .from('payout_queue')
                .select('amount')

            const pendingPayouts = pending?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

            // Token value and liability
            const { data: tokenSetting } = await supabaseAdmin
                .from('economy_settings')
                .select('setting_value')
                .eq('setting_key', 'token_value')
                .single()

            const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05

            const { data: balances } = await supabaseAdmin
                .from('bb_balances')
                .select('balance, lifetime_spent')

            const totalTokens = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const totalBurned = balances?.reduce((sum, b) => sum + (b.lifetime_spent || 0), 0) || 0
            const tokenLiability = totalTokens * tokenValue

            // Daily leaderboard token cost (30 days default for monthly view)
            const { data: dailyConfigData } = await supabaseAdmin
                .from('daily_leaderboard_config')
                .select('first_tokens, second_tokens, third_tokens, is_enabled')
                .eq('is_enabled', true)

            let dailyTokensAwarded = 0
            dailyConfigData?.forEach(config => {
                dailyTokensAwarded += (config.first_tokens || 0) + (config.second_tokens || 0) + (config.third_tokens || 0)
            })
            const dailyTokenCost = dailyTokensAwarded * tokenValue * 30

            // Weekly prizes due (cash prizes, active, week ended)
            const { data: prizesDue } = await supabaseAdmin
                .from('weekly_prizes')
                .select('total_prize_pool, prize_type')
                .eq('prize_type', 'cash')
                .eq('is_active', true)
                .lte('week_end_time', now.toISOString())

            const weeklyPrizesDue = prizesDue?.reduce((sum, p) => sum + (parseFloat(p.total_prize_pool) || 0), 0) || 0

            // Final calculation - matches Health Dashboard exactly
            const totalObligations = pendingPayouts + weeklyPrizesDue + tokenLiability + dailyTokenCost
            const trueAvailable = netRevenue - totalHardCosts - totalObligations

            // IF/ELSE logic matching Health Dashboard - only show ONE of these three
            if (canSee('health_no_revenue') && netRevenue <= 0) {
                const alertKey = 'health_no_revenue_current'
                if (!isDismissed('health_no_revenue', alertKey)) {
                    alerts.push({
                        type: 'health_no_revenue',
                        key: alertKey,
                        severity: 'critical',
                        icon: '🚨',
                        title: 'No Revenue!',
                        description: 'No ad campaigns generating income this period',
                        actionUrl: '/admin/health',
                        actionLabel: 'View Health',
                        createdAt: now.toISOString(),
                    })
                }
            } else if (canSee('health_critical') && trueAvailable < 0) {
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
            } else if (canSee('health_warning') && trueAvailable >= 0 && trueAvailable < 100) {
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

            // Burn Rate check - can appear ALONGSIDE any of the above
            if (canSee('health_burn_rate') && totalBurned === 0 && totalTokens > 0) {
                const alertKey = 'health_burn_rate_zero'
                if (!isDismissed('health_burn_rate', alertKey)) {
                    alerts.push({
                        type: 'health_burn_rate',
                        key: alertKey,
                        severity: 'medium',
                        icon: '🔥',
                        title: '0% Token Burn Rate',
                        description: 'No tokens being spent — liability only grows',
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

            const { data: activeCampaigns } = await supabaseAdmin
                .from('ad_campaigns')
                .select('id, business_card_id, contracted_views, bonus_views, total_views, status')
                .eq('status', 'active')

            for (const campaign of activeCampaigns || []) {
                const totalViews = (campaign.contracted_views || 0) + (campaign.bonus_views || 0)
                if (totalViews === 0) continue

                const percent = Math.min(100, Math.round((campaign.total_views / totalViews) * 100))

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

export async function POST(request) {
    try {
        const { alertType, alertKey, notes, userId } = await request.json()

        if (!alertType || !alertKey) {
            return Response.json({ error: 'Missing alertType or alertKey' }, { status: 400 })
        }

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