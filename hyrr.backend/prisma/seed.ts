import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Job Categories ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Software Development',      slug: 'software-development' },
  { name: 'Data Science & Analytics',  slug: 'data-science-analytics' },
  { name: 'Design & Creative',         slug: 'design-creative' },
  { name: 'Product Management',        slug: 'product-management' },
  { name: 'DevOps & Infrastructure',   slug: 'devops-infrastructure' },
  { name: 'Cybersecurity',             slug: 'cybersecurity' },
  { name: 'Marketing & Growth',        slug: 'marketing-growth' },
  { name: 'Sales & Business Dev',      slug: 'sales-business-dev' },
  { name: 'Finance & Accounting',      slug: 'finance-accounting' },
  { name: 'Human Resources',           slug: 'human-resources' },
  { name: 'Customer Success',          slug: 'customer-success' },
  { name: 'Legal & Compliance',        slug: 'legal-compliance' },
  { name: 'Operations & Logistics',    slug: 'operations-logistics' },
  { name: 'Healthcare & Medical',      slug: 'healthcare-medical' },
  { name: 'Education & Training',      slug: 'education-training' },
  { name: 'Content & Copywriting',     slug: 'content-copywriting' },
  { name: 'Machine Learning & AI',     slug: 'machine-learning-ai' },
  { name: 'Mobile Development',        slug: 'mobile-development' },
  { name: 'QA & Testing',              slug: 'qa-testing' },
  { name: 'Project Management',        slug: 'project-management' },
  { name: 'Cloud Architecture',        slug: 'cloud-architecture' },
  { name: 'Blockchain & Web3',         slug: 'blockchain-web3' },
  { name: 'Research & Development',    slug: 'research-development' },
  { name: 'Administration & Support',  slug: 'administration-support' },
];

// ─── Demo companies ────────────────────────────────────────────────────────────
const COMPANIES = [
  { name: 'Acme Corp',     logo: 'A', country: 'United States' },
  { name: 'Nexus Labs',    logo: 'N', country: 'United States' },
  { name: 'Stellar Inc',   logo: 'S', country: 'United States' },
  { name: 'Orbit Systems', logo: 'O', country: 'United States' },
];

// ─── Demo recruiter accounts ──────────────────────────────────────────────────
const RECRUITERS = [
  { name: 'Alex Johnson', email: 'alex@acme.com',       company: 0, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' },
  { name: 'Sara Chen',    email: 'sara@nexuslabs.io',   company: 1, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
  { name: 'Marcus Reed',  email: 'marcus@stellar.io',   company: 2, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
  { name: 'Layla Ahmed',  email: 'layla@orbit.tech',    company: 3, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
];

// ─── Demo seeker ──────────────────────────────────────────────────────────────
const SEEKER = {
  name: 'Jordan Smith',
  email: 'jordan@example.com',
  password: 'Password123!',
  avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
};

async function main() {
  console.log('🌱  Seeding database…');

  // 1. Upsert categories
  console.log('  → Categories');
  for (const cat of CATEGORIES) {
    await prisma.jobCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
  }
  console.log(`     ✓ ${CATEGORIES.length} categories`);

  // 2. Upsert demo companies (using query-then-create as Company name/domain is not unique in DB)
  console.log('  → Companies');
  const companies: any[] = [];
  for (const co of COMPANIES) {
    let c = await prisma.company.findFirst({
      where: { name: co.name },
    });
    if (!c) {
      c = await prisma.company.create({
        data: {
          name: co.name,
          logo: co.logo,
          country: co.country,
        },
      });
    }
    companies.push(c);
  }
  console.log(`     ✓ ${companies.length} companies`);

  // 3. Upsert recruiter users
  console.log('  → Recruiter accounts');
  const hash = await bcrypt.hash('Password123!', 10);
  const recruiterUsers: any[] = [];
  for (const r of RECRUITERS) {
    const u = await prisma.user.upsert({
      where: { email: r.email },
      update: {
        name: r.name,
        avatar: r.avatar,
        companyId: companies[r.company].id,
      },
      create: {
        name: r.name,
        email: r.email,
        passwordHash: hash,
        avatar: r.avatar,
        role: 'RECRUITER',
        companyId: companies[r.company].id,
      },
    });
    recruiterUsers.push(u);
  }
  console.log(`     ✓ ${recruiterUsers.length} recruiters`);

  // 4. Upsert seeker
  console.log('  → Seeker account');
  const seekerHash = await bcrypt.hash(SEEKER.password, 10);
  const seeker = await prisma.user.upsert({
    where: { email: SEEKER.email },
    update: {
      name: SEEKER.name,
      avatar: SEEKER.avatar,
    },
    create: {
      name: SEEKER.name,
      email: SEEKER.email,
      passwordHash: seekerHash,
      avatar: SEEKER.avatar,
      role: 'SEEKER',
    },
  });
  console.log(`     ✓ seeker: ${seeker.email}`);

  // 5. Demo job postings
  console.log('  → Demo jobs');
  const cats = await prisma.jobCategory.findMany();
  const catMap = Object.fromEntries(cats.map((c: { slug: any; id: any; }) => [c.slug, c.id]));
  const COLORS = ['purple', 'blue', 'green', 'orange'];

  const DEMO_JOBS = [
    {
      title: 'Senior Frontend Engineer',
      location: 'San Francisco, CA',
      type: 'Full Time',
      salary: '$140k – $180k',
      description: 'Join our product engineering team building beautiful, performant web interfaces used by millions of users every day. You will own key product surfaces, mentor junior engineers, and collaborate closely with design and product.',
      requirements: ['5+ years React experience', 'TypeScript proficiency', 'GraphQL knowledge', 'Strong CSS/layout skills'],
      skills: ['React', 'TypeScript', 'GraphQL', 'CSS', 'Vite'],
      benefits: ['Hybrid flexible', 'Equity package', 'Full health insurance', '$2k learning budget'],
      categorySlug: 'software-development',
      recruiterIdx: 0, companyIdx: 0, featured: true, remote: false,
    },
    {
      title: 'ML Engineer – NLP',
      location: 'Remote',
      type: 'Remote',
      salary: '$160k – $210k',
      description: 'Work on cutting-edge large language model fine-tuning, inference optimization, and deployment pipelines powering our AI-first product suite.',
      requirements: ['PhD or MS in CS/ML', '3+ years PyTorch', 'LLM fine-tuning experience', 'Production model deployment'],
      skills: ['Python', 'PyTorch', 'LLMs', 'CUDA', 'MLflow', 'HuggingFace'],
      benefits: ['Unlimited PTO', 'Conference budget', 'High-end GPU workstation', 'Remote-first'],
      categorySlug: 'machine-learning-ai',
      recruiterIdx: 1, companyIdx: 1, featured: true, remote: true,
    },
    {
      title: 'Product Designer (UI/UX)',
      location: 'New York, NY',
      type: 'Full Time',
      salary: '$110k – $145k',
      description: 'Shape end-to-end experiences from discovery research to pixel-perfect Figma deliverables. You will own the design system and work across web and mobile surfaces.',
      requirements: ['4+ years product design', 'Figma expertise', 'User research experience', 'Design systems knowledge'],
      skills: ['Figma', 'Prototyping', 'Design Systems', 'User Research', 'Motion Design'],
      benefits: ['Creative stipend', 'Flexible hybrid', 'Health & dental', 'Annual retreat'],
      categorySlug: 'design-creative',
      recruiterIdx: 2, companyIdx: 2, featured: false, remote: false,
    },
    {
      title: 'DevOps / Platform Engineer',
      location: 'Austin, TX',
      type: 'Full Time',
      salary: '$130k – $165k',
      description: 'Own the reliability, scalability, and security of our cloud-native microservices platform running on AWS. You will build golden paths for developers and drive platform excellence.',
      requirements: ['Kubernetes expertise', 'Terraform/IaC proficiency', 'CI/CD pipeline ownership', 'Monitoring & observability'],
      skills: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'Helm', 'ArgoCD'],
      benefits: ['Remote option', 'Stock options', '401k match', 'Home office stipend'],
      categorySlug: 'devops-infrastructure',
      recruiterIdx: 3, companyIdx: 3, featured: false, remote: false,
    },
    {
      title: 'Growth Marketing Manager',
      location: 'Remote',
      type: 'Remote',
      salary: '$95k – $125k',
      description: 'Lead paid acquisition, SEO, lifecycle marketing, and A/B experimentation across our B2B funnel. You will own MQL targets and work across channels to drive pipeline growth.',
      requirements: ['5+ years growth marketing', 'Google Ads & Meta Ads mastery', 'SQL for analytics', 'B2B SaaS experience'],
      skills: ['Google Ads', 'HubSpot', 'SQL', 'A/B Testing', 'SEO', 'Content Strategy'],
      benefits: ['Fully remote', '$5k marketing test budget', 'Annual company retreat', 'Equity'],
      categorySlug: 'marketing-growth',
      recruiterIdx: 0, companyIdx: 0, featured: false, remote: true,
    },
    {
      title: 'Data Analyst',
      location: 'Chicago, IL',
      type: 'Full Time',
      salary: '$85k – $110k',
      description: 'Turn raw data into actionable insights that drive product and business decisions. You will partner with product, engineering, and leadership to build dashboards and run analyses.',
      requirements: ['SQL mastery', 'Python/pandas experience', 'BI tool expertise (Looker or Tableau)', 'Statistical analysis'],
      skills: ['SQL', 'Python', 'Looker', 'dbt', 'BigQuery', 'Tableau'],
      benefits: ['Learning budget', 'Health insurance', 'Hybrid work', 'Team offsites'],
      categorySlug: 'data-science-analytics',
      recruiterIdx: 1, companyIdx: 1, featured: false, remote: false,
    },
    {
      title: 'iOS Engineer',
      location: 'Seattle, WA',
      type: 'Full Time',
      salary: '$150k – $185k',
      description: 'Build a delightful, high-performance iOS app serving tens of thousands of daily active users. You will own core features end-to-end from design review through App Store delivery.',
      requirements: ['4+ years Swift', 'UIKit & SwiftUI proficiency', 'App Store release experience', 'Performance profiling'],
      skills: ['Swift', 'SwiftUI', 'Xcode', 'Combine', 'CoreData', 'XCTest'],
      benefits: ['ESPP', 'Relocation bonus', 'Gym membership', 'Top-of-market comp'],
      categorySlug: 'mobile-development',
      recruiterIdx: 2, companyIdx: 2, featured: true, remote: false,
    },
    {
      title: 'Technical Product Manager',
      location: 'Remote',
      type: 'Remote',
      salary: '$125k – $155k',
      description: 'Own the roadmap for our developer-facing API platform, collaborating tightly with engineering, design, and customers to ship features that developers love.',
      requirements: ['3+ years technical PM', 'REST/GraphQL API knowledge', 'Roadmapping & prioritization', 'Agile/Scrum'],
      skills: ['Jira', 'Roadmapping', 'API Design', 'SQL', 'Agile', 'Stakeholder Management'],
      benefits: ['Remote-first culture', 'Equity grant', 'Home office stipend', 'Learning budget'],
      categorySlug: 'product-management',
      recruiterIdx: 3, companyIdx: 3, featured: false, remote: true,
    },
  ];

  for (let i = 0; i < DEMO_JOBS.length; i++) {
    const j = DEMO_JOBS[i];
    const existing = await prisma.job.findFirst({
      where: { title: j.title, companyId: companies[j.companyIdx].id },
    });
    if (existing) { console.log(`     ~ skip: "${j.title}" already exists`); continue; }

    await prisma.job.create({
      data: {
        title:       j.title,
        location:    j.location,
        type:        j.type,
        salary:      j.salary,
        description: j.description,
        requirements:j.requirements,
        skills:      j.skills,
        benefits:    j.benefits,
        categoryId:  catMap[j.categorySlug],
        companyId:   companies[j.companyIdx].id,
        recruiterId: recruiterUsers[j.recruiterIdx].id,
        featured:    j.featured,
        remote:      j.remote,
        color:       COLORS[i % COLORS.length],
        status:      'ACTIVE',
      },
    });
    console.log(`     ✓ "${j.title}"`);
  }

  console.log('\n✅  Seed complete!');
  console.log('   Seeker   → jordan@example.com  /  Password123!');
  console.log('   Recruiter→ alex@acme.com        /  Password123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
