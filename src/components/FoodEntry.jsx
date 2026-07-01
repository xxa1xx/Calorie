import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function FoodEntry({ entry, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Remove this entry?')) return
    setDeleting(true)
    const { error } = await supabase.from('food_logs').delete().eq('id', entry.id)
    if (error) {
      console.error('Delete failed:', error)
      setDeleting(false)
      return
    }
    onDelete(entry.id)
  }

  const time = new Date(entry.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{entry.description}</p>
          <p className="text-xs text-gray-500 mt-0.5">{time}</p>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">{entry.calories} kcal</div>
            <div className="text-xs text-gray-500">P:{Math.round(entry.protein_g)}g C:{Math.round(entry.carbs_g)}g F:{Math.round(entry.fat_g)}g</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete() }}
            disabled={deleting}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Delete entry"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 bg-gray-50">
          {entry.feedback && (
            <p className="text-xs text-primary-700 bg-primary-50 rounded p-2 mb-2">{entry.feedback}</p>
          )}
          {entry.items && entry.items.length > 0 && (
            <div className="space-y-1">
              {entry.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-600">
                  <span>{item.name} <span className="text-gray-400">({item.amount})</span></span>
                  <span>{item.calories} kcal</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
