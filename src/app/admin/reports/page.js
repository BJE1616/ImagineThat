'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRole } from '../layout';

export default function AdminReportsPage() {
    const { role } = useAdminRole();

    const [adminUsers, setAdminUsers] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [financialPermissions, setFinancialPermissions] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [sendingTest, setSendingTest] = useState({});
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userData } = await supabase
                .from('users')
                .select('id, first_name, last_name, email')
                .eq('id', user.id)
                .single();
            setCurrentUser({
                ...userData,
                name: [userData.first_name, userData.last_name].filter(Boolean).join(' ') || userData.email
            });
        }

        const { data: admins } = await supabase
            .from('users')
            .select('id, first_name, last_name, email, role')
            .in('role', ['super_admin', 'admin', 'manager', 'support'])
            .order('role');

        setAdminUsers(admins || []);

        const { data: subs } = await supabase
            .from('admin_report_subscriptions')
            .select('*');

        setSubscriptions(subs || []);

        const { data: perms } = await supabase
            .from('admin_financial_permissions')
            .select('*');

        const permMap = {};
        (perms || []).forEach(p => {
            permMap[p.role] = p.can_view_revenue || p.can_view_expenses || p.can_view_profit || p.can_view_splits;
        });
        permMap['super_admin'] = true;
        setFinancialPermissions(permMap);

        setLoading(false);
    }

    function getSubscription(userId, reportType) {
        return subscriptions.find(s => s.user_id === userId && s.report_type === reportType);
    }

    function hasFinancialAccess(userRole) {
        return financialPermissions[userRole] || false;
    }

    function getUserDisplayName(user) {
        return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
    }

    async function updateSubscription(user, reportType, field, value) {
        const key = `${user.id}-${reportType}-${field}`;
        setSaving(prev => ({ ...prev, [key]: true }));

        const existing = getSubscription(user.id, reportType);

        try {
            if (existing) {
                const { error } = await supabase
                    .from('admin_report_subscriptions')
                    .update({ [field]: value })
                    .eq('id', existing.id);

                if (error) throw error;

                setSubscriptions(prev => prev.map(s =>
                    s.id === existing.id ? { ...s, [field]: value } : s
                ));
            } else {
                const newSub = {
                    user_id: user.id,
                    user_name: getUserDisplayName(user),
                    user_email: user.email,
                    report_type: reportType,
                    frequency: field === 'frequency' ? value : 'daily',
                    enabled: field === 'enabled' ? value : false,
                    created_by: currentUser?.id,
                    created_by_name: currentUser?.name || currentUser?.email
                };

                const { data, error } = await supabase
                    .from('admin_report_subscriptions')
                    .insert(newSub)
                    .select()
                    .single();

                if (error) throw error;

                setSubscriptions(prev => [...prev, data]);
            }

            setMessage({ type: 'success', text: 'Saved!' });
            setTimeout(() => setMessage(null), 2000);

        } catch (error) {
            console.error('Error saving:', error);
            setMessage({ type: 'error', text: 'Failed to save' });
        }

        setSaving(prev => ({ ...prev, [key]: false }));
    }

    async function sendTestReport(user, reportType) {
        const key = `${user.id}-${reportType}`;
        setSendingTest(prev => ({ ...prev, [key]: true }));

        try {
            const response = await fetch('/api/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    user_email: user.email,
                    user_name: getUserDisplayName(user),
                    report_type: reportType,
                    is_test: true
                })
            });

            const result = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: `Test ${reportType} report sent to ${user.email}` });
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to send test' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to send test report' });
        }

        setSendingTest(prev => ({ ...prev, [key]: false }));
        setTimeout(() => setMessage(null), 4000);
    }

    function getRoleBadgeColor(role) {
        switch (role) {
            case 'super_admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'manager': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'support': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    if (role !== 'super_admin' && role !== 'admin') {
        return (
            <div className="p-4">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm">
                    You don't have permission to access this page.
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse text-sm">Loading report settings...</div>
            </div>
        );
    }

    // Reusable report row component
    const ReportControl = ({ user, reportType, icon, color, disabled = false }) => (
        <div className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-50' : ''}`}>
            <span className={`text-${color}-600 dark:text-${color}-400 text-sm`}>{icon} {reportType}</span>
            <div className="flex items-center gap-2">
                <select
                    value={getSubscription(user.id, reportType.toLowerCase())?.frequency || 'daily'}
                    onChange={(e) => updateSubscription(user, reportType.toLowerCase(), 'frequency', e.target.value)}
                    disabled={disabled || saving[`${user.id}-${reportType.toLowerCase()}-frequency`]}
                    className="w-24 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs py-1"
                >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
                <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        checked={getSubscription(user.id, reportType.toLowerCase())?.enabled || false}
                        onChange={(e) => updateSubscription(user, reportType.toLowerCase(), 'enabled', e.target.checked)}
                        disabled={disabled || saving[`${user.id}-${reportType.toLowerCase()}-enabled`]}
                        className="sr-only peer"
                    />
                    <div className={`w-8 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-${color}-600`}></div>
                </label>
                <button
                    onClick={() => sendTestReport(user, reportType.toLowerCase())}
                    disabled={disabled || sendingTest[`${user.id}-${reportType.toLowerCase()}`]}
                    className={`text-xs text-${color}-600 dark:text-${color}-400 hover:underline disabled:opacity-50 w-8`}
                >
                    {sendingTest[`${user.id}-${reportType.toLowerCase()}`] ? '...' : 'Test'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="p-4 max-w-5xl">
            <div className="mb-4">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Report Subscriptions</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Configure automated email reports. Reports send at 6 AM Central.
                </p>
            </div>

            {message && (
                <div className={`mb-3 p-2 rounded text-sm ${message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Team Member
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                📊 Economy
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                💰 Financial
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {adminUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                                                {getUserDisplayName(user)}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {user.email}
                                            </div>
                                        </div>
                                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${getRoleBadgeColor(user.role)}`}>
                                            {user.role.replace('_', ' ')}
                                        </span>
                                    </div>
                                </td>

                                {/* Economy Column */}
                                <td className="px-3 py-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <select
                                            value={getSubscription(user.id, 'economy')?.frequency || 'daily'}
                                            onChange={(e) => updateSubscription(user, 'economy', 'frequency', e.target.value)}
                                            disabled={saving[`${user.id}-economy-frequency`]}
                                            className="w-24 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs py-1"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={getSubscription(user.id, 'economy')?.enabled || false}
                                                onChange={(e) => updateSubscription(user, 'economy', 'enabled', e.target.checked)}
                                                disabled={saving[`${user.id}-economy-enabled`]}
                                                className="sr-only peer"
                                            />
                                            <div className="w-8 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                        <button
                                            onClick={() => sendTestReport(user, 'economy')}
                                            disabled={sendingTest[`${user.id}-economy`]}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                                        >
                                            {sendingTest[`${user.id}-economy`] ? '...' : 'Test'}
                                        </button>
                                    </div>
                                </td>

                                {/* Financial Column */}
                                <td className="px-3 py-2">
                                    {hasFinancialAccess(user.role) ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <select
                                                value={getSubscription(user.id, 'financial')?.frequency || 'daily'}
                                                onChange={(e) => updateSubscription(user, 'financial', 'frequency', e.target.value)}
                                                disabled={saving[`${user.id}-financial-frequency`]}
                                                className="w-24 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs py-1"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={getSubscription(user.id, 'financial')?.enabled || false}
                                                    onChange={(e) => updateSubscription(user, 'financial', 'enabled', e.target.checked)}
                                                    disabled={saving[`${user.id}-financial-enabled`]}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-8 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                                            </label>
                                            <button
                                                onClick={() => sendTestReport(user, 'financial')}
                                                disabled={sendingTest[`${user.id}-financial`]}
                                                className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                                            >
                                                {sendingTest[`${user.id}-financial`] ? '...' : 'Test'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center text-xs text-gray-400">No access</div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {adminUsers.map((user) => (
                    <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
                        {/* User Header */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white text-sm">
                                    {getUserDisplayName(user)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {user.email}
                                </div>
                            </div>
                            <span className={`px-1.5 py-0.5 text-[10px] rounded ${getRoleBadgeColor(user.role)}`}>
                                {user.role.replace('_', ' ')}
                            </span>
                        </div>

                        {/* Economy Report */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-indigo-600 dark:text-indigo-400 text-sm">📊 Economy</span>
                            <div className="flex items-center gap-2">
                                <select
                                    value={getSubscription(user.id, 'economy')?.frequency || 'daily'}
                                    onChange={(e) => updateSubscription(user, 'economy', 'frequency', e.target.value)}
                                    disabled={saving[`${user.id}-economy-frequency`]}
                                    className="w-20 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs py-1"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={getSubscription(user.id, 'economy')?.enabled || false}
                                        onChange={(e) => updateSubscription(user, 'economy', 'enabled', e.target.checked)}
                                        disabled={saving[`${user.id}-economy-enabled`]}
                                        className="sr-only peer"
                                    />
                                    <div className="w-8 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <button
                                    onClick={() => sendTestReport(user, 'economy')}
                                    disabled={sendingTest[`${user.id}-economy`]}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                                >
                                    {sendingTest[`${user.id}-economy`] ? '...' : 'Test'}
                                </button>
                            </div>
                        </div>

                        {/* Financial Report */}
                        <div className={`flex items-center justify-between gap-2 ${!hasFinancialAccess(user.role) ? 'opacity-50' : ''}`}>
                            <span className="text-green-600 dark:text-green-400 text-sm">💰 Financial</span>
                            {hasFinancialAccess(user.role) ? (
                                <div className="flex items-center gap-2">
                                    <select
                                        value={getSubscription(user.id, 'financial')?.frequency || 'daily'}
                                        onChange={(e) => updateSubscription(user, 'financial', 'frequency', e.target.value)}
                                        disabled={saving[`${user.id}-financial-frequency`]}
                                        className="w-20 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs py-1"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={getSubscription(user.id, 'financial')?.enabled || false}
                                            onChange={(e) => updateSubscription(user, 'financial', 'enabled', e.target.checked)}
                                            disabled={saving[`${user.id}-financial-enabled`]}
                                            className="sr-only peer"
                                        />
                                        <div className="w-8 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                    <button
                                        onClick={() => sendTestReport(user, 'financial')}
                                        disabled={sendingTest[`${user.id}-financial`]}
                                        className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                                    >
                                        {sendingTest[`${user.id}-financial`] ? '...' : 'Test'}
                                    </button>
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400">No access</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <p className="text-blue-700 dark:text-blue-300">
                    <strong>Schedule:</strong> Daily = every day, Weekly = Mondays, Monthly = 1st of month.
                    Financial reports require permissions from Team Management.
                </p>
            </div>
        </div>
    );
}