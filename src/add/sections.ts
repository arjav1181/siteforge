export interface SectionDef {
  /** Component file name under the target components dir */
  file: string;
  description: string;
  /** Props the component accepts */
  props: string;
  render(): string;
}

const REVEAL_NOTE = `{/* Add className="reveal" to elements you want to animate in on scroll (needs siteforge.css) */}`;

export const SECTIONS: Record<string, SectionDef> = {
  hero: {
    file: "Hero.tsx",
    description: "Centered massive display name + tagline + CTA button + scroll hint",
    props: "name, tagline, ctaLabel, ctaHref",
    render: () => `"use client";

import { useEffect, useState } from "react";

interface HeroProps {
  name?: string;
  tagline?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function Hero({
  name = "YOUR NAME",
  tagline = "Your tagline goes here.",
  ctaLabel = "VIEW WORK",
  ctaHref = "#work",
}: HeroProps) {
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const onScroll = () => setShowHint(window.scrollY <= 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative z-10 flex h-screen flex-col items-center justify-center px-5">
      <div className="relative text-center w-full max-w-4xl mx-auto">
        <h1
          className="font-extrabold uppercase leading-[0.88] tracking-[-0.04em]"
          style={{ fontSize: "clamp(3rem, 12vw, 14rem)" }}
        >
          {name}
        </h1>
        <div className="mt-6 md:mt-10 flex flex-col items-center gap-4 md:gap-5">
          <p className="text-[clamp(13px,1.5vw,18px)] opacity-50 max-w-sm md:max-w-md leading-relaxed">
            {tagline}
          </p>
          <a href={ctaHref} className="magnetic-btn mt-2">
            <span>{ctaLabel}</span>
          </a>
        </div>
      </div>

      <div className={\`pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 transition-all duration-700 \${showHint ? "opacity-100" : "opacity-0"}\`}>
        <div className="flex h-10 w-[1px] justify-center overflow-hidden bg-white/15">
          <div className="h-6 w-full animate-[scrollHint_1.6s_ease-in-out_infinite] bg-white/60" />
        </div>
      </div>

      <style>{\`
        @keyframes scrollHint {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(250%); }
        }
      \`}</style>
    </section>
  );
}
`,
  },

  "hero-grid": {
    file: "HeroGrid.tsx",
    description: "Name repeated in a fading grid across the hero, main name centered",
    props: "name, tagline, rows, cols",
    render: () => `interface HeroGridProps {
  name?: string;
  tagline?: string;
  rows?: number;
  cols?: number;
}

export default function HeroGrid({ name = "YOURNAME", tagline = "Your tagline goes here.", rows = 9, cols = 7 }: HeroGridProps) {
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);
  return (
    <section className="relative z-10 flex h-screen flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex flex-col justify-center pointer-events-none select-none" aria-hidden="true">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex justify-center whitespace-nowrap" style={{ gap: "clamp(8px, 1.5vw, 20px)" }}>
            {Array.from({ length: cols }).map((_, col) => {
              const dist = Math.abs(row - midR) + Math.abs(col - midC);
              if (dist === 0) return <span key={col} style={{ fontSize: "clamp(2rem, 5.5vw, 7rem)", lineHeight: 1 }} />;
              return (
                <span
                  key={col}
                  className="font-extrabold uppercase tracking-[-0.04em]"
                  style={{
                    fontSize: "clamp(2rem, 5.5vw, 7rem)",
                    lineHeight: 1,
                    opacity: Math.max(0.03, 0.12 - dist * 0.015),
                  }}
                >
                  {name}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="relative text-center px-5">
        <h1
          className="font-extrabold uppercase leading-[0.88] tracking-[-0.04em]"
          style={{ fontSize: "clamp(3rem, 12vw, 14rem)" }}
        >
          {name}
        </h1>
        <p className="mt-6 text-[clamp(13px,1.5vw,18px)] opacity-50 max-w-md mx-auto leading-relaxed">
          {tagline}
        </p>
      </div>
    </section>
  );
}
`,
  },

  navbar: {
    file: "Navbar.tsx",
    description: "Fixed mix-blend-difference bar: logo, links, mobile hamburger menu",
    props: "logo, links: {label, href}[]",
    render: () => `"use client";

import { useEffect, useState } from "react";

interface NavLink {
  label: string;
  href: string;
}

interface NavbarProps {
  logo?: string;
  links?: NavLink[];
}

const DEFAULT_LINKS: NavLink[] = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar({ logo = "A.", links = DEFAULT_LINKS }: NavbarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setOpen(false); };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 mix-blend-difference">
      <div className="flex items-center justify-between px-5 py-4 md:px-8 md:py-5">
        <a href="#" className="text-[13px] font-bold tracking-[0.08em] uppercase">
          {logo}
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[11px] tracking-[0.15em] opacity-50 hover:opacity-100 transition-opacity uppercase">
              {l.label}
            </a>
          ))}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-[5px] w-6 p-0 bg-transparent border-none cursor-pointer"
          aria-label="Toggle menu"
        >
          <span className={\`block h-[1.5px] w-full bg-white transition-all duration-300 \${open ? "translate-y-[6.5px] rotate-45" : ""}\`} />
          <span className={\`block h-[1.5px] w-full bg-white transition-all duration-300 \${open ? "opacity-0" : ""}\`} />
          <span className={\`block h-[1.5px] w-full bg-white transition-all duration-300 \${open ? "-translate-y-[6.5px] -rotate-45" : ""}\`} />
        </button>
      </div>
      <div className={\`md:hidden overflow-hidden transition-all duration-300 \${open ? "max-h-72" : "max-h-0"}\`}>
        <div className="flex flex-col gap-4 px-5 pb-6">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-[13px] tracking-[0.15em] opacity-60 uppercase">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
`,
  },

  about: {
    file: "About.tsx",
    description: "Two-column statement + bio + stat counters",
    props: "heading, accent, paragraphs, stats",
    render: () => `interface Stat {
  value: string;
  label: string;
}

interface AboutProps {
  heading?: string;
  accent?: string;
  paragraphs?: string[];
  stats?: Stat[];
}

export default function About({
  heading = "I build things",
  accent = "that think for themselves.",
  paragraphs = [
    "Short bio paragraph one. Who you are and what you obsess over.",
    "Short bio paragraph two. What you ship and how you work.",
  ],
  stats = [
    { value: "10+", label: "PROJECTS" },
    { value: "2+", label: "YEARS" },
    { value: "3+", label: "SHIPPED" },
  ],
}: AboutProps) {
  return (
    <section id="about" className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <div className="grid gap-12 md:grid-cols-2 md:gap-24">
          <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em]">
            {heading}<br />
            <span className="opacity-40">{accent}</span>
          </h2>
          <div className="flex flex-col justify-center gap-5">
            {paragraphs.map((p, i) => (
              <p key={i} className="reveal text-base md:text-lg leading-relaxed opacity-60">{p}</p>
            ))}
            <div className="reveal mt-4 flex gap-6 md:gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl md:text-3xl font-bold">{s.value}</p>
                  <p className="text-[10px] md:text-[11px] tracking-[0.15em] opacity-30 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`,
  },

  work: {
    file: "Work.tsx",
    description: "Project card grid — supports demo videos or numbered placeholders",
    props: "heading, projects: {title, desc, tags, demo?, poster?}[]",
    render: () => `interface Project {
  title: string;
  desc: string;
  tags: string[];
  demo?: string;
  poster?: string;
}

interface WorkProps {
  heading?: string;
  projects?: Project[];
}

const DEFAULT_PROJECTS: Project[] = [
  { title: "Project One", desc: "What it does and why it matters.", tags: ["React", "AI"] },
  { title: "Project Two", desc: "What it does and why it matters.", tags: ["TypeScript", "Node.js"] },
];

export default function Work({ heading = "Selected Work", projects = DEFAULT_PROJECTS }: WorkProps) {
  return (
    <section id="work" className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16">
          {heading}
        </h2>
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {projects.map((p, i) => (
            <div key={i} className="reveal project-card group cursor-pointer overflow-hidden">
              <div className="aspect-[16/10] overflow-hidden bg-black/60">
                {p.demo ? (
                  <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={p.poster}>
                    <source src={p.demo} type="video/mp4" />
                  </video>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-[clamp(2.5rem,6vw,5rem)] font-bold opacity-10 select-none">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                )}
              </div>
              <div className="project-overlay p-4 md:p-6">
                <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2 md:mb-3">
                  {p.tags.map((t) => (
                    <span key={t} className="text-[9px] md:text-[10px] tracking-[0.1em] opacity-50 bg-white/10 px-2 py-1 rounded">{t}</span>
                  ))}
                </div>
                <h3 className="text-base md:text-xl font-semibold mb-1">{p.title}</h3>
                <p className="text-xs md:text-sm opacity-50 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  skills: {
    file: "Skills.tsx",
    description: "Categorized skill tag groups",
    props: "heading, groups: {category, items[]}[]",
    render: () => `interface SkillGroup {
  category: string;
  items: string[];
}

interface SkillsProps {
  heading?: string;
  groups?: SkillGroup[];
}

const DEFAULT_GROUPS: SkillGroup[] = [
  { category: "Category One", items: ["Skill A", "Skill B", "Skill C"] },
  { category: "Category Two", items: ["Skill D", "Skill E", "Skill F"] },
];

export default function Skills({ heading = "Skills & Tools", groups = DEFAULT_GROUPS }: SkillsProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16">
          {heading}
        </h2>
        <div className="grid gap-8 md:gap-12 md:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => (
            <div key={g.category} className="reveal">
              <h3 className="text-[10px] md:text-[11px] tracking-[0.2em] opacity-40 mb-3 md:mb-4 uppercase">{g.category}</h3>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {g.items.map((item) => (
                  <span key={item} className="skill-tag rounded-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm opacity-70 bg-white/5 border border-white/10">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  experience: {
    file: "Experience.tsx",
    description: "Vertical timeline of roles",
    props: "heading, roles: {role, company, period, desc}[]",
    render: () => `interface Role {
  role: string;
  company: string;
  period: string;
  desc: string;
}

interface ExperienceProps {
  heading?: string;
  roles?: Role[];
}

const DEFAULT_ROLES: Role[] = [
  { role: "Your Role", company: "Company", period: "2024 — Present", desc: "What you did and what it achieved." },
];

export default function Experience({ heading = "Experience", roles = DEFAULT_ROLES }: ExperienceProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16">
          {heading}
        </h2>
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/10" />
          <div className="flex flex-col gap-10 md:gap-12">
            {roles.map((e, i) => (
              <div key={i} className="reveal timeline-item relative flex gap-5 md:gap-8 group">
                <div className="timeline-dot relative z-10 mt-2 h-[15px] w-[15px] shrink-0 rounded-full border border-white/20 bg-black group-hover:border-white/60 transition-colors" />
                <div className="min-w-0">
                  <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3 mb-1">
                    <h3 className="text-base md:text-xl font-semibold">{e.role}</h3>
                    <span className="text-[10px] md:text-[11px] tracking-[0.1em] opacity-40">@ {e.company}</span>
                  </div>
                  <p className="text-[10px] md:text-[11px] tracking-[0.1em] opacity-30 mb-2 md:mb-3">{e.period}</p>
                  <p className="text-sm md:text-base opacity-50 leading-relaxed">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
`,
  },

  contact: {
    file: "Contact.tsx",
    description: "Big CTA + social links + footer",
    props: "heading, accent, email, socials, copyright",
    render: () => `interface Social {
  name: string;
  url: string;
}

interface ContactProps {
  heading?: string;
  accent?: string;
  email?: string;
  socials?: Social[];
  copyright?: string;
}

export default function Contact({
  heading = "Let's build",
  accent = "something great.",
  email = "hello@example.com",
  socials = [
    { name: "GitHub", url: "#" },
    { name: "LinkedIn", url: "#" },
    { name: "Twitter", url: "#" },
  ],
  copyright = "© 2026 YOU",
}: ContactProps) {
  return (
    <section id="contact" className="relative z-20 bg-black">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40 text-center">
        <h2 className="reveal text-[clamp(2rem,8vw,6rem)] font-bold leading-[1] tracking-[-0.03em] mb-6 md:mb-8">
          {heading}<br />
          <span className="opacity-30">{accent}</span>
        </h2>
        <div className="reveal">
          <a href={\`mailto:\${email}\`} className="magnetic-btn">
            <span>GET IN TOUCH</span>
          </a>
        </div>
        <div className="reveal mt-16 md:mt-20 flex justify-center gap-6 md:gap-8">
          {[...socials, { name: "Email", url: \`mailto:\${email}\` }].map((s) => (
            <a key={s.name} href={s.url} className="social-link text-[10px] md:text-[11px] tracking-[0.15em] opacity-30 hover:opacity-100 transition-opacity py-2 px-1">
              {s.name.toUpperCase()}
            </a>
          ))}
        </div>
        <div className="reveal mt-16 md:mt-24 pt-8 border-t border-white/5">
          <p className="text-[10px] tracking-[0.15em] opacity-20">{copyright}</p>
        </div>
      </div>
    </section>
  );
}
`,
  },
};

/** Shared stylesheet backing reveal/buttons/cards/timeline (append-safe). */
export function renderSharedCss(): string {
  return `/* ── siteforge shared ─────────────────────────────────────────── */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.visible { opacity: 1; transform: translateY(0); }

.magnetic-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 28px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fff;
  text-decoration: none;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  max-width: 100%;
}
.magnetic-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.magnetic-btn:hover::before { transform: translateY(0); }
.magnetic-btn:hover { color: #000; border-color: #fff; }
.magnetic-btn span { position: relative; z-index: 1; }

.project-card { position: relative; overflow: hidden; transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.project-card:hover { transform: translateY(-8px); }
.project-overlay {
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%);
}
.project-card:hover .project-overlay { opacity: 1; transform: translateY(0); }
@media (hover: none) {
  .project-overlay { opacity: 1; transform: translateY(0); }
}

.skill-tag { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.skill-tag:hover { border-color: rgba(255,255,255,0.25); transform: translateY(-2px); }

.timeline-dot { position: relative; }
.timeline-dot::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  opacity: 0;
  transition: opacity 0.4s ease;
}
.timeline-item:hover .timeline-dot::before { opacity: 1; }

.social-link { position: relative; transition: opacity 0.3s ease; }

.grid > * { min-width: 0; }
`;
}

// Re-export note for template consumers (keeps REVEAL_NOTE referenced).
export { REVEAL_NOTE };
