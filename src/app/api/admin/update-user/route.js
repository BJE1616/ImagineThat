import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const { action, userId, data } = await request.json()

        if (!userId) {
            return Response.json({ error: 'User ID is required' }, { status: 400 })
        }

        switch (action) {
            case 'reset-password': {
                if (!data.password || data.password.length < 6) {
                    return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
                }

                const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    password: data.password
                })

                if (error) {
                    return Response.json({ error: error.message }, { status: 400 })
                }

                return Response.json({ success: true, message: 'Password updated' })
            }

            case 'update-email': {
                if (!data.email) {
                    return Response.json({ error: 'Email is required' }, { status: 400 })
                }

                const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    email: data.email,
                    email_confirm: true
                })

                if (authError) {
                    return Response.json({ error: authError.message }, { status: 400 })
                }

                const { error: dbError } = await supabaseAdmin
                    .from('users')
                    .update({ email: data.email })
                    .eq('id', userId)

                if (dbError) {
                    return Response.json({ error: dbError.message }, { status: 400 })
                }

                return Response.json({ success: true, message: 'Email updated' })
            }

            case 'update-details': {
                const { error } = await supabaseAdmin
                    .from('users')
                    .update({
                        first_name: data.firstName || null,
                        last_name: data.lastName || null,
                        phone: data.phone || ''
                    })
                    .eq('id', userId)

                if (error) {
                    return Response.json({ error: error.message }, { status: 400 })
                }

                return Response.json({ success: true, message: 'Details updated' })
            }

            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 })
        }

    } catch (error) {
        console.error('Update user error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}