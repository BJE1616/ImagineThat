# ImagineThat.icu - Session Handoff Document
**Last Updated:** December 30, 2024

---

## 🎯 PROJECT OVERVIEW

**Project:** ImagineThat.icu - Creative advertising platform
**Location:** ~/Desktop/creative-advertising-platform
**Tech Stack:** Next.js 16, Supabase, Vercel, Stripe, Resend
**Live URL:** https://imaginethat.icu
**Owner:** Bobby Evans (bje1616@gmail.com)

---

## 👤 USER PREFERENCES (CRITICAL - FOLLOW THESE)

1. **One task at a time** - Don't overwhelm with multiple steps
2. **Full files preferred** - User copies/pastes into VSC rather than partial edits
3. **Be specific about which program** - Always say "In VSC", "In Terminal", or "In Supabase SQL Editor"
4. **Keep formatting exact** - Spaces matter in VSC search/replace
5. **Mac user** - Project at ~/Desktop/creative-advertising-platform
6. **GitHub for backups** - Use Terminal commands for git
7. **Chat length updates** - Update user every 10% on chat percentage
8. **Don't build without checking** - ALWAYS verify existing code before creating new files to avoid overwrites
9. **Discuss before building** - For major features, discuss the approach fully before writing code
10. **Compact UI preference** - User likes condensed, minimal padding designs in admin panels

---

## ✅ COMPLETED THIS SESSION

### FAQ System
- **Database:** `faqs` table with RLS policies
- **Admin page:** `/admin/faqs/page.js` - CRUD, search, categories, visibility toggle
- **Public page:** `/faq/page.js` - Searchable, filterable, accordion style
- **Navbar:** FAQ link added to Advertise dropdown
- **Admin sidebar:** FAQ link added to System group (alphabetized)

### Email System Overhaul
- **Email Templates Editor:** `/admin/email-templates/page.js`
  - Pulls from database `email_templates` table
  - Edit subject, HTML body, plain text
  - Live preview with variable substitution
  - Enable/disable toggle
  - Compact UI with category filters

- **Email Testing Panel:** `/admin/email-testing/page.js`
  - Pulls ALL templates from database dynamically
  - Test mode toggle (redirects all emails to test recipient)
  - Send test button for each template
  - Session log of sent emails
  - Link to Resend dashboard

- **Email Library Updated:** `/src/lib/email.js`
  - New `sendTemplateEmail()` function pulls from database
  - Falls back to hardcoded templates if database fails
  - `replaceVariables()` handles {{variable}} substitution

- **Send Email API Updated:** `/src/app/api/send-email/route.js`
  - Now uses `sendTemplateEmail()` for database-driven emails

### Vercel Deployment Fixes
- Connected correct GitHub repo (BJE1616/ImagineThat)
- Added all environment variables to Vercel
- Fixed Stripe initialization error (added || 'placeholder' fallback)
- Removed misplaced `/api/admin/reports/page.js`

---

## 📋 PENDING TASKS

### High Priority
1. **Build User Profile page** (`/profile` or `/settings`)
   - View/edit payout method (Venmo, CashApp)
   - View/edit payout handle (@username, $cashtag)
   - Change password
   - View referral username
   - Mailing address (optional, for prize winners)

2. **Add payout fields to database**
   - Add to `users` table: `payout_method`, `payout_handle`
   - May need `mailing_address` fields for prizes

3. **Collect payout info at ad purchase**
   - For Stripe (credit card) payers: MUST ask payout preference
   - For Venmo/CashApp payers: Auto-fill from payment method
   - Logic: Paid with Venmo → default payout to Venmo (same handle)

4. **Wire up Prize Winner email**
   - Template exists in database (`prize_winner`)
   - NOT currently triggered anywhere in code
   - Need to add to weekly winner selection process

5. **Set up Hostinger email forwarding**
   - Domain registered at Hostinger
   - Need: admin@imaginethat.icu → Gmail
   - Need: support@imaginethat.icu → Gmail

6. **Add FAQ content**
   - Payment options explained (Venmo, CashApp, Stripe)
   - Payout options explained
   - Why no PayPal (account freeze risk)
   - How matrix payouts work

7. **Deploy to Vercel**
   - Current changes not yet deployed
   - Run: `git push` (auto-deploys)

---

## 🗂️ KEY FILE LOCATIONS

### Email System
```
src/lib/email.js                          # Email sending + templates
src/app/api/send-email/route.js           # API endpoint
src/app/api/webhooks/route.js             # Campaign status change emails
src/app/api/send-report/route.js          # Admin report emails
src/app/admin/email-templates/page.js     # Template editor
src/app/admin/email-testing/page.js       # Test panel
```

### Admin Pages
```
src/app/admin/layout.js                   # Admin sidebar navigation
src/app/admin/faqs/page.js                # FAQ management
src/app/admin/email-templates/page.js     # Email template editor
src/app/admin/email-testing/page.js       # Email testing
src/app/admin/health/page.js              # Health dashboard
src/app/admin/settings/page.js            # Platform settings
src/app/admin/payout-queue/page.js        # Payout management
```

### User-Facing Pages
```
src/app/faq/page.js                       # Public FAQ
src/app/advertise/start/page.js           # Ad purchase flow
src/app/dashboard/page.js                 # User dashboard
src/app/auth/register/page.js             # Registration
src/app/auth/login/page.js                # Login
```

### Components
```
src/components/Navbar.js                  # Main navigation
src/lib/supabase.js                       # Supabase client
src/lib/ThemeContext.js                   # Theme provider
```

---

## 🗄️ KEY DATABASE TABLES

### Email System
- `email_templates` - All email templates (12 total)
  - Columns: template_key, template_name, subject, html_body, text_body, variables, enabled, category
  - Categories: user, financial, admin

- `admin_settings` - Includes email settings
  - `email_test_mode` (true/false)
  - `test_email_recipient` (email address)

### FAQ System
- `faqs` - FAQ entries
  - Columns: question, answer, category, display_order, is_active

### Users
- `users` - User accounts
  - Has: id, email, username, is_admin, role, simple_referral_count
  - NEEDS: payout_method, payout_handle (not yet added)

### Campaigns & Matrix
- `ad_campaigns` - Advertising campaigns
- `matrix_entries` - Referral matrix tracking
- `business_cards` - User ad cards

---

## 💰 PAYMENT/PAYOUT SYSTEM

### Current Payment Methods (Money IN)
- ✅ Stripe (credit card)
- ✅ Venmo
- ✅ CashApp

### Payout Methods (Money OUT) - NOT YET BUILT
- ✅ Venmo (planned)
- ✅ CashApp (planned)
- ❌ PayPal (avoiding - account freeze risk)
- ❌ Zelle (not adding yet)
- ❌ Stripe Connect (future, when volume justifies)

### Payout Logic to Implement
```
If paid with Venmo → Default payout to Venmo (same handle)
If paid with CashApp → Default payout to CashApp (same handle)
If paid with Stripe → MUST ask for payout preference
User can change payout method anytime in Profile
```

---

## 🔑 ENVIRONMENT VARIABLES (in Vercel)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
```

---

## ⚠️ IMPORTANT NOTES

### Email Template Keys
Database uses underscores: `matrix_completed`, `campaign_activated`
Some old code may use: `matrix_complete`, `campaignActivated`
Always check database for correct key!

### Template Variables Format
Use `{{variable}}` in templates
Example: `{{username}}`, `{{first_name}}`, `{{amount}}`

### Stripe Initialization Fix
All Stripe files use: `new Stripe(process.env.STRIPE_SECRET_KEY || 'placeholder')`
This prevents build errors when env vars aren't available at build time.

### Test Mode
Email test mode redirects ALL emails to test recipient.
Check `admin_settings` table for `email_test_mode` value.
Toggle in `/admin/email-testing` page.

---

## 🎯 USER'S GOALS

1. **Pre-launch:** Complete all features, test thoroughly
2. **Manual first:** Willing to do manual payouts initially
3. **Automation later:** Add Stripe Connect when volume justifies
4. **Self-maintaining:** Eventually site runs on auto-pilot
5. **Professional:** Clean emails, good UX, proper notifications

---

## 🔄 GIT WORKFLOW
```bash
cd ~/Desktop/creative-advertising-platform
git add .
git commit -m "Description of changes"
git push
```
Vercel auto-deploys from GitHub on push.

---

## 📊 CHAT PROTOCOL

- Update user on chat percentage every 10%
- Current session ended at ~65% full
- Always check existing code before creating new files
- Discuss major features before building
- One task at a time
- Be specific: "In VSC", "In Terminal", "In Supabase"

---

## 🚀 NEXT SESSION STARTING POINT

1. Build User Profile page
2. Add payout fields to users table
3. Integrate payout collection into ad purchase flow
4. Test full flow: Register → Buy ad → Set payout → Complete matrix → Receive payout email

---

*End of Handoff Document*
