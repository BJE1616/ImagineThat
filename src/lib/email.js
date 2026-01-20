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
        return { testMode: true, testRecipient: 'bje1616@gmail.com' }
    }
}

// Get template from database
const getTemplate = async (templateKey) => {
    try {
        const { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .eq('template_key', templateKey)
            .eq('enabled', true)
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error(`Error fetching template ${templateKey}:`, error)
        return null
    }
}

// Replace variables in template
const replaceVariables = (text, variables) => {
    if (!text) return ''
    let result = text
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        result = result.replace(regex, variables[key] || '')
    })
    return result
}

export const sendEmail = async ({ to, subject, html }) => {
    const { testMode, testRecipient } = await getEmailSettings()

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

// Send email using database template
export const sendTemplateEmail = async (templateKey, to, variables = {}) => {
    const template = await getTemplate(templateKey)

    if (!template) {
        console.error(`Template ${templateKey} not found or disabled`)
        // Fallback to hardcoded templates
        const fallback = emailTemplates[templateKey]
        if (fallback) {
            const content = fallback(variables)
            return sendEmail({ to, subject: content.subject, html: content.html })
        }
        return { success: false, error: 'Template not found' }
    }

    const subject = replaceVariables(template.subject, variables)
    const html = replaceVariables(template.html_body, variables)

    return sendEmail({ to, subject, html })
}

// Fallback hardcoded templates (used if database fails)
export const emailTemplates = {
    welcome: (vars) => ({
        subject: 'Welcome to ImagineThat! 🎮',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #f59e0b;">Welcome to ImagineThat!</h1>
                <p>Hey ${vars.username || 'there'},</p>
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

    campaign_activated: (vars) => ({
        subject: 'Your Campaign is Live! 🚀',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #22c55e;">Your Campaign is Active!</h1>
                <p>Hey ${vars.username || 'there'},</p>
                <p>Great news! Your advertising campaign is now live.</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white;">
                    <p style="margin: 0;"><strong>Duration:</strong> ${vars.duration || '30 days'}</p>
                </div>
                <p>Your business card is now being shown to players. Check your dashboard to track progress!</p>
                <a href="https://imaginethat.icu/dashboard" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>
                <p style="margin-top: 30px; color: #666;">Thanks for advertising with us!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    campaign_completed: (vars) => ({
        subject: 'Campaign Complete! ✅',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #22c55e;">Campaign Complete!</h1>
                <p>Hey ${vars.username || 'there'},</p>
                <p>Your 30-day advertising campaign has finished!</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white;">
                    <p style="margin: 0;"><strong>Total Views Earned:</strong> ${vars.total_views || vars.views || '0'}</p>
                </div>
                <p>Ready to reach more customers? Start a new campaign today!</p>
                <a href="https://imaginethat.icu/advertise" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Start New Campaign</a>
                <p style="margin-top: 30px; color: #666;">Thanks for advertising with us!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    prize_winner: (vars) => ({
        subject: '🏆 You Won a Prize!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #f59e0b;">🏆 Congratulations!</h1>
                <p>Hey ${vars.username || 'there'},</p>
                <p>Amazing news! You placed <strong>#${vars.rank || '1'}</strong> on this week's leaderboard!</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white; text-align: center;">
                    <p style="margin: 0; font-size: 24px;"><strong>${vars.prize || 'Prize'}</strong></p>
                </div>
                <p>We'll be in touch about claiming your prize.</p>
                <p style="margin-top: 30px; color: #666;">Keep playing!<br>The ImagineThat Team</p>
            </div>
        `
    }),

    matrix_complete: (vars) => ({
        subject: '🎉 Matrix Complete - Payout Coming!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #22c55e;">🎉 Matrix Complete!</h1>
                <p>Hey ${vars.username || 'there'},</p>
                <p>Your referral matrix is complete! All 6 spots have been filled.</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; color: white; text-align: center;">
                    <p style="margin: 0; font-size: 24px;"><strong>$${vars.payout || '200'} Bonus!</strong></p>
                </div>
                <p>Your payout is being processed. Thanks for spreading the word!</p>
                <p style="margin-top: 30px; color: #666;">The ImagineThat Team</p>
            </div>
        `
    })
}