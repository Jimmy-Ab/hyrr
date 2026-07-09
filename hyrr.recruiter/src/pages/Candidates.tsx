import { useState } from "react"
import { Search, MapPin, Bookmark, Trash2, Mail } from "lucide-react"
import { useJobStore, type Candidate } from "../store/useJobStore"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Card } from "../components/ui/card"
import { useToast } from "../components/ui/toast"

export function Candidates() {
  const { candidates, toggleBookmark, deleteCandidate, searchQuery, setSearchQuery } = useJobStore()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>("All")

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "All" || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // List of statuses for selection filter
  const statuses = ["All", "Saved", "Applied", "In Process", "Offer", "Archived"]

  const getStatusBadgeVariant = (status: Candidate["status"]) => {
    switch (status) {
      case "Saved":
        return "primary"
      case "Applied":
        return "info"
      case "In Process":
        return "warning"
      case "Offer":
        return "success"
      case "Archived":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none">
      {/* Header */}
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Candidates Directory</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Detailed list of all applicants in your workspace.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <input
            type="text"
            placeholder="Search candidates by name, role, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-input border border-bg-border bg-bg-secondary text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
        </div>
        <div className="flex gap-1.5 bg-bg-secondary p-1 border border-bg-border rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-[10px] text-caption font-semibold cursor-pointer transition-all ${
                statusFilter === status
                  ? "bg-primary text-white"
                  : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden border border-bg-border/60 shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Candidate</TableHead>
              <TableHead>Applied Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Pipeline Status</TableHead>
              <TableHead>Action Date</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-6 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="w-10 h-10 rounded-full object-cover border border-bg-border/40"
                    />
                    <span className="font-semibold text-txt-heading text-[15px]">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-4 font-semibold text-txt-body">{c.title}</TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-1 text-[13px] text-txt-body font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-txt-caption" />
                    <span>{c.location}</span>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Badge variant={getStatusBadgeVariant(c.status)}>{c.status}</Badge>
                </TableCell>
                <TableCell className="py-4 text-[13px] text-txt-caption font-semibold">{c.dateText}</TableCell>
                <TableCell className="pr-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      onClick={() => toggleBookmark(c.id)}
                      className={`cursor-pointer p-1.5 rounded-full hover:bg-bg-hover transition-colors ${
                        c.bookmarked ? "text-primary" : "text-txt-caption"
                      }`}
                    >
                      <Bookmark className="w-4 h-4" fill={c.bookmarked ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => {
                        toast("Direct Mail", `Opening message portal for ${c.name}`, "info")
                      }}
                      className="cursor-pointer p-1.5 rounded-full text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCandidate(c.id)}
                      className="cursor-pointer p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredCandidates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-txt-caption font-semibold">
                  No candidates match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
