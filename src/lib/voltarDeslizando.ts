// Arrastar o dedo da beirada esquerda da tela para a direita = voltar (igual ao iPhone)
import { useEffect, useRef } from 'react'

export function useVoltarDeslizando(voltar: (() => void) | null) {
  const ref = useRef(voltar)
  ref.current = voltar
  useEffect(() => {
    let x0 = 0, y0 = 0, ativo = false
    const inicio = (e: TouchEvent) => {
      const t = e.touches[0]
      ativo = !!ref.current && t.clientX <= 30
      x0 = t.clientX; y0 = t.clientY
    }
    const fim = (e: TouchEvent) => {
      if (!ativo) return
      ativo = false
      const t = e.changedTouches[0]
      const dx = t.clientX - x0, dy = Math.abs(t.clientY - y0)
      if (dx > 70 && dy < 80) ref.current?.()
    }
    document.addEventListener('touchstart', inicio, { passive: true })
    document.addEventListener('touchend', fim, { passive: true })
    return () => { document.removeEventListener('touchstart', inicio); document.removeEventListener('touchend', fim) }
  }, [])
}
