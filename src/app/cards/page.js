'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import imageCompression from 'browser-image-compression'
import Cropper from 'react-easy-crop'

function CardsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get('returnTo')
    const editCardId = searchParams.get('editCard')
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingCardId, setEditingCardId] = useState(null)
    const [cardType, setCardType] = useState('template')
    const [formData, setFormData] = useState({
        full_business_name: '',
        business_category: '',
        business_subcategory: [],
        custom_category: '',
        custom_subcategory: '',
        tagline: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
        email: '',
        website_url: '',
        display_name: '',
        short_tagline: '',
        card_color: '#4F46E5',
        text_color: '#FFFFFF'
    })
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [imageRotation, setImageRotation] = useState(0)
    const [uploading, setUploading] = useState(false)
    const [processingImage, setProcessingImage] = useState(false)
    const [hasActiveCampaign, setHasActiveCampaign] = useState(false)
    const [userData, setUserData] = useState(null)
    const [cardsInUse, setCardsInUse] = useState([])

    // Cropper states
    const [showCropper, setShowCropper] = useState(false)
    const [cropImage, setCropImage] = useState(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [cropRotation, setCropRotation] = useState(0)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

    const colorOptions = [
        { name: 'Indigo', value: '#4F46E5' },
        { name: 'Blue', value: '#2563EB' },
        { name: 'Green', value: '#16A34A' },
        { name: 'Red', value: '#DC2626' },
        { name: 'Purple', value: '#9333EA' },
        { name: 'Orange', value: '#EA580C' },
        { name: 'Teal', value: '#0D9488' },
        { name: 'Pink', value: '#DB2777' },
        { name: 'Slate', value: '#475569' },
        { name: 'Black', value: '#1F2937' },
    ]

    const textColorOptions = [
        { name: 'White', value: '#FFFFFF' },
        { name: 'Black', value: '#1F2937' },
        { name: 'Yellow', value: '#FDE047' },
        { name: 'Light Gray', value: '#E5E7EB' },
    ]

    const US_STATES = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ]

    const CATEGORIES = [
        {
            value: 'Home Services',
            label: 'Home Services (Plumbing, HVAC, Cleaning, etc.)',
            subcategories: ['Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Landscaping', 'Lawn Care', 'Tree Trimming', 'Pest Control', 'Other']
        },
        {
            value: 'Handyman',
            label: 'Handyman (Repairs, Painting, Pressure Washing, etc.)',
            subcategories: ['General Repairs', 'Furniture Assembly', 'Drywall / Patching', 'Painting', 'Mounting & Installation', 'Pressure Washing', 'Gutter Cleaning', 'Other']
        },
        {
            value: 'Restaurant / Food',
            label: 'Restaurant / Food (Restaurants, Cafes, Catering, etc.)',
            subcategories: ['Restaurants', 'Cafes', 'Bakeries', 'Catering', 'Food Trucks', 'Other']
        },
        {
            value: 'Retail / Shopping',
            label: 'Retail / Shopping (Clothing, Furniture, Gift Shops, etc.)',
            subcategories: ['Clothing', 'Furniture', 'Gift Shops', 'Hardware Stores', 'Other']
        },
        {
            value: 'Professional Services',
            label: 'Professional Services (Accounting, Consulting, Marketing, etc.)',
            subcategories: ['Accounting', 'Consulting', 'Marketing', 'IT Support', 'Photography', 'Other']
        },
        {
            value: 'Health & Wellness',
            label: 'Health & Wellness (Doctors, Dentists, Therapy, etc.)',
            subcategories: ['Doctors', 'Dentists', 'Chiropractors', 'Therapy', 'Massage', 'Other']
        },
        {
            value: 'Automotive',
            label: 'Automotive (Mechanics, Detailing, Towing, etc.)',
            subcategories: ['Mechanics', 'Car Dealers', 'Detailing', 'Towing', 'Oil Change', 'Other']
        },
        {
            value: 'Real Estate',
            label: 'Real Estate (Realtors, Mortgage, Home Inspection, etc.)',
            subcategories: ['Realtors', 'Property Management', 'Mortgage', 'Home Inspection', 'Other']
        },
        {
            value: 'Entertainment',
            label: 'Entertainment (Event Venues, DJs, Musicians, etc.)',
            subcategories: ['Event Venues', 'DJs', 'Musicians', 'Party Rentals', 'Other']
        },
        {
            value: 'Beauty / Salon',
            label: 'Beauty / Salon (Hair Salons, Barbers, Spas, etc.)',
            subcategories: ['Hair Salons', 'Barbers', 'Nail Salons', 'Spas', 'Makeup Artists', 'Other']
        },
        {
            value: 'Fitness',
            label: 'Fitness (Gyms, Personal Trainers, Yoga, etc.)',
            subcategories: ['Gyms', 'Personal Trainers', 'Yoga Studios', 'Sports Coaching', 'Other']
        },
        {
            value: 'Legal',
            label: 'Legal (Lawyers, Notary, Mediation, etc.)',
            subcategories: ['Lawyers', 'Notary', 'Mediation', 'Other']
        },
        {
            value: 'Financial',
            label: 'Financial (Banks, Insurance, Financial Advisors, etc.)',
            subcategories: ['Banks', 'Insurance', 'Financial Advisors', 'Tax Prep', 'Other']
        },
        {
            value: 'Technology',
            label: 'Technology (Software, Web Design, Computer Repair, etc.)',
            subcategories: ['Software', 'Web Design', 'Computer Repair', 'App Development', 'Other']
        },
        {
            value: 'Education',
            label: 'Education (Tutoring, Schools, Music Lessons, etc.)',
            subcategories: ['Tutoring', 'Schools', 'Training Centers', 'Music Lessons', 'Other']
        },
        {
            value: 'Pet Services',
            label: 'Pet Services (Veterinarians, Groomers, Pet Sitting, etc.)',
            subcategories: ['Veterinarians', 'Groomers', 'Pet Sitting', 'Dog Training', 'Other']
        },
        {
            value: 'Other',
            label: 'Other (Not listed above - enter your own)',
            subcategories: []
        },
        {
            value: 'Prefer Not to List',
            label: 'Prefer Not to List',
            subcategories: []
        }
    ]

    useEffect(() => {
        checkUser()
    }, [])

    // Auto-open edit if editCard param is present
    useEffect(() => {
        if (editCardId && cards.length > 0 && !showForm) {
            const cardToEdit = cards.find(c => c.id === editCardId)
            if (cardToEdit) {
                handleEdit(cardToEdit)
            }
        }
    }, [editCardId, cards])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/auth/login')
                return
            }

            setUser(authUser)

            const { data: userDataResult } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            setUserData(userDataResult)

            await loadCards(authUser.id)

            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select('id, business_card_id')
                .eq('user_id', authUser.id)
                .in('status', ['active', 'queued'])

            setHasActiveCampaign(campaignData && campaignData.length > 0)

            if (campaignData && campaignData.length > 0) {
                const inUseIds = campaignData
                    .filter(c => c.business_card_id)
                    .map(c => c.business_card_id)
                setCardsInUse(inUseIds)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadCards = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCards(data || [])
        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        let updates = { [name]: value }

        // Auto-fill display_name when full_business_name changes
        if (name === 'full_business_name') {
            updates.display_name = value.slice(0, 20)
        }

        // Auto-fill short_tagline when tagline changes
        if (name === 'tagline') {
            updates.short_tagline = value.slice(0, 20)
        }

        setFormData({
            ...formData,
            ...updates
        })
    }

    const handleCategoryChange = (e) => {
        const newCategory = e.target.value
        setFormData({
            ...formData,
            business_category: newCategory,
            business_subcategory: [],
            custom_category: '',
            custom_subcategory: ''
        })
    }

    const handleSubcategoryChange = (subcategory) => {
        const current = formData.business_subcategory || []

        if (current.includes(subcategory)) {
            setFormData({
                ...formData,
                business_subcategory: current.filter(s => s !== subcategory),
                custom_subcategory: subcategory === 'Other' ? '' : formData.custom_subcategory
            })
        } else {
            if (current.length >= 3) {
                alert('You can select up to 3 subcategories maximum.')
                return
            }
            setFormData({
                ...formData,
                business_subcategory: [...current, subcategory]
            })
        }
    }

    const formatPhone = (value) => {
        const digits = value.replace(/\D/g, '')

        if (digits.length <= 3) {
            return digits.length ? `(${digits}` : ''
        } else if (digits.length <= 6) {
            return `(${digits.slice(0, 3)})-${digits.slice(3)}`
        } else {
            return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
        }
    }

    const handlePhoneChange = (e) => {
        const formatted = formatPhone(e.target.value)
        setFormData({
            ...formData,
            phone: formatted
        })
    }

    const handleUrlChange = (e) => {
        let value = e.target.value.trim()
        setFormData({
            ...formData,
            website_url: value
        })
    }

    const handleUrlBlur = (e) => {
        let value = e.target.value.trim()

        if (!value) return

        if (value.includes('@') && !value.includes('://')) {
            alert('That looks like an email address. Please enter a website URL instead.')
            setFormData({
                ...formData,
                website_url: ''
            })
            return
        }

        if (!value.match(/^https?:\/\//i)) {
            if (value.match(/^[a-zA-Z0-9]/) && value.includes('.')) {
                value = 'https://' + value
                setFormData({
                    ...formData,
                    website_url: value
                })
            }
        }
    }

    const handleImageChange = async (e) => {
        const file = e.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setCropImage(reader.result)
                setShowCropper(true)
                setCrop({ x: 0, y: 0 })
                setZoom(1)
                setCropRotation(0)
            }
            reader.readAsDataURL(file)
        }
    }

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const createImage = (url) =>
        new Promise((resolve, reject) => {
            const image = new Image()
            image.addEventListener('load', () => resolve(image))
            image.addEventListener('error', (error) => reject(error))
            image.src = url
        })

    const getRadianAngle = (degreeValue) => {
        return (degreeValue * Math.PI) / 180
    }

    const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
        const image = await createImage(imageSrc)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const rotRad = getRadianAngle(rotation)

        const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
            image.width,
            image.height,
            rotation
        )

        canvas.width = bBoxWidth
        canvas.height = bBoxHeight

        ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
        ctx.rotate(rotRad)
        ctx.translate(-image.width / 2, -image.height / 2)

        ctx.drawImage(image, 0, 0)

        const croppedCanvas = document.createElement('canvas')
        const croppedCtx = croppedCanvas.getContext('2d')

        croppedCanvas.width = pixelCrop.width
        croppedCanvas.height = pixelCrop.height

        croppedCtx.drawImage(
            canvas,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        )

        return new Promise((resolve) => {
            croppedCanvas.toBlob((blob) => {
                resolve(blob)
            }, 'image/jpeg', 0.95)
        })
    }

    const rotateSize = (width, height, rotation) => {
        const rotRad = getRadianAngle(rotation)
        return {
            width:
                Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
            height:
                Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
        }
    }

    const handleCropConfirm = async () => {
        setProcessingImage(true)
        setShowCropper(false)

        try {
            const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels, cropRotation)

            let croppedFile = new File([croppedBlob], 'business-card.jpg', { type: 'image/jpeg' })

            if (croppedFile.size > 800 * 1024) {
                const options = {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1200,
                    useWebWorker: true
                }
                croppedFile = await imageCompression(croppedFile, options)
            }

            setImageFile(croppedFile)
            setImageRotation(0)

            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result)
            }
            reader.readAsDataURL(croppedFile)
        } catch (error) {
            console.error('Error processing image:', error)
            alert('Error processing image. Please try again.')
        } finally {
            setProcessingImage(false)
            setCropImage(null)
        }
    }

    const handleCropCancel = () => {
        setShowCropper(false)
        setCropImage(null)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCropRotation(0)
    }

    const rotateImage = (direction) => {
        setImageRotation(prev => {
            if (direction === 'left') {
                return prev === 0 ? 270 : prev - 90
            } else {
                return prev === 270 ? 0 : prev + 90
            }
        })
    }

    const uploadImage = async () => {
        if (!imageFile) return null

        const fileExt = 'jpg'
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('business-card-images')
            .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from('business-card-images')
            .getPublicUrl(filePath)

        return data.publicUrl
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setUploading(true)

        try {
            if (!formData.business_category) {
                alert('Please select a Business Category')
                setUploading(false)
                return
            }

            if (!formData.display_name) {
                alert('Please enter a Display Name for in-game use')
                setUploading(false)
                return
            }

            let imageUrl = ''

            if (cardType === 'uploaded') {
                if (imageFile) {
                    // New image uploaded
                    imageUrl = await uploadImage()
                } else if (editingCardId && imagePreview) {
                    // Editing and keeping existing image
                    imageUrl = imagePreview
                } else {
                    alert('Please select an image to upload')
                    setUploading(false)
                    return
                }
            }

            const finalCategory = formData.business_category === 'Other'
                ? formData.custom_category
                : formData.business_category

            let finalSubcategory = [...(formData.business_subcategory || [])]
            if (finalSubcategory.includes('Other') && formData.custom_subcategory) {
                finalSubcategory = finalSubcategory.map(s =>
                    s === 'Other' ? formData.custom_subcategory : s
                )
            }

            const cardData = {
                card_type: cardType,
                display_name: formData.display_name,
                full_business_name: formData.full_business_name || formData.display_name,
                title: formData.display_name,
                business_name: formData.full_business_name || formData.display_name,
                tagline: formData.tagline || '',
                short_tagline: formData.short_tagline || '',
                message: formData.tagline || '',
                phone: formData.phone || '',
                email: formData.email || '',
                website_url: formData.website_url || '',
                address: formData.address || '',
                city: formData.city || '',
                state: formData.state || '',
                zip: formData.zip || '',
                card_color: formData.card_color,
                text_color: formData.text_color,
                image_url: imageUrl || '',
                image_rotation: cardType === 'uploaded' ? imageRotation : 0,
                business_category: finalCategory || '',
                business_subcategory: finalSubcategory.length > 0 ? finalSubcategory : null
            }

            if (editingCardId) {
                // Update existing card
                const { error } = await supabase
                    .from('business_cards')
                    .update(cardData)
                    .eq('id', editingCardId)

                if (error) throw error

                if (returnTo === 'campaign') {
                    router.push('/advertise/start')
                    return
                }

                alert('Business card updated successfully!')
            } else {
                // Create new card
                const { error } = await supabase
                    .from('business_cards')
                    .insert([{
                        user_id: user.id,
                        ...cardData
                    }])

                if (error) throw error

                if (returnTo === 'campaign') {
                    router.push('/advertise/start')
                    return
                } else if (!hasActiveCampaign) {
                    if (confirm('Business card created! Ready to start advertising?')) {
                        router.push('/advertise/start')
                        return
                    }
                } else {
                    alert('Business card created successfully!')
                }
            }

            resetForm()
            await loadCards(user.id)
        } catch (error) {
            alert('Error saving card: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const resetForm = () => {
        setShowForm(false)
        setEditingCardId(null)
        setCardType('template')
        setFormData({
            full_business_name: '',
            business_category: '',
            business_subcategory: [],
            custom_category: '',
            custom_subcategory: '',
            tagline: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            phone: '',
            email: '',
            website_url: '',
            display_name: '',
            short_tagline: '',
            card_color: '#4F46E5',
            text_color: '#FFFFFF'
        })
        setImageFile(null)
        setImagePreview(null)
        setImageRotation(0)
        setCropImage(null)
        setShowCropper(false)
        setCropRotation(0)
    }

    const isCardInUse = (cardId) => {
        return cardsInUse.includes(cardId)
    }

    const handleDelete = async (cardId) => {
        if (isCardInUse(cardId)) {
            alert('This card is being used by an active or queued campaign. You can delete it after the campaign completes.')
            return
        }

        if (!confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('business_cards')
                .delete()
                .eq('id', cardId)

            if (error) throw error

            alert('Card deleted successfully!')
            await loadCards(user.id)
        } catch (error) {
            alert('Error deleting card: ' + error.message)
        }
    }

    const handleEdit = (card) => {
        setEditingCardId(card.id)
        setCardType(card.card_type || 'template')
        setFormData({
            full_business_name: card.full_business_name || card.business_name || '',
            business_category: card.business_category || '',
            business_subcategory: card.business_subcategory || [],
            custom_category: '',
            custom_subcategory: '',
            tagline: card.tagline || card.message || '',
            address: card.address || '',
            city: card.city || '',
            state: card.state || '',
            zip: card.zip || '',
            phone: card.phone || '',
            email: card.email || '',
            website_url: card.website_url || '',
            display_name: card.display_name || card.title || '',
            short_tagline: card.short_tagline || '',
            card_color: card.card_color || '#4F46E5',
            text_color: card.text_color || '#FFFFFF'
        })
        if (card.image_url) {
            setImagePreview(card.image_url)
            setImageRotation(card.image_rotation || 0)
        }
        setShowForm(true)
    }

    const getDynamicFontSize = (text, maxSize, minSize, maxLength) => {
        if (!text) return maxSize
        const length = text.length
        if (length <= maxLength * 0.5) return maxSize
        if (length >= maxLength) return minSize
        const ratio = (length - maxLength * 0.5) / (maxLength * 0.5)
        return maxSize - (ratio * (maxSize - minSize))
    }

    const getSelectedCategoryData = () => {
        return CATEGORIES.find(c => c.value === formData.business_category)
    }

    const maxCards = (userData?.is_admin || userData?.is_super_admin) ? 25 : 5

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

    // Full Card Preview Component
    const FullCardPreview = () => {
        const displayName = formData.full_business_name || formData.display_name || 'Business Name'
        const hasContactInfo = formData.phone || formData.email || formData.website_url
        const hasAddress = formData.address || formData.city || formData.state || formData.zip

        // Build address line
        let addressLine = ''
        if (formData.address) addressLine = formData.address
        let cityStateZip = ''
        if (formData.city) cityStateZip = formData.city
        if (formData.state) cityStateZip += (cityStateZip ? ', ' : '') + formData.state
        if (formData.zip) cityStateZip += (cityStateZip ? ' ' : '') + formData.zip

        return (
            <div>
                <p className="text-xs text-slate-400 mb-2 text-center">Full Card Preview:</p>
                {cardType === 'uploaded' && imagePreview ? (
                    <div className="w-full max-w-xs mx-auto aspect-[7/4] rounded-lg border-2 border-slate-600 overflow-hidden bg-slate-800">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-contain"
                            style={{ transform: `rotate(${imageRotation}deg)` }}
                        />
                    </div>
                ) : (
                    <div
                        className="w-full max-w-xs mx-auto aspect-[7/4] rounded-lg p-3 flex flex-col justify-between border-2 border-slate-600"
                        style={{ backgroundColor: formData.card_color }}
                    >
                        <div className="text-center">
                            <h3
                                className="font-bold"
                                style={{
                                    color: formData.text_color,
                                    fontSize: `${getDynamicFontSize(displayName, 16, 11, 50)}px`
                                }}
                            >
                                {displayName}
                            </h3>
                        </div>

                        {formData.tagline && (
                            <div className="text-center flex-1 flex items-center justify-center">
                                <p
                                    className="opacity-90"
                                    style={{
                                        color: formData.text_color,
                                        fontSize: `${getDynamicFontSize(formData.tagline, 12, 9, 100)}px`
                                    }}
                                >
                                    {formData.tagline}
                                </p>
                            </div>
                        )}

                        <div className="text-center space-y-0.5">
                            {hasAddress && (
                                <>
                                    {addressLine && (
                                        <p className="text-[10px]" style={{ color: formData.text_color, opacity: 0.85 }}>
                                            {addressLine}
                                        </p>
                                    )}
                                    {cityStateZip && (
                                        <p className="text-[10px]" style={{ color: formData.text_color, opacity: 0.85 }}>
                                            {cityStateZip}
                                        </p>
                                    )}
                                </>
                            )}
                            {formData.phone && (
                                <p className="text-[10px]" style={{ color: formData.text_color, opacity: 0.85 }}>
                                    {formData.phone}
                                </p>
                            )}
                            {formData.email && (
                                <p className="text-[10px]" style={{ color: formData.text_color, opacity: 0.85 }}>
                                    {formData.email}
                                </p>
                            )}
                            {formData.website_url && (
                                <p className="text-[10px]" style={{ color: formData.text_color, opacity: 0.85 }}>
                                    {formData.website_url}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // In-Game Preview Component
    const InGamePreview = () => (
        <div>
            <p className="text-xs text-slate-400 mb-2 text-center">In-Game Preview:</p>
            <div
                className="w-28 h-20 rounded-lg flex flex-col items-center justify-center border border-slate-600 mx-auto"
                style={{ backgroundColor: formData.card_color }}
            >
                <p
                    className="font-bold text-center px-1"
                    style={{
                        color: formData.text_color,
                        fontSize: `${getDynamicFontSize(formData.display_name, 12, 8, 20)}px`
                    }}
                >
                    {formData.display_name || 'Display Name'}
                </p>
                {formData.short_tagline && (
                    <p
                        className="text-center px-1 mt-0.5"
                        style={{
                            color: formData.text_color,
                            fontSize: `${getDynamicFontSize(formData.short_tagline, 9, 7, 20)}px`,
                            opacity: 0.85
                        }}
                    >
                        {formData.short_tagline}
                    </p>
                )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-center">Players see this + 👁 icon</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Crop Modal */}
            {showCropper && (
                <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
                    <div className="flex-1 relative">
                        <Cropper
                            image={cropImage}
                            crop={crop}
                            zoom={zoom}
                            rotation={cropRotation}
                            aspect={7 / 4}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            onRotationChange={setCropRotation}
                        />
                    </div>
                    <div className="bg-slate-800 p-4 space-y-3">
                        <div className="flex items-center gap-4">
                            <span className="text-white text-sm w-20">Zoom:</span>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="flex-1"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-white text-sm w-20">Straighten:</span>
                            <input
                                type="range"
                                min={-45}
                                max={45}
                                step={1}
                                value={cropRotation}
                                onChange={(e) => setCropRotation(Number(e.target.value))}
                                className="flex-1"
                            />
                            <span className="text-slate-400 text-xs w-12 text-right">{cropRotation}°</span>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={handleCropCancel}
                                className="flex-1 py-3 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-500 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCropConfirm}
                                className="flex-1 py-3 bg-amber-500 text-slate-900 rounded-lg font-bold hover:bg-amber-400 transition-colors"
                            >
                                Crop & Use
                            </button>
                        </div>
                        <p className="text-slate-400 text-xs text-center">
                            Drag to position • Pinch or slide to zoom • Straighten tilted photos
                        </p>
                    </div>
                </div>
            )}

            <main className="max-w-lg mx-auto px-4 py-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">My Business Cards</h1>
                        <p className="text-slate-400 text-xs mt-1">{cards.length}/{maxCards} cards</p>
                    </div>
                    {!showForm && cards.length < maxCards && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all text-sm"
                        >
                            + New Card
                        </button>
                    )}
                </div>

                {showForm && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white">{editingCardId ? 'Edit Card' : 'Create New Card'}</h2>
                            <button
                                onClick={resetForm}
                                className="text-slate-400 hover:text-white text-sm"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        {/* Card Type Toggle */}
                        <div className="flex gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setCardType('template')}
                                className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${cardType === 'template'
                                    ? 'bg-amber-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                            >
                                Create Card
                            </button>
                            <button
                                type="button"
                                onClick={() => setCardType('uploaded')}
                                className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${cardType === 'uploaded'
                                    ? 'bg-amber-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                            >
                                Upload Image
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">

                            {/* ===== BUSINESS CARD INFORMATION ===== */}
                            <div className="pt-2 pb-1 border-b border-slate-600">
                                <p className="text-amber-500 font-semibold text-sm">📋 Business Card Information</p>
                            </div>

                            {/* Full Business Name */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Full Business Name * <span className="text-slate-500">(50 chars)</span>
                                </label>
                                <input
                                    type="text"
                                    name="full_business_name"
                                    required
                                    maxLength={50}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="Your complete business name"
                                    value={formData.full_business_name || ''}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Business Category */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Business Category *
                                </label>
                                <select
                                    name="business_category"
                                    required
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    value={formData.business_category || ''}
                                    onChange={handleCategoryChange}
                                >
                                    <option value="">Select Category *</option>
                                    {CATEGORIES.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom Category Input */}
                            {formData.business_category === 'Other' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Enter Your Category *
                                    </label>
                                    <input
                                        type="text"
                                        name="custom_category"
                                        required
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        placeholder="e.g. Mobile Car Wash"
                                        value={formData.custom_category || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            {/* Subcategory Checkboxes */}
                            {formData.business_category &&
                                formData.business_category !== 'Other' &&
                                formData.business_category !== 'Prefer Not to List' &&
                                getSelectedCategoryData()?.subcategories?.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-2">
                                            Services / Subcategories <span className="text-slate-500">(up to 3)</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {getSelectedCategoryData().subcategories.map(sub => (
                                                <label
                                                    key={sub}
                                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all text-xs ${formData.business_subcategory?.includes(sub)
                                                        ? 'bg-amber-500/20 border border-amber-500'
                                                        : 'bg-slate-700 border border-slate-600 hover:border-slate-500'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.business_subcategory?.includes(sub) || false}
                                                        onChange={() => handleSubcategoryChange(sub)}
                                                        className="w-3 h-3 accent-amber-500"
                                                    />
                                                    <span className="text-white">{sub}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {formData.business_subcategory?.length || 0}/3 selected
                                        </p>
                                    </div>
                                )}

                            {/* Custom Subcategory Input */}
                            {formData.business_subcategory?.includes('Other') && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Enter Your Service/Subcategory
                                    </label>
                                    <input
                                        type="text"
                                        name="custom_subcategory"
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        placeholder="e.g. Window Cleaning"
                                        value={formData.custom_subcategory || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            {/* Tagline - only for template cards */}
                            {cardType === 'template' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Tagline <span className="text-slate-500">(100 chars)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="tagline"
                                        maxLength={100}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        placeholder="Your catchy tagline"
                                        value={formData.tagline || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            {/* Upload Image - only for uploaded cards */}
                            {cardType === 'uploaded' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Upload Business Card Image *
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        disabled={processingImage}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm disabled:opacity-50"
                                    />
                                    {processingImage ? (
                                        <p className="text-xs text-amber-500 mt-1 flex items-center gap-2">
                                            <span className="inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                                            Processing image...
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-500 mt-1">
                                            📸 Take a photo or upload — you'll crop & straighten it next
                                        </p>
                                    )}

                                    {imagePreview && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-slate-400">Rotate:</span>
                                            <button
                                                type="button"
                                                onClick={() => rotateImage('left')}
                                                className="px-2 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-600"
                                            >
                                                ↺ Left
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => rotateImage('right')}
                                                className="px-2 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-600"
                                            >
                                                ↻ Right
                                            </button>
                                            <span className="text-xs text-slate-500">({imageRotation}°)</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Address */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Address <span className="text-slate-500">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    name="address"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="123 Main Street"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* City / State */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        City <span className="text-slate-500">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="city"
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        placeholder="Dallas"
                                        value={formData.city || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        State <span className="text-slate-500">(optional)</span>
                                    </label>
                                    <select
                                        name="state"
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        value={formData.state || ''}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select</option>
                                        {US_STATES.map(state => (
                                            <option key={state} value={state}>{state}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Zip */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Zip Code <span className="text-slate-500">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    name="zip"
                                    maxLength={10}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="75001"
                                    value={formData.zip || ''}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Phone / Email */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        placeholder="(555)-555-5555"
                                        value={formData.phone || ''}
                                        onChange={handlePhoneChange}
                                        maxLength={14}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                        placeholder="you@email.com"
                                        value={formData.email || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            {/* Website URL */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Website URL <span className="text-slate-500">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    name="website_url"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="yourwebsite.com"
                                    value={formData.website_url || ''}
                                    onChange={handleUrlChange}
                                    onBlur={handleUrlBlur}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Just enter your domain - we'll add https:// automatically
                                </p>
                            </div>

                            {/* ===== IN GAME INFORMATION ===== */}
                            <div className="pt-4 pb-1 border-b border-slate-600">
                                <p className="text-amber-500 font-semibold text-sm">🎮 In Game Information</p>
                            </div>

                            {/* Display Name */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Display Name * <span className="text-slate-500">(20 chars - shown in games)</span>
                                </label>
                                <input
                                    type="text"
                                    name="display_name"
                                    required
                                    maxLength={20}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="Short name for games"
                                    value={formData.display_name || ''}
                                    onChange={handleChange}
                                />
                                {formData.full_business_name && formData.full_business_name.length > 20 && (
                                    <p className="text-xs text-amber-400 mt-1">
                                        ⚠️ Your business name is too long for in-game display. Please shorten it above.
                                    </p>
                                )}
                            </div>

                            {/* Short In-Game Tagline */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Short In-Game Tagline <span className="text-slate-500">(20 chars)</span>
                                </label>
                                <input
                                    type="text"
                                    name="short_tagline"
                                    maxLength={20}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="Quick tagline for games"
                                    value={formData.short_tagline || ''}
                                    onChange={handleChange}
                                />
                                {formData.tagline && formData.tagline.length > 20 && (
                                    <p className="text-xs text-amber-400 mt-1">
                                        ⚠️ Your tagline is too long for in-game display. Please shorten it above.
                                    </p>
                                )}
                            </div>

                            {/* ===== CARD COLOR PREFERENCES ===== */}
                            <div className="pt-4 pb-1 border-b border-slate-600">
                                <p className="text-amber-500 font-semibold text-sm">🎨 Card Color Preferences</p>
                            </div>

                            {/* Background Color */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">
                                    Background Color
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {colorOptions.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, card_color: color.value })}
                                            className={`w-8 h-8 rounded-lg border-2 transition-all ${formData.card_color === color.value
                                                ? 'border-amber-500 scale-110'
                                                : 'border-slate-600 hover:border-slate-400'
                                                }`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Text Color */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">
                                    Text Color
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {textColorOptions.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, text_color: color.value })}
                                            className={`w-8 h-8 rounded-lg border-2 transition-all ${formData.text_color === color.value
                                                ? 'border-amber-500 scale-110'
                                                : 'border-slate-600 hover:border-slate-400'
                                                }`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* ===== PREVIEWS ===== */}
                            <div className="pt-4 pb-2 border-t border-slate-600 mt-4">
                                <p className="text-white font-semibold text-sm text-center mb-4">Preview Your Card</p>
                                <div className="space-y-4">
                                    <FullCardPreview />
                                    <InGamePreview />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={uploading || processingImage}
                                className="w-full py-3 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 font-bold transition-all mt-4"
                            >
                                {uploading ? 'Saving...' : (editingCardId ? 'Update Card' : 'Save Business Card')}
                            </button>
                        </form>
                    </div>
                )}

                {/* Existing Cards Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {cards.length === 0 && !showForm && (
                        <div className="col-span-full text-center py-8">
                            <p className="text-slate-400 mb-4">You haven't created any business cards yet.</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all"
                            >
                                Create Your First Card
                            </button>
                        </div>
                    )}

                    {cards.length >= maxCards && !showForm && (
                        <div className="col-span-full text-center py-4">
                            <p className="text-slate-400 text-sm">You've reached the maximum of {maxCards} business cards.</p>
                        </div>
                    )}

                    {cards.map((card) => (
                        <div key={card.id} className="relative group">
                            {isCardInUse(card.id) && (
                                <div className="absolute -top-2 -left-2 z-10 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                                    In Use
                                </div>
                            )}

                            {/* Edit Button */}
                            <button
                                onClick={() => handleEdit(card)}
                                className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 bg-amber-500 text-slate-900 hover:bg-amber-400 text-xs font-bold"
                                title="Edit card"
                            >
                                ✏️ Edit
                            </button>

                            {/* Delete Button */}
                            <button
                                onClick={() => handleDelete(card.id)}
                                className={`absolute -top-2 -right-2 z-10 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 ${isCardInUse(card.id)
                                    ? 'bg-slate-500 text-slate-300 cursor-not-allowed'
                                    : 'bg-red-500 text-white hover:bg-red-600'
                                    }`}
                                title={isCardInUse(card.id) ? 'Cannot delete - card is in use' : 'Delete card'}
                            >
                                {isCardInUse(card.id) ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>

                            {card.card_type === 'uploaded' && card.image_url ? (
                                <div className={`bg-slate-800 border rounded-lg overflow-hidden aspect-[7/4] flex items-center justify-center ${isCardInUse(card.id) ? 'border-green-500' : 'border-slate-700'}`}>
                                    <img
                                        src={card.image_url}
                                        alt="Business Card"
                                        className="w-full h-full object-contain"
                                        style={{ transform: `rotate(${card.image_rotation || 0}deg)` }}
                                    />
                                </div>
                            ) : (
                                <div
                                    className={`rounded-lg p-2 aspect-[7/4] flex flex-col justify-between border overflow-hidden ${isCardInUse(card.id) ? 'border-green-500' : 'border-slate-700'}`}
                                    style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                >
                                    <div className="text-center overflow-hidden">
                                        <h3 className="font-bold text-xs leading-tight line-clamp-2" style={{ color: card.text_color || '#FFFFFF' }}>
                                            {card.full_business_name || card.display_name || card.title || card.business_name}
                                        </h3>
                                        {(card.message || card.tagline) && (
                                            <p className="text-[10px] mt-0.5 opacity-90 line-clamp-2" style={{ color: card.text_color || '#FFFFFF' }}>
                                                {card.message || card.tagline}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-center text-[10px] truncate" style={{ color: card.text_color || '#FFFFFF' }}>
                                        {card.phone && <p className="truncate">{card.phone}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}

function CardsLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium">Loading...</p>
            </div>
        </div>
    )
}

export default function CardsPage() {
    return (
        <Suspense fallback={<CardsLoading />}>
            <CardsContent />
        </Suspense>
    )
}