import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle, Info, X } from "lucide-react"
import * as React from "react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  title: string
  description?: string
  type: ToastType
}

interface ToastContextType {
  toast: (title: string, description?: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error("useToast must be used within ToastProvider")
  return context
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (title: string, description?: string, type: ToastType = "success") => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, title, description, type }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-bg-secondary border border-bg-border rounded-card shadow-floating p-4 pointer-events-auto flex items-start gap-3 w-full"
            >
              <div className="mt-0.5 shrink-0">
                {t.type === "success" && <CheckCircle className="text-sec-green w-5 h-5" />}
                {t.type === "error" && <AlertCircle className="text-sec-red w-5 h-5" />}
                {t.type === "warning" && <AlertCircle className="text-sec-orange w-5 h-5" />}
                {t.type === "info" && <Info className="text-sec-blue w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-body font-semibold text-txt-heading">{t.title}</h4>
                {t.description && (
                  <p className="text-caption text-txt-body mt-1 leading-normal">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-txt-caption hover:text-txt-heading p-1 rounded-full hover:bg-bg-hover transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
