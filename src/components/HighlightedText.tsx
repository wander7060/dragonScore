import type { ReactNode } from 'react'

interface HighlightedTextProps {
  text: string
  keyword?: string
}

export function HighlightedText({ text, keyword }: HighlightedTextProps) {
  if (!keyword) {
    return <>{text}</>
  }

  const segments: ReactNode[] = []
  let searchIndex = 0
  let matchIndex = text.indexOf(keyword, searchIndex)

  while (matchIndex !== -1) {
    if (matchIndex > searchIndex) {
      segments.push(text.slice(searchIndex, matchIndex))
    }

    segments.push(
      <mark className="keyword-highlight" key={`${matchIndex}-${keyword}`}>
        {keyword}
      </mark>,
    )

    searchIndex = matchIndex + keyword.length
    matchIndex = text.indexOf(keyword, searchIndex)
  }

  if (searchIndex < text.length) {
    segments.push(text.slice(searchIndex))
  }

  return <>{segments}</>
}
