import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { user_id, user_email, user_name, report_type, is_test } = await request.json();

    if (!user_id || !user_email || !report_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build the report content based on type
    let subject, htmlContent;

    if (report_type === 'economy') {
      const reportData = await buildEconomyReport();
      subject = is_test ? '[TEST] Economy Health Report' : 'Economy Health Report';
      htmlContent = reportData;
    } else if (report_type === 'financial') {
      // Verify user has financial permissions before sending
      const hasPermission = await checkFinancialPermission(user_id);
      if (!hasPermission) {
        return Response.json({ error: 'User does not have financial permissions' }, { status: 403 });
      }
      const reportData = await buildFinancialReport();
      subject = is_test ? '[TEST] Financial Report' : 'Financial Report';
      htmlContent = reportData;
    } else {
      return Response.json({ error: 'Invalid report type' }, { status: 400 });
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Reports <reports@imaginethat.icu>',
      to: user_email,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      return Response.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Update last_sent_at if not a test
    if (!is_test) {
      await supabase
        .from('admin_report_subscriptions')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .eq('report_type', report_type);
    }

    return Response.json({ success: true, message: `Report sent to ${user_email}` });

  } catch (error) {
    console.error('Send report error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Check if user has financial permissions
async function checkFinancialPermission(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!user) return false;

  // Super admin always has access
  if (user.role === 'super_admin') return true;

  // Check admin_financial_permissions table for other roles
  const { data: permissions } = await supabase
    .from('admin_financial_permissions')
    .select('*')
    .eq('role', user.role)
    .single();

  // If they have any financial permission enabled, they can receive the report
  if (permissions) {
    return permissions.can_view_revenue ||
      permissions.can_view_expenses ||
      permissions.can_view_profit ||
      permissions.can_view_splits;
  }

  return false;
}

// Build Economy Report HTML
async function buildEconomyReport() {
  // Get token stats
  const { data: balances } = await supabase
    .from('bb_balances')
    .select('balance, lifetime_earned, lifetime_spent');

  const totalCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;
  const totalEarned = balances?.reduce((sum, b) => sum + (b.lifetime_earned || 0), 0) || 0;
  const totalSpent = balances?.reduce((sum, b) => sum + (b.lifetime_spent || 0), 0) || 0;
  const burnRate = totalEarned > 0 ? ((totalSpent / totalEarned) * 100).toFixed(1) : 0;

  // Get active campaigns
  const { count: activeCampaigns } = await supabase
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Get pending payouts
  const { count: pendingPayouts } = await supabase
    .from('matrix_entries')
    .select('*', { count: 'exact', head: true })
    .eq('is_completed', true)
    .eq('payout_status', 'pending');

  // Get bb_dollar_value setting
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'bb_dollar_value')
    .single();

  const bbValue = settings?.value || 0.01;
  const circulationValue = (totalCirculation * bbValue).toFixed(2);

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .stat-box { background: #f3f4f6; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .stat-value { font-size: 24px; font-weight: bold; color: #111; }
        .alert { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px 15px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Economy Health Report</h1>
        <p>${reportDate}</p>
      </div>
      <div class="content">
        <div class="stat-box">
          <div class="stat-label">Total Circulation</div>
          <div class="stat-value">${totalCirculation.toLocaleString()} tokens</div>
          <div style="color: #666;">Worth $${circulationValue}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Burn Rate</div>
          <div class="stat-value">${burnRate}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Active Campaigns</div>
          <div class="stat-value">${activeCampaigns || 0}</div>
        </div>
        ${pendingPayouts > 0 ? `
        <div class="alert">
          <strong>⚠️ ${pendingPayouts} pending matrix payout(s)</strong> require attention.
        </div>
        ` : ''}
      </div>
      <div class="footer">
        <p>This is an automated report from your admin dashboard.</p>
      </div>
    </body>
    </html>
  `;
}

// Build Financial Report HTML
async function buildFinancialReport() {
  // Get completed/cancelled campaigns (earned revenue)
  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('amount_paid, status')
    .in('status', ['completed', 'cancelled']);

  const totalRevenue = campaigns?.reduce((sum, c) => sum + (c.amount_paid || 0), 0) || 0;

  // Get paid matrix payouts
  const { data: paidPayouts } = await supabase
    .from('matrix_entries')
    .select('payout_amount')
    .eq('payout_status', 'paid');

  const totalPayouts = paidPayouts?.reduce((sum, p) => sum + (p.payout_amount || 0), 0) || 0;

  // Get pending payouts
  const { data: pendingPayouts } = await supabase
    .from('matrix_entries')
    .select('payout_amount')
    .eq('is_completed', true)
    .eq('payout_status', 'pending');

  const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + (p.payout_amount || 0), 0) || 0;
  const pendingCount = pendingPayouts?.length || 0;

  const netProfit = totalRevenue - totalPayouts;

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .stat-box { background: #f3f4f6; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .stat-value { font-size: 24px; font-weight: bold; color: #111; }
        .profit { color: #059669; }
        .alert { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px 15px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Financial Report</h1>
        <p>${reportDate}</p>
      </div>
      <div class="content">
        <div class="stat-box">
          <div class="stat-label">Total Revenue (Earned)</div>
          <div class="stat-value">$${totalRevenue.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Matrix Payouts (Paid)</div>
          <div class="stat-value">$${totalPayouts.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Net Profit</div>
          <div class="stat-value profit">$${netProfit.toLocaleString()}</div>
        </div>
        ${pendingCount > 0 ? `
        <div class="alert">
          <strong>⚠️ ${pendingCount} pending payout(s)</strong> totaling $${pendingAmount.toLocaleString()} awaiting processing.
        </div>
        ` : ''}
      </div>
      <div class="footer">
        <p>This is an automated report from your admin dashboard.</p>
        <p style="color: #999;">Confidential - Financial data for authorized personnel only.</p>
      </div>
    </body>
    </html>
  `;
}