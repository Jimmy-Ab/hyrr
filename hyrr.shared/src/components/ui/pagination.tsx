import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  
  return (
    <div className="flex items-center justify-between py-4 border-t border-bg-border/30 mt-6 select-none">
      <span className="text-[13px] text-txt-caption">
        Page <span className="font-semibold text-txt-heading">{currentPage}</span> of{" "}
        <span className="font-semibold text-txt-heading">{totalPages}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="rounded-[12px] h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            variant={p === currentPage ? "primary" : "ghost"}
            size="sm"
            onClick={() => onPageChange(p)}
            className={`rounded-[12px] h-8 w-8 p-0 font-semibold ${p === currentPage ? "shadow-none" : "text-txt-body hover:text-txt-heading"}`}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded-[12px] h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
