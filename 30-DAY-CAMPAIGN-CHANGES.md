# 30-Day Campaign Model - Changes Summary

## COMPLETED CODE CHANGES

### 1. Stripe Webhook (`/src/app/api/stripe/webhook/route.js`)
- Added `expires_at` calculation (30 days from payment) when campaign goes active
- Queued campaigns don't get expires_at until promoted

### 2. Dashboard (`/src/app/dashboard/page.js`)
- Added `getDaysRemaining()` helper function
- Changed display from "X / 1000 views" to "X days remaining"
- Updated cancel modal to show days remaining instead of views

### 3. Email Templates (`/src/lib/email.js`)
- Updated `campaign_activated` to mention "30 days" instead of "Guaranteed Views"
- Updated `campaign_completed` to show "Total Views Earned" instead of "Delivered"

### 4. Campaign Status Webhook (`/src/app/api/webhooks/campaign-status/route.js`)
- Added `duration: '30 days'` variable for email template

### 5. New Cron Job (`/src/app/api/cron/check-expired-campaigns/route.js`)
- Daily cron to mark expired campaigns as completed
- Needs to be scheduled in your hosting platform (Vercel, etc.)

---

## SQL YOU ALREADY RAN

```sql
-- 1. Added expires_at column
ALTER TABLE ad_campaigns 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Updated completion trigger
CREATE OR REPLACE FUNCTION check_campaign_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NOT NULL 
       AND NOW() >= NEW.expires_at 
       AND NEW.status = 'active' THEN
        NEW.status := 'completed';
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## SQL STILL NEEDED

Run this in Supabase SQL Editor:

```sql
-- Update the promote_queued_campaign function to set expires_at
CREATE OR REPLACE FUNCTION promote_queued_campaign()
RETURNS TRIGGER AS $$
BEGIN
    -- When a campaign completes, promote the next queued campaign
    IF NEW.status = 'completed' AND OLD.status = 'active' THEN
        UPDATE ad_campaigns
        SET 
            status = 'active',
            expires_at = NOW() + INTERVAL '30 days',
            updated_at = NOW()
        WHERE user_id = NEW.user_id
        AND status = 'queued'
        AND id = (
            SELECT id FROM ad_campaigns
            WHERE user_id = NEW.user_id
            AND status = 'queued'
            ORDER BY created_at ASC
            LIMIT 1
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## DEPLOYMENT STEPS

1. ✅ Database changes (expires_at column, triggers) - DONE
2. ⏳ Run the promote_queued_campaign SQL above
3. Copy the updated code files to your local project
4. Deploy to production
5. Set up daily cron job for `/api/cron/check-expired-campaigns`
   - In Vercel: Add cron in vercel.json
   - Needs CRON_SECRET env variable

---

## CRON SETUP (Vercel)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-expired-campaigns",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Add env variable: `CRON_SECRET=your-secret-here`

---

## FILES CHANGED

| File | Status |
|------|--------|
| `/src/app/api/stripe/webhook/route.js` | ✅ Updated |
| `/src/app/dashboard/page.js` | ✅ Updated |
| `/src/lib/email.js` | ✅ Updated |
| `/src/app/api/webhooks/campaign-status/route.js` | ✅ Updated |
| `/src/app/api/cron/check-expired-campaigns/route.js` | ✅ Created |

---

## WHAT STAYS THE SAME

- All view tracking (views_from_game, views_from_flips, etc.)
- Matrix system
- Token economy
- Games
- Campaign pricing

Views are now for **reporting only** - not for determining campaign completion.
