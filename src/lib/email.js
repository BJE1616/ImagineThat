import { Resend } from 'resend'
import { supabase } from './supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

// Get email settings from database
const getEmailSettings = async () => {
    try {
        const { data, error } = await supabase
            .from('admin_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['email_test_mode', 'test_email_recipient'])

        if (error) throw error

        const settings = {}
        data.forEach(item => {
            settings[item.setting_key] = item.setting_value
        })

        return {
            testMode: settings.email_test_mode === 'true',
            testRecipient: settings.test_email_recipient || 'bje1616@gmail.com'
        }
    } catch (error) {
        console.error('Error fetching email settings:', error)
        // Default to test mode if we can't fetch settings
        return { testMode: true, testRecipient: 'bje1616@gmail.com' }
    }
}

export const sendEmail = async ({ to, subject, html }) => {
    const { testMode, testRecipient } = await getEmailSettings()

    // If test mode is ON, redirect all emails to test recipient
    if (testMode) {
        console.log('📧 TEST MODE - Redirecting email:')
        console.log('   Original To:', to)
        console.log('   Sending To:', testRecipient)
        console.log('   Subject:', subject)
        to = testRecipient
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'ImagineThat <noreply@imaginethat.icu>',
            to: to,
            subject: subject,
            html: html
        })

        if (error) {
            console.error('Email error:', error)
            return { success: false, error: error.message }
        }

        console.log('📧 Email sent to:', to)
        return { success: true, id: data?.id, testMode }
    } catch (error) {
        console.error('Email error:', error)
        return { success: false, error: error.message }
    }
}

// Email templates
export const emailTemplates = {
    welcome: (username) => ({
        subject: 'Welcome to ImagineThat! 🎮',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #f59e0b;">Welcome to ImagineThat!</h1>
                <p>Hey ${username},</p>
                <p>Thanks for joining! You can now:</p>
                <ul>
                    <li>🎮 Play games and compete for weekly prizes</li>
                    <li>📢 Advertise your business to our players</li>
                    <li>💰 Earn bonuses through our referral matrix</li>
                </ul>
                <p>Ready to get started?</p>
                <a href="https://imaginethat.icu/game" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Play Now</a>
                <p style="margin-top: 30px; color: #666;">See you in the game!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    campaignActivated: (username, views) => ({
        subject: 'Your Campaign is Live! 🚀',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #22c55e;">Your Campaign is Active!</h1>
                <p>Hey ${username},</p>
                <p>Great news! Your advertising campaign is now live.</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white;">
                    <p style="margin: 0;"><strong>Guaranteed Views:</strong> ${views.toLocaleString()}</p>
                </div>
                <p>Your business card is now being shown to players. Check your dashboard to track progress!</p>
                <a href="https://imaginethat.icu/dashboard" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>
                <p style="margin-top: 30px; color: #666;">Thanks for advertising with us!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    campaignCompleted: (username, views) => ({
        subject: 'Campaign Complete! ✅',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #22c55e;">Campaign Complete!</h1>
                <p>Hey ${username},</p>
                <p>Your advertising campaign has finished delivering all guaranteed views.</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white;">
                    <p style="margin: 0;"><strong>Total Views Delivered:</strong> ${views.toLocaleString()}</p>
                </div>
                <p>Ready to reach more customers? Start a new campaign today!</p>
                <a href="https://imaginethat.icu/advertise" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Start New Campaign</a>
                <p style="margin-top: 30px; color: #666;">Thanks for advertising with us!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    prizeWinner: (username, rank, prize) => ({
        subject: '🏆 You Won a Prize!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #f59e0b;">🏆 Congratulations!</h1>
                <p>Hey ${username},</p>
                <p>Amazing news! You placed <strong>#${rank}</strong> on this week's leaderboard!</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white; text-align: center;">
                    <p style="margin: 0; font-size: 24px;"><strong>${prize}</strong></p>
                </div>
                <p>We'll be in touch about claiming your prize.</p>
                <p style="margin-top: 30px; color: #666;">Keep playing!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    matrixComplete: (username, payout) => ({
        subject: '🎉 Matrix Complete - Payout Coming!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #22c55e;">🎉 Matrix Complete!</h1>
                <p>Hey ${username},</p>
                <p>Your referral matrix is complete! All 6 spots have been filled.</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white; text-align: center;">
                    <p style="margin: 0; font-size: 24px;"><strong>$${payout} Bonus!</strong></p>
                </div>
                <p>Your payout is being processed. Thanks for spreading the word!</p>
                <p style="margin-top: 30px; color: #666;">The ImagineThat Team</p>
            </div>
        `
    })
}