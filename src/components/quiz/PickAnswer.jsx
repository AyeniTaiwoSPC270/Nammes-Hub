import { useState } from 'react'
import { OrderPicker } from './OrderPicker'
import { DiagramTap } from './DiagramTap'

// The two pick-instead-of-type questions, wrapped for practice and battle, which both need the same "hold the draft,
// then submit it" shape and neither of which keeps a draft between renders the way the live phone does.
export function OrderPick({ steps, disabled, onSubmit }) {
  const [order, setOrder] = useState([])
  const ready = order.length === steps.length
  return (
    <div className="flex flex-1 flex-col gap-3">
      <OrderPicker steps={steps} value={order} onChange={setOrder} disabled={disabled} />
      <button
        type="button"
        disabled={disabled || !ready}
        onClick={() => ready && onSubmit(order)}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md disabled:opacity-50"
      >
        Lock in order
      </button>
    </div>
  )
}

export function DiagramPick({ src, alt, disabled, onSubmit }) {
  const [tap, setTap] = useState(null)
  return (
    <div className="flex flex-1 flex-col gap-3">
      <DiagramTap src={src} alt={alt} preview={tap} onTap={setTap} disabled={disabled} />
      <button
        type="button"
        disabled={disabled || !tap}
        onClick={() => tap && onSubmit(tap)}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md disabled:opacity-50"
      >
        Lock in answer
      </button>
    </div>
  )
}