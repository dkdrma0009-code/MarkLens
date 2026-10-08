import Link from "next/link"

export default function PublicNotFound() {
  return (
    <div className="ml-pages"><div className="ml-state ml-container">
      <p className="ml-eyebrow">404</p>
      <h1>Lens out of focus.</h1>
      <p>찾는 페이지가 없습니다.<br />주소를 확인하거나 새로운 관점을 찾아보세요.</p>
      <div className="ml-state-actions"><Link href="/" className="ml-button ml-button-blue">홈으로 →</Link><Link href="/insights" className="ml-text-link">Insights 보기 →</Link></div>
    </div></div>
  )
}
