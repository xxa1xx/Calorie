import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getByBarcode, extractNutrients } from '../lib/openFoodFacts'

export default function BarcodeScanner({ onLogged }) {
  const { user } = useAuth()
  const [scanning, setScanning] = useState(false)
  const [product, setProduct] = useState(null)
  const [amount, setAmount] = useState('100')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop() } catch {}
      html5QrRef.current = null
    }
    setScanning(false)
  }

  const startScanner = async () => {
    setError('')
    setProduct(null)
    setScanning(true)

    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('barcode-reader')
    html5QrRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
          await stopScanner()
          await lookupBarcode(decodedText)
        },
        () => {}
      )
    } catch (err) {
      setError('Camera access denied. Enter barcode manually below.')
      setScanning(false)
    }
  }

  const lookupBarcode = async (code) => {
    setError('')
    const p = await getByBarcode(code)
    if (!p) {
      setError(`Barcode ${code} not found in Open Food Facts database`)
      return
    }
    setProduct(p)
  }

  const handleManual = async (e) => {
    e.preventDefault()
    if (!manualBarcode.trim()) return
    await lookupBarcode(manualBarcode.trim())
  }

  const handleLog = async (e) => {
    e.preventDefault()
    if (!product) return
    const g = parseFloat(amount)
    if (!g || g <= 0) { setError('Enter a valid amount'); return }

    const nutrients = extractNutrients(product, g)
    if (!nutrients.calories) { setError('No calorie data for this product'); return }

    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const entry = {
      user_id: user.id,
      date: today,
      description: `${nutrients.description} (${g}g)`,
      calories: nutrients.calories,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
      fiber_g: nutrients.fiber_g,
      items: [],
      feedback: null,
    }

    const { error: dbError } = await supabase.from('food_logs').insert(entry)
    if (dbError) { setError(dbError.message); setSaving(false); return }

    await supabase.from('favorites').upsert(
      { user_id: user.id, description: entry.description, calories: entry.calories,
        protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g,
        fiber_g: entry.fiber_g, items: [], last_used: new Date().toISOString() },
      { onConflict: 'user_id,description' }
    ).catch(() => {})

    setProduct(null)
    setManualBarcode('')
    setAmount('100')
    setSaving(false)
    onLogged(entry)
  }

  useEffect(() => () => { stopScanner() }, [])

  return (
    <div className="space-y-4">
      {!product && (
        <>
          {!scanning ? (
            <button
              type="button"
              onClick={startScanner}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h3M3 4v3M3 4H3m18 0h-3m3 0v3m0-3h0M3 20h3m-3 0v-3m0 3h0m18 0h-3m3 0v-3m0 3h0M9 8h6v8H9z" />
              </svg>
              Scan Barcode with Camera
            </button>
          ) : (
            <div className="space-y-2">
              <div id="barcode-reader" ref={scannerRef} className="rounded-xl overflow-hidden" />
              <button type="button" onClick={stopScanner} className="btn-secondary w-full text-sm">
                Cancel Scan
              </button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs text-gray-400"><span className="bg-white px-2">or enter barcode manually</span></div>
          </div>

          <form onSubmit={handleManual} className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="e.g. 5000112637922"
              inputMode="numeric"
            />
            <button type="submit" className="btn-secondary px-4 text-sm">Look up</button>
          </form>
        </>
      )}

      {product && (
        <form onSubmit={handleLog} className="bg-primary-50 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            {product.image_thumb_url && (
              <img src={product.image_thumb_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div>
              <p className="font-semibold text-sm text-gray-900">{product.product_name}</p>
              {product.brands && <p className="text-xs text-gray-500">{product.brands}</p>}
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label text-xs">Amount (grams)</label>
              <input type="number" className="input text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" step="1" required />
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 mb-1">Estimated</p>
              <p className="font-bold text-gray-900">{extractNutrients(product, parseFloat(amount) || 0).calories} kcal</p>
            </div>
          </div>

          {(() => {
            const n = extractNutrients(product, parseFloat(amount) || 0)
            return (
              <div className="flex gap-3 text-xs text-gray-600">
                <span>P: {n.protein_g}g</span>
                <span>C: {n.carbs_g}g</span>
                <span>F: {n.fat_g}g</span>
                {n.fiber_g > 0 && <span>Fiber: {n.fiber_g}g</span>}
              </div>
            )
          })()}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setProduct(null); setManualBarcode('') }} className="btn-secondary flex-1 text-sm">
              Back
            </button>
            <button type="submit" className="btn-primary flex-1 text-sm" disabled={saving}>
              {saving ? 'Logging...' : 'Log Food'}
            </button>
          </div>
        </form>
      )}

      {error && !product && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
      <p className="text-xs text-center text-gray-400">Barcode lookup via Open Food Facts — free, no API key</p>
    </div>
  )
}
