import Link from "next/link"
import "./career.css"

export default function CareerRoom({ eyebrow, title, description, children }: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="ml-career ml-room ml-container">
      <header className="ml-room-heading">
        <Link href="/practice" className="ml-career-back">← Career Lab</Link>
        <p className="ml-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="ml-room-description">{description}</p>
      </header>
      <div className="ml-training">{children}</div>
    </div>
  )
}
