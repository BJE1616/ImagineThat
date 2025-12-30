'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/ThemeContext';

export default function ProfilePage() {
    const router = useRouter();
    const { currentTheme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState({
        email: '',
        username: '',
        payout_method: '',
        payout_handle: '',
        mailing_address: '',
        mailing_city: '',
        mailing_state: '',
        mailing_zip: ''
    });
    const [passwords, setPasswords] = useState({
        new_password: '',
        confirm_password: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                router.push('/auth/login');
                return;
            }
            setUser(authUser);

            const { data, error } = await supabase
                .from('users')
                .select('email, username, payout_method, payout_handle, mailing_address, mailing_city, mailing_state, mailing_zip')
                .eq('id', authUser.id)
                .single();

            if (error) throw error;
            setProfile({
                email: data.email || '',
                username: data.username || '',
                payout_method: data.payout_method || '',
                payout_handle: data.payout_handle || '',
                mailing_address: data.mailing_address || '',
                mailing_city: data.mailing_city || '',
                mailing_state: data.mailing_state || '',
                mailing_zip: data.mailing_zip || ''
            });
        } catch (error) {
            console.error('Error loading profile:', error);
            setMessage({ type: 'error', text: 'Failed to load profile' });
        } finally {
            setLoading(false);
        }
    }

    async function saveProfile(e) {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    payout_method: profile.payout_method || null,
                    payout_handle: profile.payout_handle || null,
                    mailing_address: profile.mailing_address || null,
                    mailing_city: profile.mailing_city || null,
                    mailing_state: profile.mailing_state || null,
                    mailing_zip: profile.mailing_zip || null
                })
                .eq('id', user.id);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Profile saved!' });
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ type: 'error', text: 'Failed to save profile' });
        } finally {
            setSaving(false);
        }
    }

    async function changePassword(e) {
        e.preventDefault();
        if (passwords.new_password !== passwords.confirm_password) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }
        if (passwords.new_password.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.new_password
            });

            if (error) throw error;
            setPasswords({ new_password: '', confirm_password: '' });
            setMessage({ type: 'success', text: 'Password changed!' });
        } catch (error) {
            console.error('Error changing password:', error);
            setMessage({ type: 'error', text: 'Failed to change password' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} p-4 text-center`}>
                <p className={`text-${currentTheme.text}`}>Loading...</p>
            </div>
        );
    }

    const inputClass = `w-full px-2 py-1.5 rounded bg-${currentTheme.bg} border border-${currentTheme.border} text-${currentTheme.text} text-sm`;
    const labelClass = `block text-xs font-medium text-${currentTheme.textMuted} mb-0.5`;

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} py-4 px-4`}>
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                    <h1 className={`text-xl font-bold text-${currentTheme.text}`}>My Profile</h1>
                    {message.text && (
                        <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message.text}
                        </div>
                    )}
                </div>

                <form onSubmit={saveProfile}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                        {/* Left Column */}
                        <div className="space-y-3">
                            {/* Account Info */}
                            <section className={`p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                                <h2 className={`text-sm font-semibold text-${currentTheme.text} mb-2`}>Account Info</h2>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}>Email</label>
                                        <p className={`text-sm text-${currentTheme.text}`}>{profile.email}</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Referral Username <span className="text-purple-400">📣 Share this!</span></label>
                                        <div className={`inline-flex items-center px-2 py-1 rounded bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50`}>
                                            <span className="text-sm font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{profile.username}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Payout Preferences */}
                            <section className={`p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                                <h2 className={`text-sm font-semibold text-${currentTheme.text} mb-2`}>Payout Preferences</h2>
                                <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>
                                    💵 <strong>Venmo</strong> – PayPal-owned app, uses @username. <strong>CashApp</strong> – Square-owned app, uses $cashtag. Choose whichever you use!
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}>Method</label>
                                        <select
                                            value={profile.payout_method}
                                            onChange={(e) => setProfile({ ...profile, payout_method: e.target.value })}
                                            className={inputClass}
                                        >
                                            <option value="">Select...</option>
                                            <option value="venmo">Venmo</option>
                                            <option value="cashapp">CashApp</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            {profile.payout_method === 'cashapp' ? '$Cashtag' : '@Username'}
                                        </label>
                                        <input
                                            type="text"
                                            value={profile.payout_handle}
                                            onChange={(e) => setProfile({ ...profile, payout_handle: e.target.value })}
                                            placeholder={profile.payout_method === 'cashapp' ? '$tag' : '@user'}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-3">
                            {/* Mailing Address */}
                            <section className={`p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                                <h2 className={`text-sm font-semibold text-${currentTheme.text} mb-1`}>
                                    Mailing Address <span className={`font-normal text-${currentTheme.textMuted}`}>(Optional)</span>
                                </h2>
                                <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Only needed if you win a physical prize.</p>
                                <div className="space-y-2">
                                    <div>
                                        <label className={labelClass}>Street</label>
                                        <input
                                            type="text"
                                            value={profile.mailing_address}
                                            onChange={(e) => setProfile({ ...profile, mailing_address: e.target.value })}
                                            placeholder="123 Main St"
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-1">
                                            <label className={labelClass}>City</label>
                                            <input
                                                type="text"
                                                value={profile.mailing_city}
                                                onChange={(e) => setProfile({ ...profile, mailing_city: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>State</label>
                                            <input
                                                type="text"
                                                value={profile.mailing_state}
                                                onChange={(e) => setProfile({ ...profile, mailing_state: e.target.value })}
                                                maxLength={2}
                                                placeholder="TX"
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>ZIP</label>
                                            <input
                                                type="text"
                                                value={profile.mailing_zip}
                                                onChange={(e) => setProfile({ ...profile, mailing_zip: e.target.value })}
                                                maxLength={10}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Change Password */}
                            <section className={`p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className={`text-sm font-semibold text-${currentTheme.text}`}>Change Password</h2>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className={`text-xs text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}
                                    >
                                        {showPassword ? '🙈 Hide' : '👁️ Show'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}>New Password</label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={passwords.new_password}
                                            onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Confirm</label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={passwords.confirm_password}
                                            onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={changePassword}
                                    disabled={saving}
                                    className={`mt-2 px-3 py-1 rounded text-sm bg-${currentTheme.border} text-${currentTheme.text} hover:opacity-80 ${saving ? 'opacity-50' : ''}`}
                                >
                                    Update Password
                                </button>
                            </section>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className={`mt-3 w-full py-2 rounded-lg font-semibold transition-all ${saving ? 'opacity-50' : 'hover:opacity-90'} bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`}
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </form>
            </div>
        </div>
    );
}