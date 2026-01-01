'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminWinnersPage() {
    const { currentTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('slots')

    // ===== MATCH GAME STATE =====
    const [leaderboard, setLeaderboard] = useState([])
    const [payments, setPayments] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [weekOffset, setWeekOffset] = useState(0)
    const [currentWeek, setCurrentWeek] = useState('')

    // ===== SLOTS DRAWING STATE =====
    const [slotsPrize, setSlotsPrize] = useState(null)
    const [slotsEntries, setSlotsEntries] = useState([])
    const [slotsLoading, setSlotsLoading] = useState(true)
    const [selectedWinner, setSelectedWinner] = useState(null)
    const [announcing, setAnnouncing] = useState(false)
    const [message, setMessage] = useState(null)

    // ===== VERIFICATION STATE =====
    const [verificationData, setVerificationData] = useState(null)
    const [verificationLoading, setVerificationLoading] = useState(false)
    const [verificationStep, setVerificationStep] = useState('pick')

    // ===== PAYOUT STATE =====
    const [payoutStatus, setPayoutStatus] = useState(null)
    const [payoutNotes, setPayoutNotes] = useState('')
    const [savingPayout, setSavingPayout] = useState(false)

    // ===== EMAIL MODAL STATE =====
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')
    const [sendingEmail, setSendingEmail] = useState(false)

    // ===== MARK AS NOTIFIED STATE =====
    const [showNotifiedModal, setShowNotifiedModal] = useState(false)
    const [notificationNote, setNotificationNote] = useState('')
    const [savingNotified, setSavingNotified] = useState(false)

    useEffect(() => {
        if (activeTab === 'match') {
            loadWeekData()
        } else {
            loadSlotsDrawing()
        }
    }, [weekOffset, activeTab])

    // ===== MATCH GAME FUNCTIONS =====
    const getWeekStart = (offset = 0) => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek - (offset * 7))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }

    const formatWeekRange = (weekStart) => {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekStart.getFullYear()}`
    }

    const loadWeekData = async () => {
        setLoading(true)
        try {
            const weekStart = getWeekStart(weekOffset)
            const weekStartStr = weekStart.toISOString().split('T')[0]
            setCurrentWeek(formatWeekRange(weekStart))

            const { data: leaderboardData, error: leaderboardError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStartStr)
                .order('score', { ascending: true })
                .limit(20)

            if (leaderboardError) throw leaderboardError

            if (leaderboardData && leaderboardData.length > 0) {
                const userIds = leaderboardData.map(entry => entry.user_id)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const combined = leaderboardData.map(entry => ({
                    ...entry,
                    user: usersData?.find(u => u.id === entry.user_id) || { username: 'Unknown', email: '' }
                }))

                setLeaderboard(combined)

                const { data: paymentsData } = await supabase
                    .from('prize_payments')
                    .select('*')
                    .eq('week_start', weekStartStr)
                    .in('leaderboard_id', leaderboardData.map(e => e.id))

                const paymentsMap = {}
                paymentsData?.forEach(p => {
                    paymentsMap[p.leaderboard_id] = p
                })
                setPayments(paymentsMap)
            } else {
                setLeaderboard([])
                setPayments({})
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    // ===== SLOTS DRAWING FUNCTIONS =====
    const loadSlotsDrawing = async () => {
        setSlotsLoading(true)
        try {
            const weekStart = getWeekStart(weekOffset)
            const weekStartStr = weekStart.toISOString().split('T')[0]
            setCurrentWeek(formatWeekRange(weekStart))

            const { data: prizeData } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('game_type', 'slots')
                .eq('week_start', weekStartStr)
                .single()

            setSlotsPrize(prizeData || null)

            if (prizeData?.winner_user_id) {
                setVerificationStep('confirmed')
                await loadPayoutStatus(prizeData.id)
                await loadVerificationData(prizeData.winner_user_id)
            } else {
                setVerificationStep('pick')
                setSelectedWinner(null)
                setVerificationData(null)
            }

            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            const weekEndStr = weekEnd.toISOString().split('T')[0]

            const { data: entriesData } = await supabase
                .from('user_daily_spins')
                .select('user_id, drawing_entries, spin_date')
                .gte('spin_date', weekStartStr)
                .lte('spin_date', weekEndStr)
                .gt('drawing_entries', 0)

            if (entriesData && entriesData.length > 0) {
                const userEntries = {}
                entriesData.forEach(e => {
                    if (!userEntries[e.user_id]) {
                        userEntries[e.user_id] = 0
                    }
                    userEntries[e.user_id] += e.drawing_entries || 0
                })

                const userIds = Object.keys(userEntries)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const entriesList = Object.entries(userEntries).map(([userId, entries]) => ({
                    user_id: userId,
                    entries: entries,
                    user: usersData?.find(u => u.id === userId) || { username: 'Unknown', email: '' }
                })).sort((a, b) => b.entries - a.entries)

                setSlotsEntries(entriesList)
            } else {
                setSlotsEntries([])
            }
        } catch (error) {
            console.error('Error loading slots drawing:', error)
        } finally {
            setSlotsLoading(false)
        }
    }

    // ===== VERIFICATION FUNCTIONS =====
    const loadVerificationData = async (userId) => {
        setVerificationLoading(true)
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('id, username, email, first_name, last_name, created_at, payout_method, payout_handle')
                .eq('id', userId)
                .single()

            const { data: balanceData } = await supabase
                .from('bb_balances')
                .select('balance, lifetime_earned')
                .eq('user_id', userId)
                .single()

            const { data: spinsData } = await supabase
                .from('user_daily_spins')
                .select('free_spins_used, paid_spins')
                .eq('user_id', userId)

            const totalSpins = spinsData?.reduce((sum, day) =>
                sum + (day.free_spins_used || 0) + (day.paid_spins || 0), 0) || 0

            const { data: ipLogs } = await supabase
                .from('user_ip_logs')
                .select('ip_address, city, region, country, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)

            const userIps = [...new Set(ipLogs?.map(log => log.ip_address) || [])]
            let fraudFlags = []

            if (userIps.length > 0) {
                const { data: sharedIpAccounts } = await supabase
                    .from('user_ip_logs')
                    .select('user_id, ip_address')
                    .in('ip_address', userIps)
                    .neq('user_id', userId)

                if (sharedIpAccounts && sharedIpAccounts.length > 0) {
                    const sharedUserIds = [...new Set(sharedIpAccounts.map(a => a.user_id))]

                    const { data: sharedUsers } = await supabase
                        .from('users')
                        .select('id, username, email')
                        .in('id', sharedUserIds)

                    fraudFlags = sharedUsers?.map(u => ({
                        type: 'shared_ip',
                        message: `Shares IP with: ${u.username} (${u.email})`,
                        severity: 'warning'
                    })) || []
                }
            }

            const accountAge = userData?.created_at
                ? Math.floor((new Date() - new Date(userData.created_at)) / (1000 * 60 * 60 * 24))
                : 0

            if (accountAge < 7) {
                fraudFlags.push({
                    type: 'new_account',
                    message: `Account is only ${accountAge} days old`,
                    severity: 'warning'
                })
            }

            const selectedEntry = slotsEntries.find(e => e.user_id === userId)
            const avgEntriesPerSpin = selectedEntry && totalSpins > 0
                ? (selectedEntry.entries / totalSpins)
                : 0

            if (avgEntriesPerSpin > 5) {
                fraudFlags.push({
                    type: 'high_entry_ratio',
                    message: `Unusually high entries per spin ratio (${avgEntriesPerSpin.toFixed(1)})`,
                    severity: 'info'
                })
            }

            setVerificationData({
                user: userData,
                balance: balanceData?.balance || 0,
                lifetimeEarned: balanceData?.lifetime_earned || 0,
                totalSpins,
                accountAge,
                ipLogs: ipLogs || [],
                uniqueLocations: [...new Set(ipLogs?.map(l => `${l.city}, ${l.country}`))],
                fraudFlags
            })

        } catch (error) {
            console.error('Error loading verification data:', error)
            setMessage({ type: 'error', text: 'Failed to load verification data' })
        } finally {
            setVerificationLoading(false)
        }
    }

    const loadPayoutStatus = async (prizeId) => {
        try {
            const { data } = await supabase
                .from('prize_payouts')
                .select('*')
                .eq('prize_id', prizeId)
                .single()

            if (data) {
                setPayoutStatus(data)
                setPayoutNotes(data.notes || '')
            } else {
                setPayoutStatus(null)
                setPayoutNotes('')
            }
        } catch (error) {
            setPayoutStatus(null)
            setPayoutNotes('')
        }
    }

    const pickRandomWinner = async () => {
        if (slotsEntries.length === 0) return

        const totalEntries = slotsEntries.reduce((sum, e) => sum + e.entries, 0)
        let random = Math.random() * totalEntries

        let winner = slotsEntries[0]
        for (const entry of slotsEntries) {
            random -= entry.entries
            if (random <= 0) {
                winner = entry
                break
            }
        }

        setSelectedWinner(winner)
        setVerificationStep('verify')
        await loadVerificationData(winner.user_id)
    }

    const confirmWinner = async () => {
        if (!selectedWinner || !slotsPrize) return
        setAnnouncing(true)

        try {
            const { error } = await supabase
                .from('weekly_prizes')
                .update({
                    winner_user_id: selectedWinner.user_id,
                    winner_selected_at: new Date().toISOString(),
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', slotsPrize.id)

            if (error) throw error

            const { data: payoutData } = await supabase
                .from('prize_payouts')
                .insert([{
                    prize_id: slotsPrize.id,
                    user_id: selectedWinner.user_id,
                    status: 'pending',
                    notes: '',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single()

            // Audit log: Winner selected
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'winner_selected',
                table_name: 'weekly_prizes',
                record_id: slotsPrize.id,
                new_value: { winner_user_id: selectedWinner.user_id, username: selectedWinner.user.username },
                description: `Selected ${selectedWinner.user.username} as Slots winner for ${currentWeek}`
            }])

            setMessage({ type: 'success', text: `🎉 Winner confirmed: ${selectedWinner.user.username}!` })
            setVerificationStep('confirmed')

            loadSlotsDrawing()
        } catch (error) {
            console.error('Error confirming winner:', error)
            setMessage({ type: 'error', text: 'Failed to confirm winner. Please try again.' })
        } finally {
            setAnnouncing(false)
        }
    }

    const clearSelection = () => {
        setSelectedWinner(null)
        setVerificationData(null)
        setVerificationStep('pick')
    }

    const updatePayoutStatus = async (newStatus) => {
        if (!slotsPrize || !payoutStatus) return
        setSavingPayout(true)

        try {
            // Update prize_payouts record
            const updateData = {
                status: newStatus,
                notes: payoutNotes,
                updated_at: new Date().toISOString()
            }

            if (newStatus === 'paid') {
                updateData.paid_at = new Date().toISOString()
            }

            const { error } = await supabase
                .from('prize_payouts')
                .update(updateData)
                .eq('id', payoutStatus.id)

            if (error) throw error

            // If status is "verified", add to payout_queue AND public_winners
            if (newStatus === 'verified') {
                // Get user payment info
                const { data: userData } = await supabase
                    .from('users')
                    .select('username, payout_method, payout_handle')
                    .eq('id', verificationData.user.id)
                    .single()

                // Calculate prize amount
                const prizeAmount = slotsPrize.prize_type === 'cash'
                    ? slotsPrize.total_prize_pool
                    : 0

                // Add to payout_queue if cash prize
                if (prizeAmount > 0) {
                    // Check if already in queue
                    const { data: existingQueue } = await supabase
                        .from('payout_queue')
                        .select('id')
                        .eq('reference_type', 'weekly_prize')
                        .eq('reference_id', payoutStatus.id)
                        .single()

                    if (!existingQueue) {
                        await supabase
                            .from('payout_queue')
                            .insert([{
                                user_id: verificationData.user.id,
                                amount: prizeAmount,
                                reason: `Weekly Slots Prize - ${currentWeek}`,
                                reference_type: 'weekly_prize',
                                reference_id: payoutStatus.id,
                                payment_method: userData?.payout_method || null,
                                payment_handle: userData?.payout_handle || null,
                                status: 'pending',
                                queued_at: new Date().toISOString()
                            }])
                    }
                }

                // Add to public_winners
                const { data: existingPublicWinner } = await supabase
                    .from('public_winners')
                    .select('id')
                    .eq('payout_id', payoutStatus.id)
                    .single()

                if (!existingPublicWinner) {
                    const weekStart = getWeekStart(weekOffset)
                    const weekStartStr = weekStart.toISOString().split('T')[0]

                    const prizeDisplay = slotsPrize.prize_type === 'cash'
                        ? `$${slotsPrize.total_prize_pool} Cash Prize`
                        : (slotsPrize.prize_descriptions?.[0] || 'Special Prize')

                    await supabase
                        .from('public_winners')
                        .insert([{
                            user_id: verificationData.user.id,
                            prize_id: slotsPrize.id,
                            payout_id: payoutStatus.id,
                            display_name: userData?.username || verificationData.user.username,
                            display_text: prizeDisplay,
                            prize_type: slotsPrize.prize_type,
                            prize_value: prizeAmount,
                            is_visible: true,
                            is_featured: false,
                            verified_at: new Date().toISOString(),
                            week_start: weekStartStr,
                            game_type: 'slots'
                        }])
                }

                // Audit log: Winner verified
                await supabase.from('admin_audit_log').insert([{
                    user_email: (await supabase.auth.getUser()).data.user?.email,
                    action: 'winner_verified',
                    table_name: 'prize_payouts',
                    record_id: payoutStatus.id,
                    new_value: { status: 'verified', username: verificationData.user.username, prize_amount: prizeAmount },
                    description: `Verified ${verificationData.user.username} as winner, added to payout queue ($${prizeAmount})`
                }])

                setMessage({ type: 'success', text: `✅ Winner verified! Added to payout queue and winners board.` })
            } else if (newStatus === 'paid') {
                // Update public_winners paid_at
                await supabase
                    .from('public_winners')
                    .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq('payout_id', payoutStatus.id)

                // Audit log: Winner paid
                await supabase.from('admin_audit_log').insert([{
                    user_email: (await supabase.auth.getUser()).data.user?.email,
                    action: 'winner_paid',
                    table_name: 'prize_payouts',
                    record_id: payoutStatus.id,
                    new_value: { status: 'paid', username: verificationData.user.username },
                    description: `Marked ${verificationData.user.username} as paid for Slots prize`
                }])

                setMessage({ type: 'success', text: `💰 Marked as paid!` })
            } else {
                setMessage({ type: 'success', text: `Status updated to: ${newStatus}` })
            }

            setPayoutStatus(prev => ({ ...prev, status: newStatus }))
        } catch (error) {
            console.error('Error updating payout:', error)
            setMessage({ type: 'error', text: 'Failed to update status' })
        } finally {
            setSavingPayout(false)
        }
    }

    const savePayoutNotes = async () => {
        if (!payoutStatus) return
        setSavingPayout(true)

        try {
            const { error } = await supabase
                .from('prize_payouts')
                .update({
                    notes: payoutNotes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', payoutStatus.id)

            if (error) throw error
            setMessage({ type: 'success', text: 'Notes saved' })
        } catch (error) {
            console.error('Error saving notes:', error)
            setMessage({ type: 'error', text: 'Failed to save notes' })
        } finally {
            setSavingPayout(false)
        }
    }

    // ===== EMAIL FUNCTIONS =====
    const openEmailPreview = async () => {
        try {
            // Fetch the prize_winner email template
            const { data: template, error } = await supabase
                .from('email_templates')
                .select('subject, html_body')
                .eq('template_key', 'prize_winner')
                .single()

            if (error || !template) {
                setMessage({ type: 'error', text: 'Email template not found. Please check email templates.' })
                return
            }

            // Replace variables in subject and body
            const prizeDisplay = slotsPrize.prize_type === 'cash'
                ? `$${slotsPrize.total_prize_pool} Cash Prize`
                : (slotsPrize.prize_descriptions?.[0] || 'Special Prize')

            let subject = template.subject
                .replace(/\{\{username\}\}/g, verificationData.user.username)
                .replace(/\{\{prize\}\}/g, prizeDisplay)
                .replace(/\{\{game_type\}\}/g, 'Slots Drawing')

            let body = template.html_body
                .replace(/\{\{username\}\}/g, verificationData.user.username)
                .replace(/\{\{prize\}\}/g, prizeDisplay)
                .replace(/\{\{game_type\}\}/g, 'Slots Drawing')

            setEmailSubject(subject)
            setEmailBody(body)
            setShowEmailModal(true)
        } catch (error) {
            console.error('Error loading email template:', error)
            setMessage({ type: 'error', text: 'Failed to load email template' })
        }
    }

    const sendWinnerEmail = async () => {
        if (!verificationData?.user?.email) {
            setMessage({ type: 'error', text: 'No email address found for winner' })
            return
        }

        setSendingEmail(true)
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: verificationData.user.email,
                    subject: emailSubject,
                    html: emailBody
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send email')
            }

            // Update email_sent_at
            await supabase
                .from('prize_payouts')
                .update({
                    email_sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', payoutStatus.id)

            // Audit log: Email sent
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'winner_email_sent',
                table_name: 'prize_payouts',
                record_id: payoutStatus.id,
                new_value: { email_to: verificationData.user.email, subject: emailSubject },
                description: `Sent winner notification email to ${verificationData.user.email}`
            }])

            setPayoutStatus(prev => ({ ...prev, email_sent_at: new Date().toISOString() }))
            setShowEmailModal(false)
            setMessage({ type: 'success', text: '📧 Email sent successfully!' })
        } catch (error) {
            console.error('Error sending email:', error)
            setMessage({ type: 'error', text: `Failed to send email: ${error.message}` })
        } finally {
            setSendingEmail(false)
        }
    }

    const openNotifiedModal = () => {
        setNotificationNote('')
        setShowNotifiedModal(true)
    }

    const markAsNotified = async () => {
        setSavingNotified(true)
        try {
            await supabase
                .from('prize_payouts')
                .update({
                    email_sent_at: new Date().toISOString(),
                    notification_note: notificationNote || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', payoutStatus.id)

            // Audit log: Marked as notified
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'winner_marked_notified',
                table_name: 'prize_payouts',
                record_id: payoutStatus.id,
                new_value: { notification_note: notificationNote || 'No note', username: verificationData.user.username },
                description: `Marked ${verificationData.user.username} as notified${notificationNote ? ` (${notificationNote})` : ''}`
            }])

            setPayoutStatus(prev => ({
                ...prev,
                email_sent_at: new Date().toISOString(),
                notification_note: notificationNote
            }))
            setShowNotifiedModal(false)
            setMessage({ type: 'success', text: '✅ Marked as notified' })
        } catch (error) {
            console.error('Error marking as notified:', error)
            setMessage({ type: 'error', text: 'Failed to mark as notified' })
        } finally {
            setSavingNotified(false)
        }
    }

    // ===== MATCH GAME FUNCTIONS (continued) =====
    const togglePaymentStatus = async (entry, rank) => {
        setSaving(entry.id)
        const weekStartStr = getWeekStart(weekOffset).toISOString().split('T')[0]
        const prizeAmount = getPrizeAmount(rank)

        try {
            const existingPayment = payments[entry.id]

            if (existingPayment) {
                const newStatus = existingPayment.status === 'paid' ? 'pending' : 'paid'
                await supabase
                    .from('prize_payments')
                    .update({
                        status: newStatus,
                        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingPayment.id)

                setPayments(prev => ({
                    ...prev,
                    [entry.id]: { ...existingPayment, status: newStatus }
                }))
            } else {
                const { data } = await supabase
                    .from('prize_payments')
                    .insert([{
                        leaderboard_id: entry.id,
                        user_id: entry.user_id,
                        week_start: weekStartStr,
                        rank: rank,
                        prize_amount: prizeAmount,
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    }])
                    .select()
                    .single()

                setPayments(prev => ({
                    ...prev,
                    [entry.id]: data
                }))
            }
        } catch (error) {
            console.error('Error updating payment:', error)
        } finally {
            setSaving(null)
        }
    }

    const getPrizeAmount = (rank) => {
        const prizes = { 1: 100, 2: 75, 3: 50, 4: 25, 5: 25 }
        return prizes[rank] || 0
    }

    const getRankBadge = (rank) => {
        if (rank === 1) return { emoji: '🥇', color: `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` }
        if (rank === 2) return { emoji: '🥈', color: 'bg-slate-400 text-slate-900' }
        if (rank === 3) return { emoji: '🥉', color: 'bg-amber-700 text-white' }
        return { emoji: rank.toString(), color: `bg-${currentTheme.border} text-${currentTheme.textMuted}` }
    }

    const getTotalEntries = () => slotsEntries.reduce((sum, e) => sum + e.entries, 0)

    const getPrizeDisplay = () => {
        if (!slotsPrize) return 'No prize set'
        if (slotsPrize.is_surprise) return '🎁 Surprise!'
        if (slotsPrize.prize_type === 'cash') return `$${slotsPrize.total_prize_pool}`
        return slotsPrize.prize_descriptions?.[0] || 'Special Prize'
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
            case 'verified': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
            case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/50'
            default: return `bg-${currentTheme.border} text-${currentTheme.textMuted}`
        }
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    // ===== RENDER =====
    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Weekly Winners</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage prize payments and drawing winners</p>
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => setActiveTab('slots')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'slots'
                        ? 'bg-purple-500 text-white'
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    🎰 Slots Drawing
                </button>
                <button
                    onClick={() => setActiveTab('match')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'match'
                        ? 'bg-green-500 text-white'
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    🎮 Match Game
                </button>
            </div>

            {/* ===== WEEK NAVIGATION ===== */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded hover:bg-${currentTheme.card}`}
                    >
                        ← Prev
                    </button>
                    <div className="text-center">
                        <p className={`text-${currentTheme.text} font-semibold text-sm`}>{currentWeek}</p>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>
                            {weekOffset === 0 ? 'Current Week' : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}
                        </p>
                    </div>
                    <button
                        onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                        disabled={weekOffset === 0}
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded disabled:opacity-50`}
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* ===== MESSAGE ===== */}
            {message && (
                <div className={`mb-3 p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* ===== EMAIL PREVIEW MODAL ===== */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
                        <div className={`p-2 border-b border-${currentTheme.border} flex items-center justify-between`}>
                            <h3 className={`text-${currentTheme.text} font-bold text-sm`}>📧 Email Preview</h3>
                            <button
                                onClick={() => setShowEmailModal(false)}
                                className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-3 overflow-y-auto flex-1">
                            <div className="flex gap-4 mb-2">
                                <div className="flex-1">
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>To:</label>
                                    <p className={`text-${currentTheme.text} text-sm`}>{verificationData?.user?.email}</p>
                                </div>
                                <div className="flex-1">
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Subject:</label>
                                    <input
                                        type="text"
                                        value={emailSubject}
                                        onChange={(e) => setEmailSubject(e.target.value)}
                                        className={`w-full p-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                    />
                                </div>
                            </div>
                            <div className="mb-2">
                                <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Preview:</label>
                                <div
                                    className="p-3 rounded border text-sm"
                                    style={{ backgroundColor: '#f1f5f9' }}
                                    dangerouslySetInnerHTML={{ __html: emailBody }}
                                />
                            </div>
                            <details className="mb-2">
                                <summary className={`text-${currentTheme.textMuted} text-xs cursor-pointer hover:text-${currentTheme.text}`}>Edit HTML (advanced)</summary>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    className={`w-full p-2 mt-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-xs font-mono`}
                                    rows={5}
                                />
                            </details>
                        </div>
                        <div className={`p-2 border-t border-${currentTheme.border} flex gap-2 justify-end`}>
                            <button
                                onClick={() => setShowEmailModal(false)}
                                className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={sendWinnerEmail}
                                disabled={sendingEmail}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                            >
                                {sendingEmail ? 'Sending...' : '📧 Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MARK AS NOTIFIED MODAL ===== */}
            {showNotifiedModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg w-full max-w-md`}>
                        <div className={`p-4 border-b border-${currentTheme.border}`}>
                            <h3 className={`text-${currentTheme.text} font-bold`}>Mark as Notified</h3>
                            <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>Record that winner was notified through other means</p>
                        </div>
                        <div className="p-4">
                            <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Note (optional):</label>
                            <textarea
                                value={notificationNote}
                                onChange={(e) => setNotificationNote(e.target.value)}
                                placeholder="e.g., Called them, DM'd on social media, etc."
                                className={`w-full p-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                rows={3}
                            />
                        </div>
                        <div className={`p-4 border-t border-${currentTheme.border} flex gap-2 justify-end`}>
                            <button
                                onClick={() => setShowNotifiedModal(false)}
                                className={`px-4 py-2 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={markAsNotified}
                                disabled={savingNotified}
                                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                            >
                                {savingNotified ? 'Saving...' : '✅ Mark as Notified'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SLOTS DRAWING TAB ===== */}
            {activeTab === 'slots' && (
                <>
                    {slotsLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className={`h-32 bg-${currentTheme.card} rounded`}></div>
                        </div>
                    ) : (
                        <>
                            {/* Prize Info */}
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>This Week's Prize</p>
                                        <p className={`text-${currentTheme.text} font-bold text-lg`}>{getPrizeDisplay()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Entries</p>
                                        <p className="text-purple-400 font-bold text-lg">🎟️ {getTotalEntries()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Participants</p>
                                        <p className={`text-${currentTheme.text} font-bold text-lg`}>{slotsEntries.length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ===== STEP 1: PICK WINNER ===== */}
                            {verificationStep === 'pick' && slotsEntries.length > 0 && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-2`}>🎲 Step 1: Select Winner</h3>
                                    <button
                                        onClick={pickRandomWinner}
                                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-bold text-sm hover:from-purple-400 hover:to-purple-500"
                                    >
                                        🎲 Pick Random Winner
                                    </button>
                                </div>
                            )}

                            {/* ===== STEP 2: VERIFICATION ===== */}
                            {verificationStep === 'verify' && selectedWinner && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-3`}>🔍 Step 2: Verify Winner</h3>

                                    {/* Selected Winner Header */}
                                    <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg mb-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-yellow-400 text-xs mb-1">Selected Winner:</p>
                                                <p className={`text-${currentTheme.text} font-bold text-lg`}>{selectedWinner.user.username}</p>
                                                <p className={`text-${currentTheme.textMuted} text-xs`}>{selectedWinner.user.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-purple-400 font-bold text-lg">🎟️ {selectedWinner.entries}</p>
                                                <p className={`text-${currentTheme.textMuted} text-xs`}>entries</p>
                                            </div>
                                        </div>
                                    </div>

                                    {verificationLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className={`ml-2 text-${currentTheme.textMuted} text-sm`}>Loading verification data...</span>
                                        </div>
                                    ) : verificationData && (
                                        <>
                                            {/* Fraud Flags */}
                                            {verificationData.fraudFlags.length > 0 && (
                                                <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
                                                    <p className="text-red-400 font-bold text-xs mb-1">⚠️ Flags Detected:</p>
                                                    {verificationData.fraudFlags.map((flag, i) => (
                                                        <p key={i} className={`text-xs ${flag.severity === 'warning' ? 'text-yellow-400' : 'text-orange-400'}`}>
                                                            • {flag.message}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}

                                            {/* No Flags */}
                                            {verificationData.fraudFlags.length === 0 && (
                                                <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                                                    <p className="text-green-400 font-bold text-xs">✅ No fraud flags detected</p>
                                                </div>
                                            )}

                                            {/* Account Info Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Account Age</p>
                                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>{verificationData.accountAge} days</p>
                                                </div>
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Total Spins</p>
                                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>{verificationData.totalSpins}</p>
                                                </div>
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Current Balance</p>
                                                    <p className="text-yellow-400 font-bold text-sm">🪙 {verificationData.balance}</p>
                                                </div>
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Lifetime Earned</p>
                                                    <p className="text-green-400 font-bold text-sm">🪙 {verificationData.lifetimeEarned}</p>
                                                </div>
                                            </div>

                                            {/* IP History */}
                                            <div className={`p-2 bg-${currentTheme.border}/30 rounded mb-3`}>
                                                <p className={`text-${currentTheme.textMuted} text-[10px] mb-1`}>Login Locations ({verificationData.uniqueLocations.length} unique)</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {verificationData.uniqueLocations.slice(0, 5).map((loc, i) => (
                                                        <span key={i} className={`px-2 py-0.5 bg-${currentTheme.card} rounded text-${currentTheme.text} text-xs`}>
                                                            📍 {loc}
                                                        </span>
                                                    ))}
                                                    {verificationData.uniqueLocations.length > 5 && (
                                                        <span className={`text-${currentTheme.textMuted} text-xs`}>+{verificationData.uniqueLocations.length - 5} more</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={clearSelection}
                                                    className={`flex-1 py-2 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={pickRandomWinner}
                                                    className="flex-1 py-2 bg-purple-600 text-white rounded text-sm"
                                                >
                                                    🎲 Re-Pick
                                                </button>
                                                <button
                                                    onClick={confirmWinner}
                                                    disabled={announcing}
                                                    className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-bold"
                                                >
                                                    {announcing ? 'Confirming...' : '✅ Confirm Winner'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ===== STEP 3: CONFIRMED - PAYOUT TRACKING ===== */}
                            {verificationStep === 'confirmed' && slotsPrize?.winner_user_id && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-3`}>✅ Winner Confirmed - Payout Tracking</h3>

                                    {/* Winner Info */}
                                    {verificationData && (
                                        <div className="p-2 bg-green-500/20 border border-green-500/50 rounded-lg mb-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-${currentTheme.text} text-sm`}>
                                                        <span className="text-green-400">🏆 Winner:</span>{' '}
                                                        <span className="font-bold">{verificationData.user?.username}</span>
                                                        <span className={`text-${currentTheme.textMuted}`}> — {verificationData.user?.email}</span>
                                                    </p>
                                                    {verificationData.user?.payout_method && (
                                                        <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>
                                                            💳 {verificationData.user.payout_method}: {verificationData.user.payout_handle}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-${currentTheme.textMuted} text-xs`}>Confirmed {formatDate(slotsPrize.winner_selected_at)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payout Status */}
                                    {payoutStatus && (
                                        <>
                                            <div className="mb-3">
                                                <p className={`text-${currentTheme.textMuted} text-xs mb-2`}>Payout Status:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {['pending', 'verified', 'paid'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => updatePayoutStatus(status)}
                                                            disabled={savingPayout || payoutStatus.status === 'paid'}
                                                            className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${payoutStatus.status === status
                                                                ? getStatusColor(status)
                                                                : `bg-${currentTheme.border}/30 text-${currentTheme.textMuted} border-${currentTheme.border} hover:bg-${currentTheme.border}`
                                                                } ${payoutStatus.status === 'paid' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            {status === 'pending' && '⏳'}
                                                            {status === 'verified' && '✓'}
                                                            {status === 'paid' && '💰'}
                                                            {' '}{status.charAt(0).toUpperCase() + status.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                                {payoutStatus.status === 'verified' && (
                                                    <p className="text-purple-400 text-xs mt-2">
                                                        ✓ Added to Payout Queue and Winners Board
                                                    </p>
                                                )}
                                                {payoutStatus.status === 'paid' && (
                                                    <p className="text-green-400 text-xs mt-2">
                                                        ✓ Payment completed
                                                    </p>
                                                )}
                                            </div>

                                            {/* Winner Notification Section */}
                                            {payoutStatus.status === 'verified' && (
                                                <div className={`mb-3 p-2 rounded-lg ${payoutStatus.email_sent_at
                                                    ? 'bg-green-500/20 border border-green-500/50'
                                                    : 'bg-orange-500/20 border border-orange-500/50'
                                                    }`}>
                                                    {payoutStatus.email_sent_at ? (
                                                        <div>
                                                            <p className="text-green-400 font-bold text-xs">
                                                                ✅ Winner Notified — {formatDateTime(payoutStatus.email_sent_at)}
                                                                {payoutStatus.notification_note && (
                                                                    <span className={`font-normal text-${currentTheme.textMuted}`}> ({payoutStatus.notification_note})</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-orange-400 font-bold text-xs">🔔 Winner Not Yet Notified</p>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={openEmailPreview}
                                                                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-500"
                                                                >
                                                                    📧 Preview & Send Email
                                                                </button>
                                                                <button
                                                                    onClick={openNotifiedModal}
                                                                    className={`px-3 py-1 bg-${currentTheme.border} text-${currentTheme.text} rounded text-xs hover:bg-${currentTheme.card}`}
                                                                >
                                                                    ✅ Mark as Notified
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Notes - Collapsible */}
                                            <details className="mb-2">
                                                <summary className={`text-${currentTheme.textMuted} text-xs cursor-pointer hover:text-${currentTheme.text}`}>
                                                    Admin Notes {payoutNotes ? '(has notes)' : ''}
                                                </summary>
                                                <div className="mt-2">
                                                    <textarea
                                                        value={payoutNotes}
                                                        onChange={(e) => setPayoutNotes(e.target.value)}
                                                        placeholder="Add notes about this payout (shipping info, verification details, etc.)"
                                                        className={`w-full p-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                                        rows={2}
                                                        disabled={payoutStatus.status === 'paid'}
                                                    />
                                                    {payoutStatus.status !== 'paid' && (
                                                        <button
                                                            onClick={savePayoutNotes}
                                                            disabled={savingPayout}
                                                            className={`mt-1 px-3 py-1 bg-${currentTheme.border} text-${currentTheme.text} rounded text-xs hover:bg-${currentTheme.card}`}
                                                        >
                                                            {savingPayout ? 'Saving...' : 'Save Notes'}
                                                        </button>
                                                    )}
                                                </div>
                                            </details>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Entries List */}
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                                <div className={`p-2 border-b border-${currentTheme.border} bg-${currentTheme.border}/30`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm`}>All Entries</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {slotsEntries.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className={`border-b border-${currentTheme.border}`}>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>#</th>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                                    <th className={`text-right py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Entries</th>
                                                    <th className={`text-right py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Chance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {slotsEntries.map((entry, index) => {
                                                    const chance = ((entry.entries / getTotalEntries()) * 100).toFixed(1)
                                                    const isWinner = slotsPrize?.winner_user_id === entry.user_id
                                                    const isSelected = selectedWinner?.user_id === entry.user_id
                                                    return (
                                                        <tr
                                                            key={entry.user_id}
                                                            className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 ${isWinner ? 'bg-green-500/20' : isSelected ? 'bg-yellow-500/20' : ''
                                                                }`}
                                                        >
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{index + 1}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.text} font-medium text-xs`}>
                                                                {entry.user.username}
                                                                {isWinner && <span className="ml-2 text-green-400">🏆</span>}
                                                                {isSelected && !isWinner && <span className="ml-2 text-yellow-400">⭐</span>}
                                                            </td>
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                                            <td className="py-2 px-3 text-right">
                                                                <span className="text-purple-400 font-bold">🎟️ {entry.entries}</span>
                                                            </td>
                                                            <td className={`py-2 px-3 text-right text-${currentTheme.textMuted} text-xs`}>{chance}%</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                            <p className="text-sm">No entries yet this week</p>
                                            <p className="text-xs mt-1">Entries will appear when players spin the slots</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ===== MATCH GAME TAB ===== */}
            {activeTab === 'match' && (
                <>
                    {loading ? (
                        <div className="animate-pulse space-y-3">
                            <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                        </div>
                    ) : (
                        <>
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className={`border-b border-${currentTheme.border}`}>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Rank</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Score</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Prize</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Status</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.length > 0 ? (
                                                leaderboard.map((entry, index) => {
                                                    const rank = index + 1
                                                    const badge = getRankBadge(rank)
                                                    const payment = payments[entry.id]
                                                    const isPaid = payment?.status === 'paid'
                                                    const prizeAmount = getPrizeAmount(rank)

                                                    return (
                                                        <tr key={entry.id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30`}>
                                                            <td className="py-2 px-3">
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${badge.color}`}>
                                                                    {rank <= 3 ? badge.emoji : rank}
                                                                </div>
                                                            </td>
                                                            <td className={`py-2 px-3 text-${currentTheme.text} font-medium text-xs`}>{entry.user.username}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.accent} font-bold text-sm`}>{entry.score}</td>
                                                            <td className="py-2 px-3">
                                                                {prizeAmount > 0 ? (
                                                                    <span className="text-green-400 font-semibold text-xs">${prizeAmount}</span>
                                                                ) : (
                                                                    <span className={`text-${currentTheme.textMuted} text-xs`}>—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {prizeAmount > 0 ? (
                                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isPaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                                                        }`}>
                                                                        {isPaid ? '✓ Paid' : 'Pending'}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {prizeAmount > 0 && (
                                                                    <button
                                                                        onClick={() => togglePaymentStatus(entry, rank)}
                                                                        disabled={saving === entry.id}
                                                                        className={`px-2 py-1 rounded text-xs font-medium ${isPaid ? `bg-${currentTheme.border} text-${currentTheme.textMuted}` : 'bg-green-600 text-white'
                                                                            }`}
                                                                    >
                                                                        {saving === entry.id ? '...' : isPaid ? 'Undo' : 'Mark Paid'}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                                        <p className="text-sm">No games played this week</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}