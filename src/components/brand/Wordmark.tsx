import Image from "next/image"

export default function Wordmark({ reverse = false, className = "", width = 145 }: { reverse?: boolean; className?: string; width?: number }) {
  return <Image src={`/brand/marklens-wordmark${reverse ? "-reverse" : ""}.svg`} alt="MarkLens" width={width} height={Math.round(width / 5.17073)} className={className} unoptimized />
}
