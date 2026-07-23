import * as React from "react"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { ShieldAlert, LogOut, ArrowRight, UserCheck, Briefcase } from "lucide-react"

interface RoleMismatchProps {
  requiredRole: "SEEKER" | "RECRUITER" | "ADMIN"
  currentRole: string
}

export function RoleMismatch({ requiredRole, currentRole }: RoleMismatchProps) {
  const { user, logout } = useJobStore()

  const requiredRoleLabel =
    requiredRole === "SEEKER"
      ? "Job Seeker"
      : requiredRole === "RECRUITER"
      ? "Recruiter"
      : "Administrator"

  const currentRoleLabel =
    currentRole === "SEEKER"
      ? "Job Seeker"
      : currentRole === "RECRUITER"
      ? "Recruiter"
      : currentRole === "ADMIN"
      ? "Administrator"
      : currentRole

  const handleSwitchAccount = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#F6F7FB] p-6 text-[#17181C]">
      <div className="w-full max-w-md bg-white rounded-[24px] border border-[#E8EAF1] shadow-[0_10px_40px_rgba(15,23,42,0.06)] p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-200">
        
        {/* Icon Header */}
        <div className="w-16 h-16 rounded-full bg-[#F2F1FF] flex items-center justify-center text-[#6C63FF] shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Content Header */}
        <div className="space-y-2">
          <h2 className="text-[24px] font-bold tracking-tight text-[#17181C]">
            Access Restricted
          </h2>
          <p className="text-[14px] leading-relaxed text-[#646B7A]">
            This portal is exclusively for <span className="font-semibold text-[#17181C]">{requiredRoleLabel}s</span>. Your current account is registered as a <span className="font-semibold text-[#6C63FF]">{currentRoleLabel}</span>.
          </p>
        </div>

        {/* User Card */}
        {user && (
          <div className="w-full bg-[#F8F9FC] rounded-[18px] border border-[#E8EAF1] p-4 flex items-center gap-3 text-left">
            <img
              src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}&background=6C63FF&color=fff`}
              alt={user.name || user.email}
              className="w-11 h-11 rounded-full object-cover border border-[#E8EAF1]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#17181C] truncate">
                {user.name || "Signed in User"}
              </p>
              <p className="text-[12px] text-[#98A2B3] truncate">{user.email}</p>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-[#F2F1FF] text-[#6C63FF] border border-[#6C63FF]/20">
              {currentRoleLabel}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="w-full space-y-3 pt-2">
          <Button
            onClick={handleSwitchAccount}
            className="w-full h-12 rounded-[18px] bg-[#6C63FF] hover:bg-[#5B52F5] text-white font-semibold text-[14px] shadow-[0_8px_30px_rgba(108,99,255,0.18)] transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Switch Account</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
