import { createClient } from '@/lib/supabase/server'
import UploadClient from './UploadClient'

export default async function UploadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NOT_AUTHENTICATED</span>
      </div>
    )
  }

  const { data: shoesData } = await supabase
    .from('shoes')
    .select('id, brand, model')
    .eq('user_id', user.id)
    .order('brand')
  const shoes = shoesData ?? []

  return <UploadClient shoes={shoes} />
}
