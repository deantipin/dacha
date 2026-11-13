'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, onClose, children, wide = false, className = '' }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = priorOverflow; prior?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''} ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="modal-top"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Закрыть окно" onClick={onClose}><X size={21} /></button></div>
    {children}
  </dialog>;
}
