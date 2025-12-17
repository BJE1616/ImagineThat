import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const { email, password, username, firstName, lastName, phone, isAdmin, emailVerified } = await request.json()

        if (!email || !password || !username) {
            return Response.json({ error: 'Email, password, and username are required' }, { status: 400 })
        }

        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('username')
            .ilike('username', username)
            .single()

        if (existingUser) {
            return Response.json({ error: 'Username already taken' }, { status: 400 })
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: emailVerified
        })

        if (authError) {
            return Response.json({ error: authError.message }, { status: 400 })
        }

        const { error: userError } = await supabaseAdmin
            .from('users')
            .insert([{
                id: authData.user.id,
                email,
                username,
                first_name: firstName || null,
                last_name: lastName || null,
                phone: phone || '',
                referral_id: username.toUpperCase(),
                simple_referral_count: 0,
                is_admin: isAdmin || false
            }])

        if (userError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            return Response.json({ error: userError.message }, { status: 400 })
        }

        return Response.json({
            success: true,
            user: {
                id: authData.user.id,
                email,
                username
            }
        })

    } catch (error) {
        console.error('Create user error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}