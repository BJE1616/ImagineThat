'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAdminRole } from '../layout';

export default function AdminReportsPage() {
    const supabase = createClientComponentClient();
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

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userData } = await supabase
                .from('users')
                .select('id, name, email')
                .eq('id', user.id)
                .single();
            setCurrentUser(userData);
        }

        // Get all admin users
        const { data: admins } = await supabase
            .from('users')
            .select('id, name, email, role')
            .in('role', ['super_admin', 'admin', 'manager', 'support'])
            .order('role');

        setAdminUsers(admins || []);

        // Get existing subscriptions
        const { data: subs } = await supabase
            .from('admin_report_subscriptions')
            .select('*');

        setSubscriptions(subs || []);

        // Get financial permissions for each role
        const { data: perms } = await supabase
            .from('admin_financial_permissions')
            .select('*');

        const permMap = {};
        (perms || []).forEach(p => {
            permMap[p.role] = p.can_view_revenue || p.can_view_expenses || p.can_view_profit || p.can_view_splits;
        });
        // Super admin always has financial access
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

    async function updateSubscription(user, reportType, field, value) {
        const key = `${user.id}-${reportType}-${field}`;
        setSaving(prev => ({ ...prev, [key]: true }));

        const existing = getSubscription(user.id, reportType);

        try {
            if (existing) {
                // Update existing
                const { error } = await supabase
                    .from('admin_report_subscriptions')
                    .update({ [field]: value })
                    .eq('id', existing.id);

                if (error) throw error;

                setSubscriptions(prev => prev.map(s =>
                    s.id === existing.id ? { ...s, [field]: value } : s
                ));
            } else {
                // Create new subscription
                const newSub = {
                    user_id: user.id,
                    user_name: user.name || user.email,
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
                    user_name: user.name || user.email,
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

    // Access control
    if (role !== 'super_admin' && role !== 'admin') {
        return (
            <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">
                    You don't have permission to access this page.
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">Loading report settings...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Subscriptions</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Configure automated email reports for admin team members. Reports send daily at 6 AM Central.
                </p>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Team Member
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Report Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Frequency
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Enabled
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {adminUsers.map((user, userIndex) => (
                            <>
                                {/* Economy Report Row */}
                                <tr key={`${user.id}-economy`} className={userIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {user.name || user.email}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {user.email}
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                                                {user.role.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                            📊 Economy
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={getSubscription(user.id, 'economy')?.frequency || 'daily'}
                                            onChange={(e) => updateSubscription(user, 'economy', 'frequency', e.target.value)}
                                            disabled={saving[`${user.id}-economy-frequency`]}
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly (Mondays)</option>
                                            <option value="monthly">Monthly (1st)</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={getSubscription(user.id, 'economy')?.enabled || false}
                                                onChange={(e) => updateSubscription(user, 'economy', 'enabled', e.target.checked)}
                                                disabled={saving[`${user.id}-economy-enabled`]}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => sendTestReport(user, 'economy')}
                                            disabled={sendingTest[`${user.id}-economy`]}
                                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
                                        >
                                            {sendingTest[`${user.id}-economy`] ? 'Sending...' : 'Send Test'}
                                        </button>
                                    </td>
                                </tr>

                                {/* Financial Report Row */}
                                <tr key={`${user.id}-financial`} className={userIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}>
                                    <td className="px-4 py-3">
                                        {/* Empty - name shown in row above */}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 ${hasFinancialAccess(user.role) ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                            💰 Financial
                                            {!hasFinancialAccess(user.role) && (
                                                <span className="text-xs text-gray-400">(no access)</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={getSubscription(user.id, 'financial')?.frequency || 'daily'}
                                            onChange={(e) => updateSubscription(user, 'financial', 'frequency', e.target.value)}
                                            disabled={!hasFinancialAccess(user.role) || saving[`${user.id}-financial-frequency`]}
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly (Mondays)</option>
                                            <option value="monthly">Monthly (1st)</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <label className={`relative inline-flex items-center ${hasFinancialAccess(user.role) ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                            <input
                                                type="checkbox"
                                                checked={getSubscription(user.id, 'financial')?.enabled || false}
                                                onChange={(e) => updateSubscription(user, 'financial', 'enabled', e.target.checked)}
                                                disabled={!hasFinancialAccess(user.role) || saving[`${user.id}-financial-enabled`]}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </label>
                                    </td>
                                    <td className="px-4 py-3">
                                        {hasFinancialAccess(user.role) ? (
                                            <button
                                                onClick={() => sendTestReport(user, 'financial')}
                                                disabled={sendingTest[`${user.id}-financial`]}
                                                className="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 disabled:opacity-50"
                                            >
                                                {sendingTest[`${user.id}-financial`] ? 'Sending...' : 'Send Test'}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            </>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">📧 Report Schedule</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li><strong>Daily:</strong> Sent every day at 6 AM Central</li>
                    <li><strong>Weekly:</strong> Sent every Monday at 6 AM Central</li>
                    <li><strong>Monthly:</strong> Sent on the 1st of each month at 6 AM Central</li>
                </ul>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                    Financial reports are only available for team members with financial permissions configured in Team Management.
                </p>
            </div>
        </div>
    );
}