'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

export default function AdminStatsPage() {
    const { currentTheme } = useTheme();
    const [stats, setStats] = useState({
        users: { total: 0, admins: 0, regular: 0, thisWeek: 0, thisMonth: 0 },
        campaigns: { total: 0, active: 0, queued: 0, pending: 0, completed: 0, cancelled: 0, thisWeek: 0, thisMonth: 0 },
        cards: { total: 0, regular: 0, house: 0, inUse: 0 },
        views: { total: 0, fromGame: 0, fromFlips: 0, fromCardBack: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState({
        users: false,
        campaigns: false,
        cards: false,
        views: false
    });

    useEffect(() => {
        fetchStats();
    }, []);

    function toggleSection(section) {
        setOpen(prev => ({ ...prev, [section]: !prev[section] }));
    }

    async function fetchStats() {
        setLoading(true);

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            { data: users },
            { data: campaigns },
            { data: cards },
            { data: cardsInUse }
        ] = await Promise.all([
            supabase.from('users').select('id, is_admin, created_at'),
            supabase.from('ad_campaigns').select('id, status, views_from_game, views_from_flips, views_from_card_back, created_at'),
            supabase.from('business_cards').select('id, is_house_card'),
            supabase.from('ad_campaigns').select('business_card_id').in('status', ['active', 'queued'])
        ]);

        const userStats = {
            total: users?.length || 0,
            admins: users?.filter(u => u.is_admin === true).length || 0,
            regular: users?.filter(u => u.is_admin !== true).length || 0,
            thisWeek: users?.filter(u => new Date(u.created_at) >= startOfWeek).length || 0,
            thisMonth: users?.filter(u => new Date(u.created_at) >= startOfMonth).length || 0
        };

        const campaignStats = {
            total: campaigns?.length || 0,
            active: campaigns?.filter(c => c.status === 'active').length || 0,
            queued: campaigns?.filter(c => c.status === 'queued').length || 0,
            pending: campaigns?.filter(c => c.status === 'pending_payment').length || 0,
            completed: campaigns?.filter(c => c.status === 'completed').length || 0,
            cancelled: campaigns?.filter(c => c.status === 'cancelled').length || 0,
            thisWeek: campaigns?.filter(c => new Date(c.created_at) >= startOfWeek).length || 0,
            thisMonth: campaigns?.filter(c => new Date(c.created_at) >= startOfMonth).length || 0
        };

        const uniqueCardsInUse = [...new Set(cardsInUse?.map(c => c.business_card_id) || [])];
        const cardStats = {
            total: cards?.length || 0,
            regular: cards?.filter(c => !c.is_house_card).length || 0,
            house: cards?.filter(c => c.is_house_card).length || 0,
            inUse: uniqueCardsInUse.length
        };

        const viewStats = {
            fromGame: campaigns?.reduce((sum, c) => sum + (c.views_from_game || 0), 0) || 0,
            fromFlips: campaigns?.reduce((sum, c) => sum + (c.views_from_flips || 0), 0) || 0,
            fromCardBack: campaigns?.reduce((sum, c) => sum + (c.views_from_card_back || 0), 0) || 0,
            total: 0
        };
        viewStats.total = viewStats.fromGame + viewStats.fromFlips + viewStats.fromCardBack;

        setStats({
            users: userStats,
            campaigns: campaignStats,
            cards: cardStats,
            views: viewStats
        });

        setLoading(false);
    }

    function StatRow({ label, value, even }) {
        return (
            <div className={`flex justify-between px-3 py-1.5 ${even ? `bg-${currentTheme.card}` : `bg-${currentTheme.border}/50`}`}>
                <span className={`text-${currentTheme.textMuted}`}>{label}</span>
                <span className={`text-${currentTheme.text} font-medium`}>{value}</span>
            </div>
        );
    }

    function Section({ title, sectionKey, summary, children }) {
        const isOpen = open[sectionKey];
        return (
            <div className="mb-2">
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className={`w-full flex items-center justify-between px-3 py-2 bg-${currentTheme.card} hover:bg-${currentTheme.border} rounded border border-${currentTheme.border} transition`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`text-${currentTheme.accent} text-xs`}>{isOpen ? '▼' : '▶'}</span>
                        <span className={`text-sm font-semibold text-${currentTheme.text}`}>{title}</span>
                    </div>
                    <span className={`text-xs text-${currentTheme.textMuted}`}>{summary}</span>
                </button>
                {isOpen && (
                    <div className={`mt-1 rounded overflow-hidden border border-${currentTheme.border}`}>
                        {children}
                    </div>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text} mb-3`}>Platform Stats</h1>
                <div className="flex items-center justify-center h-32">
                    <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${currentTheme.accent}`}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-md">
            <div className="flex items-center justify-between mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Platform Stats</h1>
                <button
                    onClick={fetchStats}
                    className={`text-xs bg-${currentTheme.border} hover:bg-${currentTheme.card} text-${currentTheme.textMuted} px-2 py-1 rounded transition`}
                >
                    Refresh
                </button>
            </div>

            <Section title="Users" sectionKey="users" summary={`${stats.users.total} total`}>
                <StatRow label="Total" value={stats.users.total} even={false} />
                <StatRow label="Admins" value={stats.users.admins} even={true} />
                <StatRow label="Regular" value={stats.users.regular} even={false} />
                <StatRow label="New This Week" value={stats.users.thisWeek} even={true} />
                <StatRow label="New This Month" value={stats.users.thisMonth} even={false} />
            </Section>

            <Section title="Campaigns" sectionKey="campaigns" summary={`${stats.campaigns.active} active`}>
                <StatRow label="Active" value={stats.campaigns.active} even={false} />
                <StatRow label="Queued" value={stats.campaigns.queued} even={true} />
                <StatRow label="Pending Payment" value={stats.campaigns.pending} even={false} />
                <StatRow label="Completed" value={stats.campaigns.completed} even={true} />
                <StatRow label="Cancelled" value={stats.campaigns.cancelled} even={false} />
                <StatRow label="Total" value={stats.campaigns.total} even={true} />
                <StatRow label="New This Week" value={stats.campaigns.thisWeek} even={false} />
                <StatRow label="New This Month" value={stats.campaigns.thisMonth} even={true} />
            </Section>

            <Section title="Business Cards" sectionKey="cards" summary={`${stats.cards.total} total`}>
                <StatRow label="Total" value={stats.cards.total} even={false} />
                <StatRow label="Regular" value={stats.cards.regular} even={true} />
                <StatRow label="House Cards" value={stats.cards.house} even={false} />
                <StatRow label="In Use" value={stats.cards.inUse} even={true} />
            </Section>

            <Section title="Ad Views" sectionKey="views" summary={`${stats.views.total.toLocaleString()} total`}>
                <StatRow label="Total" value={stats.views.total.toLocaleString()} even={false} />
                <StatRow label="From Game" value={stats.views.fromGame.toLocaleString()} even={true} />
                <StatRow label="From Flips" value={stats.views.fromFlips.toLocaleString()} even={false} />
                <StatRow label="From Card Back" value={stats.views.fromCardBack.toLocaleString()} even={true} />
            </Section>
        </div>
    );
}