import { useState, type FormEvent } from "react"
import { useJobStore } from "../../store/useJobStore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useToast } from "../ui/toast"

export function AddJobDialog() {
  const { isAddJobOpen, setAddJobOpen, addJob } = useJobStore()
  const { toast } = useToast()

  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [type, setType] = useState("Full Time")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title) {
      toast("Error", "Please fill in Job Title.", "error")
      return
    }

    addJob({
      title,
      location: location || "Remote",
      type,
    })

    toast("Job Created", `"${title}" has been successfully added to listings.`, "success")
    setTitle("")
    setLocation("")
    setType("Full Time")
    setAddJobOpen(false)
  }

  return (
    <Dialog open={isAddJobOpen} onOpenChange={setAddJobOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Job Listing</DialogTitle>
          <DialogDescription>
            Add a new active vacancy to your hiring workspace pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          <div>
            <label className="text-[13px] font-semibold text-txt-heading block mb-1.5">
              Job Title
            </label>
            <Input
              placeholder="e.g. Product Manager"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-txt-heading block mb-1.5">
              Location
            </label>
            <Input
              placeholder="e.g. San Francisco, CA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-txt-heading block mb-1.5">
              Job Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-11 px-3.5 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
            >
              <option value="Full Time">Full Time</option>
              <option value="Part Time">Part Time</option>
              <option value="Contract">Contract</option>
              <option value="Remote">Remote</option>
            </select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddJobOpen(false)}
              className="cursor-pointer font-semibold"
            >
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer font-semibold">Create Listing</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
