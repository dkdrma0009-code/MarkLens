import Link from "next/link"
import Wordmark from "@/components/brand/Wordmark"

const groups = [
  { title: "Explore", links: [["Insights", "/insights"], ["Trends", "/#signals"], ["Collections", "/#collections"], ["Dictionary", "/glossary"]] },
  { title: "Career", links: [["Career Lab", "/practice"], ["AI Interview", "/interview"], ["Learn", "/learn"], ["Insight Lab", "/insight-lab"]] },
  { title: "About", links: [["MarkLens 소개", "/about"], ["Weekly", "/newsletter"], ["피드백", "/feedback"], ["RSS", "/feed.xml"]] },
]

export default function Footer() {
  return (
    <footer className="ml-footer">
      <div className="ml-container">
        <div className="ml-footer-top">
          <div className="ml-footer-brand">
            <Link href="/#main-content" className="ml-logo" aria-label="MarkLens 홈"><Wordmark reverse /></Link>
            <p>Where Marketing Trends<br />Become Action</p>
            <div className="ml-footer-social"><a href="https://www.instagram.com/marklens.site" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.threads.com/@marklens.site" target="_blank" rel="noopener noreferrer">Threads ↗</a></div>
          </div>
          {groups.map(group => <nav key={group.title} aria-label={group.title}><h2>{group.title}</h2>{group.links.map(([label, href]) => href.includes("#") ? <a key={href} href={href}>{label}</a> : <Link key={href} href={href}>{label}</Link>)}</nav>)}
        </div>
        <div className="ml-footer-bottom"><span>© {new Date().getFullYear()} MarkLens</span><span>Marketing × Trend × Intelligence</span></div>
      </div>
    </footer>
  )
}
