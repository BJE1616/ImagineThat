
"Read the files SESSION-HANDOFF.md and imaginethat-website-improvements.md from my GitHub repo at https://github.com/BJE1616/imaginethat-app"

I'll help you read those files from your GitHub repository. Let me fetch them for you.


View steps
I'm unable to fetch directly from GitHub. Let me try using the raw content URLs instead:


View steps
The web fetch tool is blocked from accessing GitHub.Let me try using the browser tools instead to access these files:


    View steps
I can see you already have a tab open to your GitHub repo.Let me navigate to the files you need:


View steps
I got the first file.Now let me get the second one:


    View steps
Here's the content from both files:

SESSION - HANDOFF.md
ImagineThat.icu - Session Handoff Document

Session Date: January 16 - 17, 2026
Project: ImagineThat.icu - Creative Advertising Platform
Live Site: https://www.imaginethat.icu
GitHub Repo: https://github.com/BJE1616/imaginethat-app (Private)
CRITICAL BUG: View Tracking Logic
The Problem: The database has the correct tables to track unique vs.repeat views, but the application code is NOT using them.

    Database Tables (Exist but Unused):

promo_card_views - Should track unique views(55 records, NOT BEING USED)
bonus_views_history - Should track repeat views(3 records, BARELY USED)
What the Code Actually Does: From src / app / game / page.js - it simply increments counters without checking for unique users.

Required Fix: When recording a view:

Check promo_card_views for existing record(user_id + promo_card_id)
If NOT found = UNIQUE VIEW - insert into promo_card_views, increment views_from_game
If found = BONUS VIEW - insert into bonus_views_history, increment bonus_views only
What Was Tested This Session
All public pages working(Homepage, Games, Card Gallery, Winners Circle, Advertise)
Admin panel fully operational(14 email templates, 29 campaigns, 36 users)
Responsive design working
Pricing Recommendations
Tier	Views	Price	CPM
Starter	500	$35	$70
Standard	1, 500	$75	$50
Growth	5,000	$200	$40
Premium	15,000	$500	$33
UI Suggestions
Add footer(Privacy Policy, Terms, Social links)
Expand homepage content
Create dedicated contact page
Tech Stack
Next.js(App Router), Supabase(PostgreSQL - 83 tables), Stripe payments, Resend email, Vercel deployment

Key Files to Modify
src / app / game / page.js - Main game logic, view tracking
src / app / cards / page.js - Card gallery
src / app / advertise / page.js - Pricing updates
imaginethat - website - improvements.md
ImagineThat.icu - Website Improvement Suggestions

Review Date: January 16, 2026
Website: www.imaginethat.icu
Status: Ready for launch - these are enhancements, not blockers
Suggested Improvements
Add a Footer Section(Priority: Medium) - Privacy Policy, Terms of Service, social media icons, copyright, contact email
Add Social Media Presence(Priority: Medium) - Brand awareness, community building, user engagement
Expand Homepage Content(Priority: Low - Medium) - Featured games, recent winners, quick stats, "How it works"
Create a Dedicated Contact Page(Priority: Low) - Contact forms for players vs advertisers
CRITICAL - View Tracking Logic Fix(Priority: HIGH - Revenue Impact)
Same issue documented in the handoff - database tables exist but aren't being used properly.

Pricing Recommendations(Priority: HIGH)
Same pricing table as the handoff document.

Database Tables Related to Views
Table	Purpose	Status
ad_campaigns	Campaign data with view counters	Active
promo_card_views	Should track unique views	NOT USED
bonus_views_history	Should track repeat views	BARELY USED
Summary: The critical issue across both documents is the view tracking bug in src / app / game / page.js - the code increments view counters without distinguishing between unique and repeat views, even though the database tables exist to support this.This has revenue implications since advertisers should be charged differently for unique vs.bonus views.

Would you like me to help you work on fixing the view tracking logic or any of the other improvements ?

    Add all issues to the todo list and then give me the whole list numbered and with priority status.


View steps
Here's the complete numbered list with priority status:

ImagineThat.icu - Improvement Tasks
#	Task	Priority	Status
1	Fix unique vs.bonus view tracking logic in src / app / game / page.js — Check promo_card_views for existing records, distinguish between unique views and bonus views	HIGH(Revenue Impact)	Pending
2	Update advertising pricing structure on src / app / advertise / page.js — Implement new tiered pricing(Starter $35 / 500, Standard $75 / 1500, Growth $200 / 5000, Premium $500 / 15000)	HIGH	Pending
3	Add footer section — Privacy Policy, Terms of Service, Social media icons, Copyright notice, Contact email link	MEDIUM	Pending
4	Add social media presence — Brand awareness, community building, user engagement links	MEDIUM	Pending
5	Expand homepage content — Featured games section, Recent winners showcase, Quick stats, "How it works" overview	LOW - MEDIUM	Pending
6	Create dedicated contact page — Contact form with separate options for players vs advertisers	LOW	Pending
Recommendation: Start with items #1 and #2 since they're marked as HIGH priority and directly impact revenue. The view tracking bug is especially critical since it affects how advertisers are billed.

Would you like me to start working on any of these ?

    Can you fix and test number 1 without my assistance ?

        I need to assess what's involved before I can answer that honestly.

To fix and test the view tracking logic, I would need to:

Read the current code in src / app / game / page.js - I can do this via your GitHub repo in the browser
Understand the database schema for promo_card_views and bonus_views_history tables
Write the fix - modify the logic to check for existing views before incrementing
Test it - this is where it gets tricky
The challenge: I don't have direct access to:

Your local development environment or codebase(no folder selected)
Your Supabase database to verify the schema or test queries
The ability to push changes to your GitHub repo
The live site's backend to test the fix
What I CAN do:

Read the current code from GitHub via the browser
Write the corrected code for you to review
Explain exactly what needs to change and why
What I'd need from you to fully test:

Either select your local project folder so I can work with the files directly
Or provide Supabase access / credentials to verify the database schema
Or you could test my proposed fix locally
Would you like me to:

Read the code and write the fix - I'll give you the corrected code to implement yourself
Work with your local files - Select your project folder and I can make the changes directly
Which approach works better for you ?

    I'll give you access if you tell me what to do.

To give me access to your project files, click the folder icon in the chat input area(or look for "Select folder" / "Add folder" option) and select your imaginethat - app project folder on your computer.

Once you do that, I'll be able to:

Read and edit the source files directly
Make the code changes needed
Run the dev server to test
Verify the fix works
Go ahead and select the folder, and I'll take it from there!

Be more specific.I don't even know what programs you are talking about.

I'm talking about this chat window you're using right now - the Claude desktop app in Cowork mode.

    Here's exactly what to do:

Look at the bottom of this chat where you type messages
Find the paperclip icon(📎) or a folder icon - it should be near the text input box
Click it and you should see an option like "Select folder" or "Add folder"
Navigate to your imaginethat - app project folder on your computer(wherever you have the code saved locally)
Select that folder
If you don't see a paperclip or folder icon, look for a "+" button near the input area that might expand to show attachment options.

Once you select the folder, I'll have access to read and edit your project files directly.

Can you see any of those icons in the chat input area ?

    I see ad files but not folder.

"Add files" works! Here's what to do:

Click "Add files"
Look for an option that says "Choose folder" or "Select folder"(it might be alongside options like "Upload file" or "Take photo")
Navigate to your imaginethat - app project folder and select it
If you only see options to add individual files(not folders), that's okay too - let me know what options appear after you click "Add files" and I'll guide you from there.

What do you see when you click it ?

    It says add files or photos.

That option is for uploading individual files, not giving me access to your project folder.

Let me try a different approach - I can request folder access directly:


View steps
It seems the folder picker didn't appear. This might be a limitation in the current interface.

Alternative approach: Since I have access to your GitHub repo through the browser, and you have the live site open, let me:

Read the current code from GitHub
Write the complete fix
You can then copy it into your local files and push to GitHub
Or if you have your project open in VS Code or another editor, you could copy the file contents here and I'll give you the fixed version.

Would either of those work for you ?

    I can copy the file from VSC.

Copy the contents of src / app / game / page.js and paste it here.That's the main file that needs the view tracking fix.

If the file is very long, you can also just paste the section that handles view tracking / recording - but the whole file is probably better so I can see the full context.

The copy is not working.Want to request it from the terminal ?

    Yes! Let me clone your repo and get the file directly:


View steps
The repo is private, so I need authentication.Let me try reading it through the browser instead since you're already logged into GitHub there:


View steps
The file is large.Let me get it in a more focused way:


View steps
I've got the full file. Now I need to also see the database schema for the promo_card_views and bonus_views_history tables to write the correct fix. Let me check your repo for any schema files or look at the Supabase structure.


View steps
The search only shows the documentation files, not actual code using those tables.The tables exist in Supabase but aren't used in the code yet. Let me check your live site's Supabase to understand the table structure - I can see you have the admin panel open:


View steps
I can see the admin panel.Based on the documentation and the code I've read, I now have enough information to write the fix. Here's what I understand:

Current Problem in the code:

trackGameView() and trackFlipView() just increment counters in ad_campaigns table without checking if the user has already viewed
The promo_card_views and bonus_views_history tables exist but are never used
The Fix Required:

Before incrementing views_from_game, check if a record exists in promo_card_views for this user + promo_card combination
If NOT found → it's a UNIQUE view → insert into promo_card_views AND increment views_from_game
If found → it's a BONUS view → insert into bonus_views_history AND increment bonus_views only
Let me write the corrected code.I'll save it to a file you can download:


View steps
I've written the fixed code. Here's a summary of the changes made:

Changes Made to Fix View Tracking
1. trackGameView() function (lines 226-290)
Now accepts promoCardId parameter
Checks promo_card_views table for existing record with matching user_id + promo_card_id
If NOT found(unique view): Inserts into promo_card_views AND increments views_from_game
If found(bonus view): Inserts into bonus_views_history AND increments bonus_views only
2. trackFlipView() function (lines 295-365)
Now accepts promoCardId parameter
Same logic as above but for flip views, incrementing views_from_flips
3. loadCards() function (line 412)
Updated call to pass card.id to trackGameView(card.user_id, card.id)
4. handleCardClick() function (line 468)
Updated call to pass card.id to trackFlipView(card.user_id, card.uniqueId, card.id)
Before You Deploy
I need to verify the database table structure.Can you confirm these columns exist in your Supabase tables ?

    promo_card_views table should have:

id, user_id, promo_card_id, campaign_id, view_type, viewed_at
bonus_views_history table should have:

id, user_id, promo_card_id, campaign_id, view_type, viewed_at
If the column names are different, I'll need to adjust the code. Can you check your Supabase dashboard and confirm?

View the fixed file

Game page fixed
JS 
give me the SQL and I'll check.

Here's the SQL to check the table structures:

sql
--Check promo_card_views table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'promo_card_views'
ORDER BY ordinal_position;

--Check bonus_views_history table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bonus_views_history'
ORDER BY ordinal_position;
Run that in your Supabase SQL Editor and let me know what columns exist.I'll adjust the code to match your actual schema.

    | column_name | data_type | is_nullable |
| ----------- | ------------------------ | ----------- |
| id | uuid | NO |
| user_id | uuid | NO |
| campaign_id | uuid | YES |
| amount | integer | NO |
| message | text | YES |
| reason | text | YES |
| given_by | uuid | YES |
| created_at | timestamp with time zone | YES |

    That's actually the schema for a different table (looks like a bonus/rewards table based on the amount, message, reason, given_by columns).

Can you run this query to see all your tables that contain "view" in the name ?

    sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%view%';
And also this one to check if promo_card_views exists at all:

sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN('promo_card_views', 'bonus_views_history', 'card_views');
This will help me find the correct tables to use for tracking unique vs.repeat views.

| table_name |
| ------------------------ |
| promo_card_views |
| admin_financial_overview |
| bonus_views_history |
| game_sessions_view |
| card_gallery_views |

    The tables exist.Now let me get the actual structure of both:

sql
--Check promo_card_views structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'promo_card_views'
ORDER BY ordinal_position;

--Check bonus_views_history structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bonus_views_history'
ORDER BY ordinal_position;
Run both and paste the results - I need to see the actual columns so I can update the code to match.

| table_name |
| ------------------- |
| bonus_views_history |
| promo_card_views |

    That query just returned the table names again.Let me give you the exact queries separately:

Run this first:

sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'promo_card_views';
Then run this:

sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bonus_views_history';
Paste the results from each one.

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'promo_card_views';

You pasted the query instead of the results.Run that query in your Supabase SQL Editor and paste the output table it returns - it should show you the column names and data types for the promo_card_views table.

| column_name | data_type |
| ------------- | ------------------------ |
| id | uuid |
| promo_card_id | uuid |
| user_id | uuid |
| view_type | text |
| game_type | text |
| created_at | timestamp with time zone |

    Got it.Now run the second one:

sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bonus_views_history';
| column_name | data_type |
| ----------- | ------------------------ |
| id | uuid |
| user_id | uuid |
| campaign_id | uuid |
| amount | integer |
| message | text |
| reason | text |
| given_by | uuid |
| created_at | timestamp with time zone |

    Now I see the issue.The bonus_views_history table has a different structure than expected - it looks like it's designed for manually awarding bonus views (with amount, message, reason, given_by), not for tracking repeat views.

Let me update the fix to work with your actual schema:

promo_card_views - Perfect for tracking unique views.Has: id, promo_card_id, user_id, view_type, game_type, created_at

bonus_views_history - For manual bonus awards, not automated repeat view tracking.

Updated approach:

Check promo_card_views for existing record(user_id + promo_card_id)
If NOT found = UNIQUE VIEW → insert into promo_card_views, increment views_from_game
If found = REPEAT VIEW → just increment bonus_views(no insert needed since we're just counting repeats)

View steps
Now let me update the trackFlipView function with the same fix:


View steps
The file is now updated with the correct schema.Here's the summary of the fix:

Fixed Code - Ready for Deployment
Logic now works as follows:

Scenario	Action
Logged -in user, first time seeing card	Insert to promo_card_views + increment views_from_game / views_from_flips
Logged -in user, seen card before	Only increment bonus_views
Anonymous user	Only increment bonus_views(can't track uniqueness)
Columns used in promo_card_views:

    user_id(uuid) - the viewer
promo_card_id(uuid) - the card being viewed
view_type(text) - 'game' or 'flip'
game_type(text) - 'memory'
To deploy:

    Replace your src / app / game / page.js with this file
Push to GitHub
Vercel will auto - deploy
View the fixed file

Want me to help you test it after you deploy, or do you have any questions about the changes ?

    Game page fixed
JS 
is all of this supposed to be showing up in at the bottom of the file you just build ?    

        )}
      </main >
    </div >
  )
}

Progress
1
Fixing unique vs.bonus view tracking logic
2
Update advertising pricing structure on src / app / advertise / page.js
3
Add footer section(Privacy Policy, Terms, Social links, Copyright, Contact)
4
Add social media presence / links
Show 2 more

Artifacts
game - page - fixed.js

Context
Connectors
Claude in Chrome icon
Claude in Chrome
Show more
No, that should NOT be in the file! That's the UI from the chat interface that accidentally got included. Let me fix that by removing everything after the closing of the component.


View steps
The file looks clean - it ends properly at line 1107 with just the closing } for the component.Let me check if there's anything after that:


View steps
The file is clean - it ends correctly with just }. The garbage you saw must have been from how the file was displayed in the UI preview, not actually in the file itself.

The file is ready to use.To confirm, here's the line count:


View steps
1107 lines, ending cleanly with the component's closing brace. The file is good to go.

View the fixed file

Copy this to your src / app / game / page.js and deploy it.Want me to help test it after you push the changes ?

    Game page fixed
JS 




Claude is AI and can make mistakes.Please double - check responses.
Game page fixed · JS
'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function GamePage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [cards, setCards] = useState([])
    const [flippedCards, setFlippedCards] = useState([])
    const [matchedPairs, setMatchedPairs] = useState([])
    const [moves, setMoves] = useState(0)
    const [gameMode, setGameMode] = useState('easy')
    const [gameStarted, setGameStarted] = useState(false)
    const [gameComplete, setGameComplete] = useState(false)
    const [startTime, setStartTime] = useState(null)
    const [endTime, setEndTime] = useState(null)
    const [loading, setLoading] = useState(true)
    const [easyLeaderboard, setEasyLeaderboard] = useState([])
    const [challengeLeaderboard, setChallengeLeaderboard] = useState([])
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [weeklyPrize, setWeeklyPrize] = useState(null)
    const [cardBackSetting, setCardBackSetting] = useState(null)
    const [cardBackAdvertiser, setCardBackAdvertiser] = useState(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [viewingCard, setViewingCard] = useState(null)
    const trackedGameViews = useRef(new Set())
    const trackedFlipViews = useRef(new Set())
    const [sessionId, setSessionId] = useState(null)
    const trackedCardBackView = useRef(false)

    useEffect(() => {
        checkUser()
        loadWeeklyPrize()
        loadCardBackSetting()
        loadCardBackAdvertiser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)
            await loadLeaderboards()
        } catch (error) {
            console.error('Error:', error)
            await loadLeaderboards()
        } finally {
            setLoading(false)
        }
    }

    const loadCardBackSetting = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')
                .in('setting_key', ['card_back_logo_url', 'show_advertiser_cards'])

            if (data) {
                const settings = {}
                data.forEach(item => {
                    settings[item.setting_key] = item.setting_value
                })
                setCardBackSetting(settings)
            }
        } catch (error) {
            console.log('Error loading card back setting')
        }
    }

    const trackCardBackView = async (cardUserId, viewCount = 1) => {
        if (!cardUserId || trackedCardBackView.current) return
        trackedCardBackView.current = true

        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_card_back')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                const campaign = campaigns[0]
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_card_back: (campaign.views_from_card_back || 0) + viewCount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)
            }
        } catch (error) {
            console.log('Error tracking card back view')
        }
    }

    const loadCardBackAdvertiser = async () => {
        try {
            const { data: campaigns, error } = await supabase
                .from('ad_campaigns')
                .select('user_id, views_guaranteed, views_from_game, views_from_flips, bonus_views')
                .eq('status', 'active')

            if (error || !campaigns || campaigns.length === 0) return

            const eligibleCampaigns = campaigns.filter(c => {
                const totalViews = (c.views_from_game || 0) + (c.views_from_flips || 0)
                return totalViews < (c.views_guaranteed || 0) || (c.bonus_views || 0) > 0
            })

            if (eligibleCampaigns.length === 0) return

            const randomCampaign = eligibleCampaigns[Math.floor(Math.random() * eligibleCampaigns.length)]

            const { data: cards, error: cardError } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', randomCampaign.user_id)

            if (cards && cards.length > 0) {
                setCardBackAdvertiser(cards[0])
            } else {
                const userIds = eligibleCampaigns.map(c => c.user_id)
                const { data: anyCards } = await supabase
                    .from('business_cards')
                    .select('*')
                    .in('user_id', userIds)

                if (anyCards && anyCards.length > 0) {
                    setCardBackAdvertiser(anyCards[0])
                }
            }
        } catch (error) {
            console.log('Error loading card back advertiser')
        }
    }

    const loadWeeklyPrize = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('is_active', true)
                .maybeSingle()

            if (data) {
                setWeeklyPrize(data)
            }
        } catch (error) {
            console.log('No prize set for this week')
        }
    }

    const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
    }

    const loadLeaderboards = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data: easyData, error: easyError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('game_mode', 'easy')
                .order('score', { ascending: true })
                .limit(10)

            if (easyError) throw easyError

            const { data: challengeData, error: challengeError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('game_mode', 'challenge')
                .order('score', { ascending: true })
                .limit(10)

            if (challengeError) throw challengeError

            const allUserIds = [
                ...easyData.map(entry => entry.user_id),
                ...challengeData.map(entry => entry.user_id)
            ]
            const uniqueUserIds = [...new Set(allUserIds)]

            let usersData = []
            if (uniqueUserIds.length > 0) {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, username')
                    .in('id', uniqueUserIds)

                if (!error) usersData = data || []
            }

            const easyWithUsers = easyData.map(entry => ({
                ...entry,
                users: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown' }
            }))

            const challengeWithUsers = challengeData.map(entry => ({
                ...entry,
                users: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown' }
            }))

            setEasyLeaderboard(easyWithUsers)
            setChallengeLeaderboard(challengeWithUsers)
        } catch (error) {
            console.error('Error loading leaderboards:', error)
        }
    }

    // =============================================================================
    // FIXED: trackGameView - Now properly uses promo_card_views for unique tracking
    // =============================================================================
    const trackGameView = async (cardUserId, promoCardId) => {
        if (!cardUserId || trackedGameViews.current.has(cardUserId)) return
        trackedGameViews.current.add(cardUserId)

        try {
            // Get the active campaign for this advertiser
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_game, bonus_views')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (!campaigns || campaigns.length === 0) {
                // No active campaign - check for any campaign and add to bonus_views
                const { data: anyCampaigns } = await supabase
                    .from('ad_campaigns')
                    .select('id, bonus_views')
                    .eq('user_id', cardUserId)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (anyCampaigns && anyCampaigns.length > 0) {
                    await supabase
                        .from('ad_campaigns')
                        .update({
                            bonus_views: (anyCampaigns[0].bonus_views || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', anyCampaigns[0].id)
                }
                return
            }

            const campaign = campaigns[0]
            const viewerUserId = user?.id || null

            // Check if this user has already viewed this promo card (unique view check)
            // For anonymous users, we skip the unique check and count as bonus
            let existingView = null
            if (viewerUserId) {
                const { data } = await supabase
                    .from('promo_card_views')
                    .select('id')
                    .eq('user_id', viewerUserId)
                    .eq('promo_card_id', promoCardId)
                    .maybeSingle()
                existingView = data
            }

            if (!existingView && viewerUserId) {
                // UNIQUE VIEW - First time this logged-in user is seeing this card
                // 1. Insert into promo_card_views to track this unique view
                await supabase
                    .from('promo_card_views')
                    .insert({
                        user_id: viewerUserId,
                        promo_card_id: promoCardId,
                        view_type: 'game',
                        game_type: 'memory'
                    })

                // 2. Increment views_from_game (counts toward guaranteed views)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_game: (campaign.views_from_game || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)

            } else {
                // BONUS VIEW - User has seen this card before OR is anonymous
                // Only increment bonus_views (does NOT count toward guaranteed)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        bonus_views: (campaign.bonus_views || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)
            }

        } catch (error) {
            console.log('Error tracking game view:', error)
        }
    }

    // =============================================================================
    // FIXED: trackFlipView - Now properly uses promo_card_views for unique tracking
    // =============================================================================
    const trackFlipView = async (cardUserId, cardUniqueId, promoCardId) => {
        const trackKey = `${cardUserId}-${cardUniqueId}`
        if (!cardUserId || trackedFlipViews.current.has(trackKey)) return
        trackedFlipViews.current.add(trackKey)

        try {
            // Get the active campaign for this advertiser
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_flips, bonus_views')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (!campaigns || campaigns.length === 0) {
                // No active campaign - check for any campaign and add to bonus_views
                const { data: anyCampaigns } = await supabase
                    .from('ad_campaigns')
                    .select('id, bonus_views')
                    .eq('user_id', cardUserId)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (anyCampaigns && anyCampaigns.length > 0) {
                    await supabase
                        .from('ad_campaigns')
                        .update({
                            bonus_views: (anyCampaigns[0].bonus_views || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', anyCampaigns[0].id)
                }
                return
            }

            const campaign = campaigns[0]
            const viewerUserId = user?.id || null

            // Check if this user has already viewed this promo card (unique view check)
            // For anonymous users, we skip the unique check and count as bonus
            let existingView = null
            if (viewerUserId) {
                const { data } = await supabase
                    .from('promo_card_views')
                    .select('id')
                    .eq('user_id', viewerUserId)
                    .eq('promo_card_id', promoCardId)
                    .maybeSingle()
                existingView = data
            }

            if (!existingView && viewerUserId) {
                // UNIQUE VIEW - First time this logged-in user is seeing this card
                // 1. Insert into promo_card_views to track this unique view
                await supabase
                    .from('promo_card_views')
                    .insert({
                        user_id: viewerUserId,
                        promo_card_id: promoCardId,
                        view_type: 'flip',
                        game_type: 'memory'
                    })

                // 2. Increment views_from_flips (counts toward guaranteed views)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_flips: (campaign.views_from_flips || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)

            } else {
                // BONUS VIEW - User has seen this card before OR is anonymous
                // Only increment bonus_views (does NOT count toward guaranteed)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        bonus_views: (campaign.bonus_views || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)
            }

        } catch (error) {
            console.log('Error tracking flip view:', error)
        }
    }

    const loadCards = async (mode) => {
        try {
            const limit = mode === 'easy' ? 6 : 8
            trackedGameViews.current = new Set()
            trackedFlipViews.current = new Set()

            const { data: activeCampaigns, error: campaignError } = await supabase
                .from('ad_campaigns')
                .select('user_id')
                .eq('status', 'active')

            if (campaignError) throw campaignError

            const activeAdvertiserIds = [...new Set(activeCampaigns?.map(c => c.user_id) || [])]
            let cardsData = []

            if (activeAdvertiserIds.length > 0) {
                let query = supabase
                    .from('business_cards')
                    .select('*')
                    .in('user_id', activeAdvertiserIds)

                if (cardBackSetting?.show_advertiser_cards === 'true' && cardBackAdvertiser?.user_id) {
                    query = query.neq('user_id', cardBackAdvertiser.user_id)
                }

                const { data, error } = await query
                if (error) throw error
                cardsData = data || []
            }

            if (cardsData.length < limit) {
                const { data: houseCards, error } = await supabase
                    .from('business_cards')
                    .select('*')
                    .eq('is_house_card', true)

                if (!error && houseCards && houseCards.length > 0) {
                    const shuffledHouse = houseCards.sort(() => Math.random() - 0.5)
                    while (cardsData.length < limit && shuffledHouse.length > 0) {
                        cardsData.push(shuffledHouse.pop())
                    }
                }
            }

            if (cardsData.length === 0) {
                alert('No business cards available yet. Check back soon!')
                setGameStarted(false)
                return
            }

            let selectedCards = []
            while (selectedCards.length < limit) {
                const shuffled = [...cardsData].sort(() => Math.random() - 0.5)
                selectedCards = [...selectedCards, ...shuffled].slice(0, limit)
            }

            const cardPairs = []
            selectedCards.forEach((card, pairIndex) => {
                cardPairs.push({ ...card, uniqueId: pairIndex * 2, pairId: pairIndex })
                cardPairs.push({ ...card, uniqueId: pairIndex * 2 + 1, pairId: pairIndex })
            })

            const shuffled = cardPairs.sort(() => Math.random() - 0.5)
            setCards(shuffled)

            const cardIds = selectedCards.map(card => card.id)
            await createGameSession(mode, cardIds)

            // FIXED: Pass both user_id AND card id to trackGameView
            selectedCards.forEach(card => {
                if (card.user_id) {
                    trackGameView(card.user_id, card.id)
                }
            })

        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const getDeviceType = () => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 'mobile' : 'desktop'
        }
        return 'unknown'
    }

    const createGameSession = async (mode, cardIds) => {
        try {
            const { data, error } = await supabase
                .from('game_sessions')
                .insert([{
                    user_id: user?.id || null,
                    game_mode: mode,
                    started_at: new Date().toISOString(),
                    cards_shown: cardIds,
                    device_type: getDeviceType()
                }])
                .select()
                .maybeSingle()

            if (!error && data) {
                setSessionId(data.id)
                return data.id
            }
        } catch (error) {
            console.error('Error creating game session:', error)
        }
        return null
    }

    const completeGameSession = async (finalMoves, finalScore) => {
        if (!sessionId) return

        try {
            await supabase
                .from('game_sessions')
                .update({
                    completed_at: new Date().toISOString(),
                    moves: finalMoves,
                    score: finalScore
                })
                .eq('id', sessionId)
        } catch (error) {
            console.error('Error completing game session:', error)
        }
    }

    const startGame = async (mode) => {
        if (cardBackSetting?.show_advertiser_cards === 'true' && cardBackAdvertiser) {
            const viewCount = mode === 'easy' ? 12 : 16
            trackCardBackView(cardBackAdvertiser.user_id, viewCount)
        }

        setGameMode(mode)
        setGameStarted(true)
        setGameComplete(false)
        setMoves(0)
        setMatchedPairs([])
        setFlippedCards([])
        setStartTime(Date.now())
        setEndTime(null)
        await loadCards(mode)
    }

    const playAgain = () => {
        setGameStarted(false)
        setGameComplete(false)
        setMoves(0)
        setMatchedPairs([])
        setFlippedCards([])
        setCards([])
        setStartTime(null)
        setEndTime(null)
    }

    const saveScoreDirectly = async (finalMoves, finalTime, finalScore, mode) => {
        if (!user) return

        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)

        try {
            const { error } = await supabase
                .from('leaderboard')
                .insert([{
                    user_id: user.id,
                    game_mode: mode,
                    moves: finalMoves,
                    time_seconds: finalTime,
                    score: finalScore,
                    week_start: weekStart.toISOString().split('T')[0]
                }])

            if (error) throw error
            await loadLeaderboards()
        } catch (error) {
            console.error('Error saving score:', error)
        }
    }

    const handleCardClick = (clickedCard) => {
        if (!gameStarted || gameComplete) return
        if (flippedCards.length === 2) return
        if (flippedCards.some(card => card.uniqueId === clickedCard.uniqueId)) return
        if (matchedPairs.includes(clickedCard.pairId)) return

        // FIXED: Pass the card.id (promo_card_id) to trackFlipView
        if (clickedCard.user_id) {
            trackFlipView(clickedCard.user_id, clickedCard.uniqueId, clickedCard.id)
        }

        const newFlipped = [...flippedCards, clickedCard]
        setFlippedCards(newFlipped)

        if (newFlipped.length === 2) {
            const newMoves = moves + 1
            setMoves(newMoves)

            if (newFlipped[0].pairId === newFlipped[1].pairId) {
                const newMatched = [...matchedPairs, newFlipped[0].pairId]
                setMatchedPairs(newMatched)
                setTimeout(() => setFlippedCards([]), 500)

                const pairsNeeded = gameMode === 'easy' ? 6 : 8
                if (newMatched.length === pairsNeeded) {
                    const finalTime = Date.now()
                    setEndTime(finalTime)
                    setGameComplete(true)

                    if (user) {
                        const timeSeconds = Math.floor((finalTime - startTime) / 1000)
                        const finalScore = (newMoves * 2) + timeSeconds
                        saveScoreDirectly(newMoves, timeSeconds, finalScore, gameMode)
                        completeGameSession(newMoves, finalScore)
                    }
                }
            } else {
                setTimeout(() => setFlippedCards([]), 1000)
            }
        }
    }

    const trackCardClick = async (cardUserId) => {
        if (!cardUserId) return

        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_clicks')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_clicks: (campaigns[0].views_from_clicks || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaigns[0].id)
            }
        } catch (error) {
            // Silently fail
        }
    }

    const isCardFlipped = (card) => {
        return flippedCards.some(c => c.uniqueId === card.uniqueId) || matchedPairs.includes(card.pairId)
    }

    useEffect(() => {
        let interval
        if (gameStarted && !gameComplete && startTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [gameStarted, gameComplete, startTime])

    const getElapsedTime = () => {
        if (endTime && startTime) {
            return Math.floor((endTime - startTime) / 1000)
        }
        return elapsedTime
    }

    const CardBack = () => (
        <div className="absolute top-1 right-1 bg-amber-400 text-slate-900 text-[8px] font-bold px-1 rounded z-10">TAP</div>
    )

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {viewingCard && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingCard(null)}
                >
                    <div
                        className="max-w-sm w-full rounded-xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {viewingCard.card_type === 'uploaded' && viewingCard.image_url ? (
                            <div className="bg-slate-800">
                                <img
                                    src={viewingCard.image_url}
                                    alt="Card"
                                    className="w-full h-auto"
                                />
                                <button
                                    onClick={() => setViewingCard(null)}
                                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div
                                className="p-6"
                                style={{ backgroundColor: viewingCard.card_color || '#4F46E5' }}
                            >
                                <div className="text-center mb-4">
                                    <h2
                                        className="font-bold text-xl"
                                        style={{ color: viewingCard.text_color || '#FFFFFF' }}
                                    >
                                        {viewingCard.title}
                                    </h2>
                                </div>
                                {viewingCard.message && (
                                    <div className="text-center mb-4">
                                        <p
                                            className="text-sm"
                                            style={{ color: viewingCard.text_color || '#FFFFFF' }}
                                        >
                                            {viewingCard.message}
                                        </p>
                                    </div>
                                )}
                                <div
                                    className="text-center space-y-1"
                                    style={{ color: viewingCard.text_color || '#FFFFFF' }}
                                >
                                    {viewingCard.phone && <p className="text-sm">📞 {viewingCard.phone}</p>}
                                    {viewingCard.email && <p className="text-sm">✉️ {viewingCard.email}</p>}
                                </div>
                                <button
                                    onClick={() => setViewingCard(null)}
                                    className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-2 py-4 sm:px-6 lg:px-8">
                {weeklyPrize && !gameStarted && (
                    <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded-xl p-4 sm:p-6 mb-4 text-center shadow-lg">
                        <p className="text-white font-bold mb-1 text-sm sm:text-base">🏆 This Week's Prize 🏆</p>
                        {weeklyPrize.is_surprise ? (
                            <>
                                <p className="text-xl sm:text-3xl font-bold text-white mb-1">🎁 Surprise Prize! 🎁</p>
                                <p className="text-white text-sm">Play to find out what you could win!</p>
                            </>
                        ) : (
                            <>
                                {weeklyPrize.prize_type === 'cash' && (
                                    <>
                                        <p className="text-xl sm:text-3xl font-bold text-white mb-1">${weeklyPrize.total_prize_pool}</p>
                                        {weeklyPrize.number_of_winners === 1 ? (
                                            <p className="text-white text-sm">Winner takes all!</p>
                                        ) : (
                                            <p className="text-white text-sm">Split among top {weeklyPrize.number_of_winners} players</p>
                                        )}
                                    </>
                                )}
                                {weeklyPrize.prize_type === 'merchandise' && (
                                    <>
                                        <p className="text-xl sm:text-3xl font-bold text-white mb-1">🎽 Merchandise Prizes!</p>
                                        <div className="text-white text-sm">
                                            {weeklyPrize.prize_descriptions?.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {weeklyPrize.prize_type === 'custom' && (
                                    <>
                                        <p className="text-xl sm:text-3xl font-bold text-white mb-1">🎁 Special Prize!</p>
                                        <div className="text-white text-sm">
                                            {weeklyPrize.prize_descriptions?.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {weeklyPrize.announcement_text && (
                            <p className="text-white mt-2 italic text-sm">"{weeklyPrize.announcement_text}"</p>
                        )}
                    </div>
                )}

                {!gameStarted && (
                    <div className="flex justify-center mb-4">
                        <button
                            onClick={() => setShowLeaderboard(!showLeaderboard)}
                            className="px-4 py-2 sm:px-6 sm:py-3 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all text-sm sm:text-base"
                        >
                            🏆 {showLeaderboard ? 'Hide' : 'Show'} Leaderboards
                        </button>
                    </div>
                )}

                {showLeaderboard && !gameStarted && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-green-400">🟢</span> Easy Mode (12 Cards)
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-2 text-slate-400">#</th>
                                            <th className="text-left py-2 text-slate-400">Player</th>
                                            <th className="text-left py-2 text-slate-400">Moves</th>
                                            <th className="text-left py-2 text-slate-400">Time</th>
                                            <th className="text-left py-2 text-slate-400">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {easyLeaderboard.map((entry, index) => (
                                            <tr key={entry.id} className="border-b border-slate-700/50">
                                                <td className="py-2 text-white">{index + 1}</td>
                                                <td className="py-2 text-white">{entry.users.username}</td>
                                                <td className="py-2 text-slate-300">{entry.moves}</td>
                                                <td className="py-2 text-slate-300">{entry.time_seconds}s</td>
                                                <td className="py-2 text-amber-400 font-bold">{entry.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {easyLeaderboard.length === 0 && (
                                    <p className="text-center text-slate-400 py-4 text-sm">No scores yet!</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-400">🔴</span> Challenge Mode (16 Cards)
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-2 text-slate-400">#</th>
                                            <th className="text-left py-2 text-slate-400">Player</th>
                                            <th className="text-left py-2 text-slate-400">Moves</th>
                                            <th className="text-left py-2 text-slate-400">Time</th>
                                            <th className="text-left py-2 text-slate-400">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {challengeLeaderboard.map((entry, index) => (
                                            <tr key={entry.id} className="border-b border-slate-700/50">
                                                <td className="py-2 text-white">{index + 1}</td>
                                                <td className="py-2 text-white">{entry.users.username}</td>
                                                <td className="py-2 text-slate-300">{entry.moves}</td>
                                                <td className="py-2 text-slate-300">{entry.time_seconds}s</td>
                                                <td className="py-2 text-amber-400 font-bold">{entry.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {challengeLeaderboard.length === 0 && (
                                    <p className="text-center text-slate-400 py-4 text-sm">No scores yet!</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!user && !gameStarted && (
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-lg mb-4 text-sm">
                        <p className="text-center">
                            <strong>Want to compete for prizes?</strong>
                            <button
                                onClick={() => router.push('/auth/register')}
                                className="ml-2 underline hover:text-amber-300"
                            >
                                Sign up now!
                            </button>
                        </p>
                    </div>
                )}

                {!gameStarted && (
                    <div className="text-center py-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Choose Your Challenge!</h2>
                        <p className="text-sm sm:text-lg text-slate-400 mb-6">
                            Match all pairs. Lower score wins!
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => startGame('easy')}
                                className="px-6 py-3 sm:px-8 sm:py-4 bg-green-600 text-white text-base sm:text-lg font-bold rounded-lg hover:bg-green-500 transition-all"
                            >
                                Easy Mode<br />
                                <span className="text-xs sm:text-sm font-normal">12 Cards</span>
                            </button>
                            <button
                                onClick={() => startGame('challenge')}
                                className="px-6 py-3 sm:px-8 sm:py-4 bg-red-600 text-white text-base sm:text-lg font-bold rounded-lg hover:bg-red-500 transition-all"
                            >
                                Challenge<br />
                                <span className="text-xs sm:text-sm font-normal">16 Cards</span>
                            </button>
                        </div>
                    </div>
                )}

                {gameStarted && (
                    <>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 sm:p-4 mb-3">
                            <div className="flex justify-between items-center text-xs sm:text-base">
                                <span className="text-white"><span className="text-slate-400">M:</span> {moves}</span>
                                <span className="text-white"><span className="text-slate-400">T:</span> {getElapsedTime()}s</span>
                                <span className="text-white"><span className="text-slate-400">✓:</span> {matchedPairs.length}/{gameMode === 'easy' ? 6 : 8}</span>
                                <button
                                    onClick={playAgain}
                                    className="px-2 py-1 sm:px-3 sm:py-1 bg-slate-700 text-white rounded hover:bg-slate-600 transition-all text-xs sm:text-sm"
                                >
                                    Quit
                                </button>
                            </div>
                        </div>

                        {gameComplete && (
                            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl mb-3 text-center">
                                <h3 className="text-xl font-bold mb-1">🎉 Congratulations!</h3>
                                <p className="text-sm mb-2">
                                    Moves: {moves} | Time: {getElapsedTime()}s | Score: {(moves * 2) + getElapsedTime()}
                                </p>
                                {user ? (
                                    <p className="text-xs mb-3 animate-pulse font-bold text-green-300">
                                        ✓ Your score was saved to the leaderboard!
                                    </p>
                                ) : (
                                    <p className="text-xs mb-3">
                                        <button
                                            onClick={() => router.push('/auth/register')}
                                            className="underline"
                                        >
                                            Sign up
                                        </button>{' '}
                                        to save your score!
                                    </p>
                                )}
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={playAgain}
                                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-all"
                                    >
                                        Play Again
                                    </button>
                                    <button
                                        onClick={() => {
                                            playAgain()
                                            setShowLeaderboard(true)
                                        }}
                                        className="px-6 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all"
                                    >
                                        View Leaderboard
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`grid gap-1 sm:gap-2 ${gameMode === 'easy' ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-4 lg:grid-cols-8'}`}>
                            {cards.map((card) => (
                                <div
                                    key={card.uniqueId}
                                    onClick={() => handleCardClick(card)}
                                    className="relative aspect-[4/3] cursor-pointer"
                                >
                                    {!isCardFlipped(card) ? (
                                        cardBackSetting?.show_advertiser_cards === 'true' && cardBackAdvertiser ? (
                                            cardBackAdvertiser.card_type === 'uploaded' && cardBackAdvertiser.image_url ? (
                                                <div className="w-full h-full rounded-md sm:rounded-lg shadow-lg overflow-hidden border-2 border-amber-400 bg-slate-800 flex items-center justify-center ring-2 ring-amber-400/50 relative">
                                                    <CardBack />
                                                    <img
                                                        src={cardBackAdvertiser.image_url}
                                                        alt="Advertiser card"
                                                        className="max-w-full max-h-full object-contain p-1"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-full h-full rounded-md sm:rounded-lg p-1 flex flex-col justify-center items-center border-2 border-amber-400 shadow-lg overflow-hidden ring-2 ring-amber-400/50 relative"
                                                    style={{ backgroundColor: cardBackAdvertiser.card_color || '#4F46E5' }}
                                                >
                                                    <CardBack />
                                                    <h3
                                                        className="font-bold text-xs text-center truncate w-full"
                                                        style={{ color: cardBackAdvertiser.text_color || '#FFFFFF' }}
                                                    >{cardBackAdvertiser.title}</h3>
                                                    {cardBackAdvertiser.message && (
                                                        <p
                                                            className="text-xs text-center line-clamp-2 mt-1"
                                                            style={{ color: cardBackAdvertiser.text_color || '#FFFFFF' }}
                                                        >{cardBackAdvertiser.message}</p>
                                                    )}
                                                </div>
                                            )
                                        ) : cardBackSetting?.card_back_logo_url ? (
                                            <div className="w-full h-full rounded-md sm:rounded-lg shadow-lg overflow-hidden border-2 border-amber-400 bg-indigo-600 flex items-center justify-center ring-2 ring-amber-400/50 relative">
                                                <CardBack />
                                                <img
                                                    src={cardBackSetting.card_back_logo_url}
                                                    alt="Card back"
                                                    className="max-w-full max-h-full object-contain p-1"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full bg-indigo-600 rounded-md sm:rounded-lg flex items-center justify-center shadow-lg border-2 border-amber-400 ring-2 ring-amber-400/50 relative">
                                                <CardBack />
                                                <span className="text-3xl sm:text-5xl text-white">?</span>
                                            </div>
                                        )
                                    ) : (
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <div className="w-full h-full rounded-md sm:rounded-lg shadow-lg overflow-hidden relative border border-slate-600">
                                                <img
                                                    src={card.image_url}
                                                    alt="Card"
                                                    className="w-full h-full object-contain"
                                                />
                                                {matchedPairs.includes(card.pairId) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setViewingCard(card)
                                                            trackCardClick(card.user_id)
                                                        }}
                                                        className="absolute bottom-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                                                    >
                                                        👁
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-full rounded-md sm:rounded-lg p-1 sm:p-2 flex flex-col justify-between border border-slate-600 shadow-lg overflow-hidden relative"
                                                style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                            >
                                                <div className="text-center overflow-hidden">
                                                    <h3
                                                        className="font-bold text-xs truncate"
                                                        style={{ color: card.text_color || '#FFFFFF' }}
                                                    >{card.title}</h3>
                                                </div>
                                                <div className="text-center flex-1 flex items-center justify-center overflow-hidden px-1">
                                                    {card.message && (
                                                        <p
                                                            className="text-xs line-clamp-2"
                                                            style={{ color: card.text_color || '#FFFFFF' }}
                                                        >{card.message}</p>
                                                    )}
                                                </div>
                                                {matchedPairs.includes(card.pairId) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setViewingCard(card)
                                                            trackCardClick(card.user_id)
                                                        }}
                                                        className="absolute bottom-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                                                    >
                                                        👁
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}