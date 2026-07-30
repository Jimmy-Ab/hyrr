import { useEffect, useState, type FormEvent } from "react"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { useToast } from "../ui/toast"

export function AddCandidateDialog() {
  const {
    isAddCandidateOpen,
    addCandidateColumn,
    setAddCandidateOpen,
    addCandidate,
    selectedJobId,
  } = useJobStore()
  const { toast } = useToast()

  const [newName, setNewName] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newLocation, setNewLocation] = useState("")

  // Reset form when dialog opens
  useEffect(() => {
    if (isAddCandidateOpen) {
      setNewName("")
      setNewTitle("")
      setNewLocation("")
    }
  }, [isAddCandidateOpen])

  const handleAddCandidateSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!newName || !newTitle) {
      toast("Error", "Please fill in Name and Job Title.", "error")
      return
    }

    addCandidate(selectedJobId, {
      name: newName,
      title: newTitle,
      location: newLocation || "Remote",
      dateText: "Just now",
      status: addCandidateColumn,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150`,
      bookmarked: false,
    })

    toast("Candidate Added", `${newName} was successfully added.`, "success")
    setAddCandidateOpen(false)
  }

  return (
    <Dialog
      open={isAddCandidateOpen}
      onOpenChange={(open) => setAddCandidateOpen(open, addCandidateColumn)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>
            Create a new candidate in the "{addCandidateColumn}" pipeline column.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddCandidateSubmit} className="space-y-4 mt-5">
          <div>
            <label className="text-[13px] font-semibold text-txt-heading block mb-1.5">
              Candidate Name
            </label>
            <Input
              placeholder="e.g. Emily Carter"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-txt-heading block mb-1.5">
              Job Title
            </label>
            <Input
              placeholder="e.g. Senior Frontend Developer"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-txt-heading block mb-1.5">
              Location
            </label>
            <Input
              placeholder="e.g. San Francisco, CA"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddCandidateOpen(false)}
              className="cursor-pointer font-semibold"
            >
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer font-semibold">
              Add Candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
