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

  pricing: {
    file: "Pricing.tsx",
    description: "Three-tier pricing with a highlighted plan",
    props: "heading, plans: {name, price, period, features[], cta, href, featured?}[]",
    render: () => `interface Plan {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta?: string;
  href?: string;
  featured?: boolean;
}

interface PricingProps {
  heading?: string;
  plans?: Plan[];
}

const DEFAULT_PLANS: Plan[] = [
  { name: "Starter", price: "$0", period: "/mo", features: ["Feature one", "Feature two"], cta: "Start free", href: "#" },
  { name: "Pro", price: "$19", period: "/mo", features: ["Everything in Starter", "Feature three", "Feature four"], cta: "Go Pro", href: "#", featured: true },
  { name: "Team", price: "$49", period: "/mo", features: ["Everything in Pro", "Feature five"], cta: "Contact us", href: "#" },
];

export default function Pricing({ heading = "Pricing", plans = DEFAULT_PLANS }: PricingProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16 text-center">
          {heading}
        </h2>
        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={\`reveal rounded-2xl border p-6 md:p-8 flex flex-col \${p.featured ? "border-white/30 bg-white/5" : "border-white/10"}\`}
            >
              <h3 className="text-[11px] tracking-[0.2em] opacity-40 uppercase mb-4">{p.name}</h3>
              <p className="mb-6">
                <span className="text-4xl md:text-5xl font-bold">{p.price}</span>
                {p.period && <span className="opacity-40 text-sm">{p.period}</span>}
              </p>
              <ul className="flex flex-col gap-2.5 mb-8 text-sm opacity-70">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="opacity-50">✓</span>{f}</li>
                ))}
              </ul>
              <a href={p.href ?? "#"} className={\`mt-auto text-center rounded-full py-3 text-[11px] tracking-[0.2em] uppercase transition-colors \${p.featured ? "bg-white text-black hover:opacity-85" : "border border-white/20 hover:border-white/50"}\`}>
                {p.cta ?? "Choose"}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  faq: {
    file: "Faq.tsx",
    description: "Accordion Q&A (native details, zero JS)",
    props: "heading, items: {q, a}[]",
    render: () => `interface FaqItem {
  q: string;
  a: string;
}

interface FaqProps {
  heading?: string;
  items?: FaqItem[];
}

const DEFAULT_ITEMS: FaqItem[] = [
  { q: "First common question?", a: "Clear, honest answer in one or two sentences." },
  { q: "Second common question?", a: "Another clear answer. No marketing fluff." },
];

export default function Faq({ heading = "Questions", items = DEFAULT_ITEMS }: FaqProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-3xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16 text-center">
          {heading}
        </h2>
        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <details key={it.q} className="reveal group rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 open:bg-white/[0.04]">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {it.q}
                <span className="opacity-40 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm opacity-60 leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  testimonials: {
    file: "Testimonials.tsx",
    description: "Quote cards grid",
    props: "heading, quotes: {quote, name, role}[]",
    render: () => `interface Quote {
  quote: string;
  name: string;
  role?: string;
}

interface TestimonialsProps {
  heading?: string;
  quotes?: Quote[];
}

const DEFAULT_QUOTES: Quote[] = [
  { quote: "It just works. The whole team switched in a week.", name: "Jane Doe", role: "CTO, Example" },
  { quote: "The fastest tool we have ever adopted.", name: "John Smith", role: "Founder, Sample" },
];

export default function Testimonials({ heading = "Loved by builders", quotes = DEFAULT_QUOTES }: TestimonialsProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16 text-center">
          {heading}
        </h2>
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
            <figure key={q.name} className="reveal rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex flex-col gap-4">
              <blockquote className="text-base leading-relaxed opacity-80">“{q.quote}”</blockquote>
              <figcaption className="mt-auto">
                <p className="font-semibold text-sm">{q.name}</p>
                {q.role && <p className="text-xs opacity-40 mt-0.5">{q.role}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  gallery: {
    file: "Gallery.tsx",
    description: "Image strip grid for screenshots / lookbook",
    props: "heading, images: {src, alt}[]",
    render: () => `interface GalleryImage {
  src: string;
  alt?: string;
}

interface GalleryProps {
  heading?: string;
  images?: GalleryImage[];
}

const DEFAULT_IMAGES: GalleryImage[] = [
  { src: "/shots/shot-1.jpg", alt: "Screenshot 1" },
  { src: "/shots/shot-2.jpg", alt: "Screenshot 2" },
  { src: "/shots/shot-3.jpg", alt: "Screenshot 3" },
];

export default function Gallery({ heading = "In the wild", images = DEFAULT_IMAGES }: GalleryProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-10 md:mb-16">
          {heading}
        </h2>
        <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <div key={img.src} className="reveal overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-105" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  features: {
    file: "Features.tsx",
    description: "Benefit cards grid — the core of any landing page",
    props: "heading, sub, features: {title, desc, icon?}[]",
    render: () => `interface Feature {
  title: string;
  desc: string;
  icon?: string;
}

interface FeaturesProps {
  heading?: string;
  sub?: string;
  features?: Feature[];
}

const DEFAULT_FEATURES: Feature[] = [
  { title: "Fast by default", desc: "Optimized from the first byte. No spinners, no waiting.", icon: "⚡" },
  { title: "Beautiful out of the box", desc: "Design system included. Every pixel considered.", icon: "✦" },
  { title: "Yours to own", desc: "Plain code, no lock-in. Change anything.", icon: "◈" },
];

export default function Features({
  heading = "Why it hits different",
  sub = "Everything you need, nothing you don't.",
  features = DEFAULT_FEATURES,
}: FeaturesProps) {
  return (
    <section id="features" className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-40 text-center">
        <h2 className="reveal text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em]">
          {heading}
        </h2>
        <p className="reveal mt-4 text-base md:text-lg opacity-50 max-w-xl mx-auto">{sub}</p>
        <div className="mt-10 md:mt-16 grid gap-4 md:gap-6 md:grid-cols-3 text-left">
          {features.map((f) => (
            <div key={f.title} className="reveal rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8 hover:border-white/25 transition-colors">
              {f.icon && <p className="text-2xl mb-4">{f.icon}</p>}
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm opacity-60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  },

  cta: {
    file: "CtaBand.tsx",
    description: "Full-width conversion band with headline + button",
    props: "heading, accent, label, href",
    render: () => `interface CtaBandProps {
  heading?: string;
  accent?: string;
  label?: string;
  href?: string;
}

export default function CtaBand({
  heading = "Ready when you are.",
  accent = "One click starts everything.",
  label = "GET STARTED",
  href = "#start",
}: CtaBandProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="reveal rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 md:py-24 text-center overflow-hidden">
          <h2 className="text-[clamp(2rem,6vw,4.5rem)] font-bold leading-[1] tracking-[-0.03em]">
            {heading}<br />
            <span className="opacity-30">{accent}</span>
          </h2>
          <a href={href} className="magnetic-btn mt-8 md:mt-10">
            <span>{label}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
`,
  },

  logos: {
    file: "LogoCloud.tsx",
    description: "Social-proof logo strip",
    props: "caption, logos: string[]",
    render: () => `interface LogoCloudProps {
  caption?: string;
  logos?: string[];
}

const DEFAULT_LOGOS = ["ACME", "Globex", "Initech", "Umbrella", "Hooli"];

export default function LogoCloud({ caption = "TRUSTED BY TEAMS THAT SHIP", logos = DEFAULT_LOGOS }: LogoCloudProps) {
  return (
    <section className="relative z-10">
      <div className="mx-auto max-w-6xl px-5 py-12 md:py-16 text-center">
        <p className="reveal text-[10px] md:text-[11px] tracking-[0.25em] opacity-30 mb-8">{caption}</p>
        <div className="reveal flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {logos.map((l) => (
            <span key={l} className="text-lg md:text-xl font-bold tracking-tight opacity-25 hover:opacity-60 transition-opacity select-none">
              {l}
            </span>
          ))}
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
