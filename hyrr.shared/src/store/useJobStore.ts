import { create } from "zustand"
import { apiFetch } from "../lib/api"
import { io } from "socket.io-client"

export interface Job {
  id: string
  title: string
  location: string
  type: string
  posted: string
  status: "Active" | "Closed"
  color: "purple" | "blue" | "green" | "orange"
}

export interface Candidate {
  id: string
  jobId: string
  name: string
  email?: string
  phone?: string
  title: string
  location: string
  coverLetter?: string
  dateText: string
  status: "Saved" | "Applied" | "In Process" | "Offer" | "Archived"
  tag?: string
  avatar: string
  bookmarked: boolean
}

export interface NotificationItem {
  id: string
  title: string
  time: string
  read: boolean
}

export interface PublicJob {
  id: string
  title: string
  company: string
  companyColor: "purple" | "blue" | "green" | "orange"
  location: string
  type: "Full Time" | "Part Time" | "Contract" | "Remote"
  salary: string
  posted: string
  description: string
  requirements: string[]
  skills: string[]
  benefits: string[]
  featured?: boolean
  remote?: boolean
}

export interface JobApplication {
  id: string
  publicJobId: string
  company: string
  title: string
  companyColor: "purple" | "blue" | "green" | "orange"
  location: string
  type: string
  salary: string
  appliedDate: string
  status: "Saved" | "Applied" | "In Process" | "Offer" | "Archived"
  bookmarked: boolean
  recruiterName: string
  recruiterAvatar: string
  interviewDate?: string
  offerAmount?: string
  notes?: string
  tag?: string
}

export interface JobState {
  // Recruiter workspace state
  jobs: Job[]
  candidates: Candidate[]
  selectedJobId: string
  activeView: "Dashboard" | "Jobs" | "Candidates" | "Applications" | "Calendar" | "Messages" | "Analytics" | "Careers"
  careerSelectedJobId: string
  workspaceName: string
  isAddCandidateOpen: boolean
  addCandidateColumn: Candidate["status"]
  isAddJobOpen: boolean
  searchQuery: string
  theme: "light" | "dark"
  notifications: NotificationItem[]

// Authentication state
user: { id: string; email: string; name: string; avatar: string; role: 'SEEKER' | 'RECRUITER' | 'ADMIN' } | null
accessToken: string | null
isAuthenticated: boolean
authLoading: boolean
authError: string | null
socket: any | null

loginUser: (email: string, password: string) => Promise<boolean>
registerUser: (name: string, email: string, password: string, role: 'SEEKER' | 'RECRUITER') => Promise<boolean>
logout: () => void
  setAccessToken: (token: string | null) => void
    initializeSocket: () => void

      selectJob: (jobId: string) => void
        moveCandidate: (candidateId: string, targetStatus: Candidate["status"]) => void
          addCandidate: (jobId: string, candidate: Omit<Candidate, "id" | "jobId">) => void
            addJob: (job: Omit<Job, "id" | "color" | "status" | "posted">) => void
              toggleBookmark: (candidateId: string) => void
                setSearchQuery: (query: string) => void
                  toggleTheme: () => void
                    markNotificationsAsRead: () => void
                      markNotificationRead: (id: string) => void
                        clearNotifications: () => void
                          deleteCandidate: (candidateId: string) => void
                            setActiveView: (view: "Dashboard" | "Jobs" | "Candidates" | "Applications" | "Calendar" | "Messages" | "Analytics" | "Careers") => void
                              setCareerSelectedJobId: (jobId: string) => void
                                applyToJob: (jobId: string, applicant: { name: string; email: string; phone: string; title: string; location: string; linkedin?: string; coverLetter?: string }) => void
                                  setWorkspaceName: (name: string) => void
                                    setAddCandidateOpen: (open: boolean, col?: Candidate["status"]) => void
                                      setAddJobOpen: (open: boolean) => void
                                        fetchInitialData: () => Promise<void>

// Candidate workspace state
candidateActiveView: "Dashboard" | "Discover" | "Applications" | "Messages" | "Notifications" | "Calendar" | "Documents" | "Profile" | "Settings"
publicJobs: PublicJob[]
jobApplications: JobApplication[]
discoverSearch: string
discoverTypeFilter: string
setCandidateActiveView: (view: "Dashboard" | "Discover" | "Applications" | "Messages" | "Notifications" | "Calendar" | "Documents" | "Profile" | "Settings") => void
  moveJobApplication: (id: string, status: JobApplication["status"]) => void
    toggleJobBookmark: (id: string) => void
      applyFromDiscover: (publicJobId: string) => void
        saveJobFromDiscover: (publicJobId: string) => void
          setDiscoverSearch: (q: string) => void
            setDiscoverTypeFilter: (t: string) => void
}

export const useJobStore = create<JobState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  authLoading: false,
  authError: null,
  socket: null,

  loginUser: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      set({
        accessToken: data.accessToken,
        isAuthenticated: true,
        authLoading: false,
        user: { id: data.userId, role: data.role, email, name: '', avatar: '' },
      });
      get().initializeSocket();
      get().fetchInitialData();
      return true;
    } catch (err: any) {
      set({ authError: err.message, authLoading: false });
      return false;
    }
  },

  registerUser: async (name, email, password, role) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
        skipAuth: true,
      });
      set({
        accessToken: data.accessToken,
        isAuthenticated: true,
        authLoading: false,
        user: { id: data.userId, role: data.role, email, name, avatar: '' },
      });
      get().initializeSocket();
      get().fetchInitialData();
      return true;
    } catch (err: any) {
      set({ authError: err.message, authLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch { }
    const s = get().socket;
    if (s) s.disconnect();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      socket: null,
      jobs: [],
      candidates: [],
      jobApplications: [],
    });
  },

  setAccessToken: (token) => {
    set({ accessToken: token, isAuthenticated: !!token });
    if (token) {
      get().initializeSocket();
      get().fetchInitialData();
    }
  },

  initializeSocket: () => {
    const token = get().accessToken;
    if (!token) return;

    // Disconnect old socket
    if (get().socket) get().socket.disconnect();

    const socket = io('http://localhost:3000', {
      auth: { token },
    });

    socket.on('application_status_updated', (data: any) => {
      set((state) => ({
        jobApplications: state.jobApplications.map((app) =>
          app.id === data.applicationId ? { ...app, status: data.status, tag: data.tag } : app
        )
      }));
    });

    socket.on('candidate_ai_scored', (data: any) => {
      set((state) => ({
        candidates: state.candidates.map((cand) =>
          cand.id === data.applicationId ? { ...cand, aiScore: data.score, aiSummary: data.summary } : cand
        )
      }));
    });

    socket.on('new_message', (data: any) => {
      // Invalidate messages lists or append directly
      // Trigger notification toasts dynamically
    });

    set({ socket });
  },

  activeView: "Applications",
  setActiveView: (view) => set({ activeView: view }),
  careerSelectedJobId: "senior-frontend-developer",
  setCareerSelectedJobId: (jobId) => set({ careerSelectedJobId: jobId }),
  workspaceName: "Acme Careers",
  isAddCandidateOpen: false,
  addCandidateColumn: "Saved",
  isAddJobOpen: false,

  // Candidate workspace
  candidateActiveView: "Dashboard",
  discoverSearch: "",
  discoverTypeFilter: "All",
  setCandidateActiveView: (view) => set({ candidateActiveView: view }),
  setDiscoverSearch: (q) => set({ discoverSearch: q }),
  setDiscoverTypeFilter: (t) => set({ discoverTypeFilter: t }),

  publicJobs: [
    {
      id: "pj-1", title: "Senior Frontend Engineer", company: "Stripe", companyColor: "purple",
      location: "San Francisco, CA", type: "Full Time", salary: "$160k – $220k",
      posted: "2 days ago", featured: true,
      description: "Join Stripe's web platform team to build the financial infrastructure of the internet. You'll architect large-scale React applications used by millions.",
      requirements: ["5+ years React experience", "TypeScript proficiency", "Design system experience", "Performance optimization"],
      skills: ["React", "TypeScript", "Next.js", "GraphQL", "CSS-in-JS"],
      benefits: ["Equity package", "Unlimited PTO", "Remote-friendly", "$5k learning budget"]
    },
    {
      id: "pj-2", title: "Product Designer", company: "Vercel", companyColor: "blue",
      location: "Remote", type: "Remote", salary: "$130k – $180k",
      posted: "1 day ago", featured: true, remote: true,
      description: "Design the future of web development tooling at Vercel. Own end-to-end design for the deployment dashboard and developer experience.",
      requirements: ["4+ years product design", "Figma expert", "Design systems experience", "Developer empathy"],
      skills: ["Figma", "Prototyping", "Design Systems", "User Research"],
      benefits: ["Full remote", "Stock options", "$3k home office stipend", "Top-tier health"]
    },
    {
      id: "pj-3", title: "Backend Engineer", company: "Linear", companyColor: "green",
      location: "New York, NY", type: "Full Time", salary: "$150k – $200k",
      posted: "3 days ago",
      description: "Build the infrastructure powering Linear's project management platform. Work on real-time sync, performance, and reliability at scale.",
      requirements: ["Node.js / Go proficiency", "PostgreSQL expertise", "Distributed systems", "API design"],
      skills: ["Node.js", "PostgreSQL", "Redis", "GraphQL", "Docker"],
      benefits: ["Competitive equity", "Flexible hours", "Annual retreats", "Wellness budget"]
    },
    {
      id: "pj-4", title: "iOS Engineer", company: "Notion", companyColor: "orange",
      location: "Remote", type: "Remote", salary: "$140k – $190k",
      posted: "5 days ago", remote: true,
      description: "Build Notion's mobile experience for millions of users. Craft best-in-class Swift UI with performance and delight.",
      requirements: ["Swift expertise", "SwiftUI experience", "App Store deployment", "Performance profiling"],
      skills: ["Swift", "SwiftUI", "Combine", "CoreData", "XCTest"],
      benefits: ["Remote first", "$10k equity cliff", "Notion Pro", "Learning stipend"]
    },
    {
      id: "pj-5", title: "DevOps Engineer", company: "PlanetScale", companyColor: "purple",
      location: "Austin, TX", type: "Full Time", salary: "$135k – $175k",
      posted: "4 days ago",
      description: "Manage and scale cloud infrastructure for PlanetScale's globally distributed database service.",
      requirements: ["Kubernetes mastery", "AWS / GCP", "Terraform", "Observability tooling"],
      skills: ["Kubernetes", "Terraform", "AWS", "Prometheus", "Golang"],
      benefits: ["Stock options", "Conference budget", "Home office setup", "Flexible PTO"]
    },
    {
      id: "pj-6", title: "Marketing Manager", company: "Loom", companyColor: "blue",
      location: "London, UK", type: "Part Time", salary: "£60k – £80k",
      posted: "1 week ago",
      description: "Lead growth marketing initiatives for Loom's EMEA market expansion. Own demand gen, content, and campaign analytics.",
      requirements: ["B2B SaaS marketing", "Demand gen experience", "Data-driven mindset", "Team leadership"],
      skills: ["HubSpot", "SEO", "Paid Ads", "Analytics", "Content Strategy"],
      benefits: ["Hybrid work", "Pension plan", "25 days PTO", "Gym allowance"]
    },
    {
      id: "pj-7", title: "Data Scientist", company: "Figma", companyColor: "green",
      location: "San Francisco, CA", type: "Full Time", salary: "$155k – $210k",
      posted: "6 days ago", featured: true,
      description: "Use data to shape product decisions at Figma. Partner with product and design teams to build ML-powered insights and recommendation systems.",
      requirements: ["Python + ML libraries", "SQL proficiency", "Statistical modeling", "A/B testing"],
      skills: ["Python", "TensorFlow", "dbt", "SQL", "Looker"],
      benefits: ["Top-tier compensation", "Figma Pro", "$6k education", "Hybrid flexible"]
    },
    {
      id: "pj-8", title: "Customer Success Manager", company: "Intercom", companyColor: "orange",
      location: "Remote", type: "Remote", salary: "$90k – $120k",
      posted: "2 days ago", remote: true,
      description: "Own a portfolio of enterprise accounts at Intercom. Drive adoption, retention, and expansion while being a trusted advisor to customers.",
      requirements: ["3+ years CSM", "SaaS experience", "Enterprise accounts", "Strong communication"],
      skills: ["Salesforce", "Intercom", "Gainsight", "Data Analysis", "Presentation"],
      benefits: ["Full remote", "Commission plan", "Health + dental", "$2k travel budget"]
    },
  ],

  jobApplications: [
    {
      id: "ja-1", publicJobId: "pj-1", company: "Stripe", title: "Senior Frontend Engineer",
      companyColor: "purple", location: "San Francisco, CA", type: "Full Time",
      salary: "$160k – $220k", appliedDate: "3 days ago", status: "In Process",
      bookmarked: true, recruiterName: "Sarah Kim", tag: "Technical Interview",
      recruiterAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
      interviewDate: "Jul 5, 10:00 AM",
    },
    {
      id: "ja-2", publicJobId: "pj-2", company: "Vercel", title: "Product Designer",
      companyColor: "blue", location: "Remote", type: "Remote",
      salary: "$130k – $180k", appliedDate: "1 week ago", status: "Applied",
      bookmarked: false, recruiterName: "Marcus Chen",
      recruiterAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    },
    {
      id: "ja-3", publicJobId: "pj-7", company: "Figma", title: "Data Scientist",
      companyColor: "green", location: "San Francisco, CA", type: "Full Time",
      salary: "$155k – $210k", appliedDate: "2 weeks ago", status: "Offer",
      bookmarked: true, recruiterName: "Priya Nair", tag: "Offer Received",
      recruiterAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
      offerAmount: "$185,000 + equity",
    },
    {
      id: "ja-4", publicJobId: "pj-3", company: "Linear", title: "Backend Engineer",
      companyColor: "green", location: "New York, NY", type: "Full Time",
      salary: "$150k – $200k", appliedDate: "4 days ago", status: "Saved",
      bookmarked: false, recruiterName: "Alex Torres",
      recruiterAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
    },
    {
      id: "ja-5", publicJobId: "pj-5", company: "PlanetScale", title: "DevOps Engineer",
      companyColor: "purple", location: "Austin, TX", type: "Full Time",
      salary: "$135k – $175k", appliedDate: "3 weeks ago", status: "Archived",
      bookmarked: false, recruiterName: "Jordan Lee", tag: "Not a fit",
      recruiterAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
    },
    {
      id: "ja-6", publicJobId: "pj-4", company: "Notion", title: "iOS Engineer",
      companyColor: "orange", location: "Remote", type: "Remote",
      salary: "$140k – $190k", appliedDate: "5 days ago", status: "Applied",
      bookmarked: false, recruiterName: "Emma Davis",
      recruiterAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    },
  ],

  jobs: [
    {
      id: "senior-frontend-developer",
      title: "Senior Frontend Developer",
      location: "San Francisco, CA",
      type: "Full Time",
      posted: "Posted 5 days ago",
      status: "Active",
      color: "purple",
    },
    {
      id: "product-designer",
      title: "Product Designer",
      location: "New York, NY",
      type: "Full Time",
      posted: "Posted 2 days ago",
      status: "Active",
      color: "blue",
    },
    {
      id: "backend-engineer",
      title: "Backend Engineer",
      location: "Remote",
      type: "Full Time",
      posted: "Posted 1 week ago",
      status: "Active",
      color: "green",
    },
    {
      id: "marketing-manager",
      title: "Marketing Manager",
      location: "London, UK",
      type: "Part Time",
      posted: "Posted 3 days ago",
      status: "Active",
      color: "orange",
    },
    {
      id: "customer-support",
      title: "Customer Support",
      location: "Remote",
      type: "Contract",
      posted: "Posted 6 days ago",
      status: "Active",
      color: "purple",
    },
  ],
  selectedJobId: "senior-frontend-developer",
  searchQuery: "",
  theme: "light",
  notifications: [
    { id: "1", title: "James Wilson applied for Senior Frontend Developer", time: "1 hour ago", read: false },
    { id: "2", title: "Robert Brown moved to Technical Interview", time: "2 hours ago", read: false },
    { id: "3", title: "Christopher Taylor accepted the offer", time: "4 hours ago", read: false },
    { id: "4", title: "Sarah Johnson bookmarked a new listing", time: "1 day ago", read: true },
  ],
  candidates: [
    // Saved Column Candidates
    {
      id: "c1",
      jobId: "senior-frontend-developer",
      name: "Emily Carter",
      title: "Senior Developer",
      location: "San Francisco, CA",
      dateText: "2 days ago",
      status: "Saved",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
      bookmarked: true,
    },
    {
      id: "c2",
      jobId: "senior-frontend-developer",
      name: "Michael Chen",
      title: "UI Engineer",
      location: "San Francisco, CA",
      dateText: "3 days ago",
      status: "Saved",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      bookmarked: false,
    },
    {
      id: "c3",
      jobId: "senior-frontend-developer",
      name: "Sarah Johnson",
      title: "React Developer",
      location: "Oakland, CA",
      dateText: "4 days ago",
      status: "Saved",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
      bookmarked: false,
    },
    {
      id: "c4",
      jobId: "senior-frontend-developer",
      name: "David Kim",
      title: "Frontend Engineer",
      location: "San Jose, CA",
      dateText: "5 days ago",
      status: "Saved",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      bookmarked: false,
    },

    // Applied Column Candidates
    {
      id: "c5",
      jobId: "senior-frontend-developer",
      name: "James Wilson",
      title: "Senior Developer",
      location: "San Francisco, CA",
      dateText: "1 day ago",
      status: "Applied",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
      bookmarked: false,
    },
    {
      id: "c6",
      jobId: "senior-frontend-developer",
      name: "Lisa Park",
      title: "Frontend Developer",
      location: "San Francisco, CA",
      dateText: "2 days ago",
      status: "Applied",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
      bookmarked: false,
    },
    {
      id: "c7",
      jobId: "senior-frontend-developer",
      name: "Kevin Nguyen",
      title: "React Developer",
      location: "San Jose, CA",
      dateText: "2 days ago",
      status: "Applied",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150",
      bookmarked: false,
    },
    {
      id: "c8",
      jobId: "senior-frontend-developer",
      name: "Amanda Lee",
      title: "UI Engineer",
      location: "Oakland, CA",
      dateText: "3 days ago",
      status: "Applied",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
      bookmarked: false,
    },

    // In Process Column Candidates
    {
      id: "c9",
      jobId: "senior-frontend-developer",
      name: "Robert Brown",
      title: "Senior Developer",
      location: "San Francisco, CA",
      dateText: "Interview",
      status: "In Process",
      tag: "Interview",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      bookmarked: false,
    },
    {
      id: "c10",
      jobId: "senior-frontend-developer",
      name: "Jessica Davis",
      title: "React Developer",
      location: "San Francisco, CA",
      dateText: "Technical Test",
      status: "In Process",
      tag: "Technical Test",
      avatar: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=150",
      bookmarked: false,
    },
    {
      id: "c11",
      jobId: "senior-frontend-developer",
      name: "Daniel Martinez",
      title: "UI Engineer",
      location: "San Jose, CA",
      dateText: "Screening",
      status: "In Process",
      tag: "Screening",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
      bookmarked: false,
    },

    // Offer Column Candidates
    {
      id: "c12",
      jobId: "senior-frontend-developer",
      name: "Christopher Taylor",
      title: "Senior Frontend Engineer",
      location: "San Francisco, CA",
      dateText: "Offer Sent",
      status: "Offer",
      tag: "Offer Sent",
      avatar: "https://images.unsplash.com/photo-1542206395-9feb3edaa68d?w=150",
      bookmarked: false,
    },
    {
      id: "c13",
      jobId: "senior-frontend-developer",
      name: "Brian Anderson",
      title: "UI Engineer",
      location: "Oakland, CA",
      dateText: "Offer Sent",
      status: "Offer",
      tag: "Offer Sent",
      avatar: "https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150",
      bookmarked: false,
    },

    // Archived Column Candidates
    {
      id: "c14",
      jobId: "senior-frontend-developer",
      name: "Matthew Thomas",
      title: "Frontend Developer",
      location: "San Francisco, CA",
      dateText: "Not a fit",
      status: "Archived",
      tag: "Not a fit",
      avatar: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=150",
      bookmarked: false,
    },
    {
      id: "c15",
      jobId: "senior-frontend-developer",
      name: "Olivia Martinez",
      title: "React Developer",
      location: "San Jose, CA",
      dateText: "Not a fit",
      status: "Archived",
      tag: "Not a fit",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      bookmarked: false,
    },
    {
      id: "c16",
      jobId: "senior-frontend-developer",
      name: "Andrew Lee",
      title: "UI Engineer",
      location: "Oakland, CA",
      dateText: "Not a fit",
      status: "Archived",
      tag: "Not a fit",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150",
      bookmarked: false,
    },
    {
      id: "c17",
      jobId: "senior-frontend-developer",
      name: "Taylor Johnson",
      title: "Frontend Engineer",
      location: "San Francisco, CA",
      dateText: "Not a fit",
      status: "Archived",
      tag: "Not a fit",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
      bookmarked: false,
    },

    // Mock candidates for other jobs (Product Designer)
    {
      id: "p1",
      jobId: "product-designer",
      name: "Sophia Martinez",
      title: "Senior UI Designer",
      location: "New York, NY",
      dateText: "1 day ago",
      status: "Saved",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      bookmarked: true,
    },
    {
      id: "p2",
      jobId: "product-designer",
      name: "David Smith",
      title: "UX Researcher",
      location: "Brooklyn, NY",
      dateText: "2 days ago",
      status: "Applied",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      bookmarked: false,
    },
  ],

  selectJob: (jobId) => set({ selectedJobId: jobId }),

      moveCandidate: async (candidateId, targetStatus) => {
        // Update local state first for instant response
        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === candidateId ? { ...c, status: targetStatus } : c
          )
        }));

        try {
          await apiFetch(`/applications/${candidateId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: targetStatus.toUpperCase().replace(' ', '_') }),
          });
        } catch (e) {
          console.warn("Failed to sync candidate status update to database.", e);
        }
      },

      addCandidate: async (jobId, candidateData) => {
        try {
          const dbCandidate = await apiFetch(`/applications/jobs/${jobId}/apply`, {
            method: 'POST',
            body: JSON.stringify({
              name: candidateData.name,
              email: candidateData.email || `${candidateData.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
              phone: candidateData.phone,
              title: candidateData.title,
              location: candidateData.location,
              coverLetter: candidateData.coverLetter,
            }),
          });

          set((state) => ({
            candidates: [...state.candidates, {
              ...candidateData,
              id: dbCandidate.id,
              jobId,
              status: 'Applied',
              bookmarked: false,
              dateText: 'Just now',
              avatar: dbCandidate.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateData.name)}`,
            }]
          }));
        } catch (e) {
          console.warn("Failed to persist new candidate in database.", e);
        }
      },

      addJob: async (jobData) => {
        try {
          // Fetch default category or first available if categoryId not supplied
          const categories = await apiFetch('/jobs/categories');
          const categoryId = categories[0]?.id;

          const dbJob = await apiFetch('/jobs', {
            method: 'POST',
            body: JSON.stringify({
              title: jobData.title,
              location: jobData.location,
              type: jobData.type,
              description: 'Job description placeholder...',
              requirements: ['Requirements...'],
              skills: [],
              categoryId,
            }),
          });

          const newJob: Job = {
            id: dbJob.id,
            title: dbJob.title,
            location: dbJob.location,
            type: dbJob.type,
            posted: "Just now",
            status: "Active",
            color: dbJob.color || "purple",
          };

          set((state) => ({
            jobs: [...state.jobs, newJob],
            selectedJobId: newJob.id,
            activeView: "Applications",
          }));
        } catch (e) {
          console.warn("Failed to persist new job in database.", e);
        }
      },

      toggleBookmark: async (candidateId) => {
        const candidate = get().candidates.find((c) => c.id === candidateId);
        if (!candidate) return;
        const isBookmarked = !candidate.bookmarked;

        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === candidateId ? { ...c, bookmarked: isBookmarked } : c
          )
        }));

        try {
          await apiFetch(`/applications/${candidateId}`, {
            method: 'PUT',
            body: JSON.stringify({ recruiterBookmarked: isBookmarked }),
          });
        } catch (e) {
          console.warn("Failed to update bookmark status in database.", e);
        }
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      markNotificationsAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      clearNotifications: () => set({ notifications: [] }),

      deleteCandidate: async (candidateId) => {
        set((state) => ({
          candidates: state.candidates.filter((c) => c.id !== candidateId),
        }));

        try {
          await apiFetch(`/applications/${candidateId}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.warn("Failed to delete candidate from database.", e);
        }
      },

      setWorkspaceName: (name) => set({ workspaceName: name }),
      setAddCandidateOpen: (open, col = "Saved") => set({ isAddCandidateOpen: open, addCandidateColumn: col }),
      setAddJobOpen: (open) => set({ isAddJobOpen: open }),

      applyToJob: async (jobId, applicant) => {
        try {
          await apiFetch(`/applications/jobs/${jobId}/apply`, {
            method: 'POST',
            body: JSON.stringify(applicant),
          });
          get().fetchInitialData();
        } catch (e) {
          console.warn("Failed to submit applicant data to database.", e);
        }
      },

      fetchInitialData: async () => {
        const role = get().user?.role;
        if (!role) return;

        try {
          if (role === 'RECRUITER') {
            const dbJobs = await apiFetch('/jobs');
            const jobsList: Job[] = dbJobs.map((j: any) => ({
              id: j.id,
              title: j.title,
              location: j.location,
              type: j.type,
              posted: 'Posted ' + new Date(j.createdAt).toLocaleDateString(),
              status: j.status === 'ACTIVE' ? 'Active' : 'Closed',
              color: j.color || 'purple',
            }));

            const dbCandidates = await apiFetch('/applications/candidates');
            const candidatesList: Candidate[] = dbCandidates.map((c: any) => ({
              id: c.id,
              jobId: c.jobId,
              name: c.name,
              email: c.email,
              phone: c.phone,
              title: c.title,
              location: c.location,
              coverLetter: c.coverLetter,
              dateText: new Date(c.appliedAt).toLocaleDateString(),
              status: c.status === 'IN_PROCESS' ? 'In Process' : c.status === 'OFFER' ? 'Offer' : c.status === 'ARCHIVED' ? 'Archived' : c.status === 'SAVED' ? 'Saved' : 'Applied',
              bookmarked: c.recruiterBookmarked,
              avatar: c.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}`,
            }));

            set({
              jobs: jobsList,
              candidates: candidatesList,
              selectedJobId: jobsList[0]?.id || '',
            });
          } else if (role === 'SEEKER') {
            const dbApps = await apiFetch('/applications/my');
            const jobAppsList: JobApplication[] = dbApps.map((a: any) => ({
              id: a.id,
              publicJobId: a.jobId,
              company: a.job.company.name,
              title: a.job.title,
              companyColor: a.job.company.color || 'purple',
              location: a.job.location,
              type: a.job.type,
              salary: a.job.salary || 'Competitive',
              appliedDate: new Date(a.appliedAt).toLocaleDateString(),
              status: a.status === 'IN_PROCESS' ? 'In Process' : a.status === 'OFFER' ? 'Offer' : a.status === 'ARCHIVED' ? 'Archived' : a.status === 'SAVED' ? 'Saved' : 'Applied',
              bookmarked: a.seekerBookmarked,
              recruiterName: a.job.postedBy?.name || 'Hiring Team',
              recruiterAvatar: a.job.postedBy?.avatar || `https://ui-avatars.com/api/?name=Hiring+Team`,
              interviewDate: a.calendarEvents?.[0]?.startTime ? new Date(a.calendarEvents[0].startTime).toLocaleDateString() : undefined,
              offerAmount: a.offerAmount,
              notes: a.notes,
            }));

            const dbDiscover = await apiFetch('/jobs/public');
            const publicJobsList: PublicJob[] = dbDiscover.map((pj: any) => ({
              id: pj.id,
              title: pj.title,
              company: pj.company.name,
              companyColor: pj.company.color || 'purple',
              location: pj.location,
              type: pj.type,
              salary: pj.salary || 'Competitive',
              posted: new Date(pj.createdAt).toLocaleDateString(),
              description: pj.description,
              requirements: pj.requirements || [],
              skills: pj.skills || [],
              benefits: pj.benefits || [],
              featured: pj.featured,
              remote: pj.remote,
            }));

            set({
              jobApplications: jobAppsList,
              publicJobs: publicJobsList,
            });
          }
        } catch (e) {
          console.warn("Failed to load workspace data from backend API.", e);
        }
      },

      moveJobApplication: async (id, status) => {
        set((state) => ({
          jobApplications: state.jobApplications.map((a) =>
            a.id === id ? { ...a, status } : a
          )
        }));

        try {
          await apiFetch(`/applications/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: status.toUpperCase().replace(' ', '_') }),
          });
        } catch (e) {
          console.warn("Failed to sync application status update to database.", e);
        }
      },

      toggleJobBookmark: async (id) => {
        const app = get().jobApplications.find((a) => a.id === id);
        if (!app) return;
        const isBookmarked = !app.bookmarked;

        set((state) => ({
          jobApplications: state.jobApplications.map((a) =>
            a.id === id ? { ...a, bookmarked: isBookmarked } : a
          )
        }));

        try {
          await apiFetch(`/applications/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ seekerBookmarked: isBookmarked }),
          });
        } catch (e) {
          console.warn("Failed to update bookmark status in database.", e);
        }
      },

      applyFromDiscover: async (publicJobId) => {
        const seeker = get().user;
        if (!seeker) return;

        try {
          const appData = {
            name: seeker.name || 'Anonymous Seeker',
            email: seeker.email,
            title: 'Software Developer',
            location: 'Remote',
          };

          await apiFetch(`/applications/jobs/${publicJobId}/apply`, {
            method: 'POST',
            body: JSON.stringify(appData),
          });

          get().fetchInitialData();
        } catch (e) {
          console.warn("Failed to apply to job.", e);
        }
      },

      saveJobFromDiscover: async (publicJobId) => {
        const seeker = get().user;
        if (!seeker) return;

        try {
          const appData = {
            name: seeker.name || 'Anonymous Seeker',
            email: seeker.email,
            title: 'Software Developer',
            location: 'Remote',
          };

          await apiFetch(`/applications/jobs/${publicJobId}/save`, {
            method: 'POST',
            body: JSON.stringify(appData),
          });

          get().fetchInitialData();
        } catch (e) {
          console.warn("Failed to save job.", e);
        }
      },
    }));
