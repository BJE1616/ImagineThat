import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
    // Optional: Add a secret key check for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require it (skip check if not set for development)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
        const dayOfMonth = now.getDate();

        // Get all enabled subscriptions
        const { data: subscriptions, error } = await supabase
            .from('admin_report_subscriptions')
            .select('*')
            .eq('enabled', true);

        if (error) {
            console.error('Error fetching subscriptions:', error);
            return Response.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
        }

        const results = {
            checked: subscriptions?.length || 0,
            sent: 0,
            skipped: 0,
            errors: []
        };

        for (const sub of subscriptions || []) {
            // Determine if this subscription should send today
            let shouldSend = false;

            if (sub.frequency === 'daily') {
                shouldSend = true;
            } else if (sub.frequency === 'weekly' && dayOfWeek === 1) {
                // Weekly = Mondays only
                shouldSend = true;
            } else if (sub.frequency === 'monthly' && dayOfMonth === 1) {
                // Monthly = 1st of month only
                shouldSend = true;
            }

            if (!shouldSend) {
                results.skipped++;
                continue;
            }

            // Send the report
            try {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                const response = await fetch(`${baseUrl}/api/send-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: sub.user_id,
                        user_email: sub.user_email,
                        user_name: sub.user_name,
                        report_type: sub.report_type,
                        is_test: false
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    results.sent++;
                } else {
                    results.errors.push({
                        user: sub.user_name,
                        report: sub.report_type,
                        error: result.error
                    });
                }
            } catch (err) {
                results.errors.push({
                    user: sub.user_name,
                    report: sub.report_type,
                    error: err.message
                });
            }
        }

        return Response.json({
            success: true,
            message: `Processed ${results.checked} subscriptions`,
            sent: results.sent,
            skipped: results.skipped,
            errors: results.errors
        });

    } catch (error) {
        console.error('Cron send-reports error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}