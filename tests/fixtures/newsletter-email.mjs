// TEST FIXTURE ONLY. No production content, subscriber data or email delivery.
export const newsletterFixture = {
  id: 'test-only-weekly', issue_number: 12, status: 'draft',
  created_at: '2026-10-11T05:44:00Z', updated_at: '2026-10-11T05:44:00Z',
  title: '#12 — TEST FIXTURE · AI 검색에서 브랜드가 발견되는 방식',
  intro: 'TEST FIXTURE입니다. 검색 결과의 변화가 브랜드의 메시지에 어떤 질문을 던지는지 살펴봅니다. 아래 내용은 레이아웃 검수용이며 실제 보도나 권고가 아닙니다.',
  topic_headline: '검색 순위 다음에 남는 것은 어떤 브랜드의 답변일까요?',
  body_sections: [
    { subhead: '무슨 일이 달라졌나', paragraphs: ['한 주제의 사건과 맥락을 읽는 자리입니다. 본문은 저장된 문장을 그대로 표시하고, 메일이 새로운 사실이나 수치를 추가하지 않습니다.', '짧은 문장과 긴 설명이 함께 있어도 읽는 흐름은 이어집니다. 이미지가 표시되지 않아도 이 본문만으로 내용을 이해할 수 있습니다.'], visual: { type: 'photo', url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72', caption: 'TEST FIXTURE — 업무 공간 사진' } },
    { subhead: '왜 마케터에게 중요한가', paragraphs: ['채널의 변화와 메시지의 관계를 살펴보는 테스트 문장입니다. 저장된 섹션을 순서대로 읽으며 주제를 깊게 이해합니다.'] },
  ],
  key_takeaways: ['메시지가 어디에서 어떻게 읽히는지 확인하는 관점.', '같은 키워드보다 전달하는 의미에 주목하는 관점.', '결론을 과장하지 않고 실제 근거를 먼저 읽는 관점.'],
  for_your_career: 'TEST FIXTURE — 이 주제를 포트폴리오에 기록한다면, 관찰한 변화와 자신의 해석을 구분해 적어보세요. 여기에 표시되는 실행 문장은 fixture 입력에만 존재합니다.',
}
export const newsletterVariants = {
  modern: newsletterFixture,
  stress: { ...newsletterFixture, title: '#12 — TEST FIXTURE · 매우 긴 한국어 제목에서 브랜드와 사건의 의미를 지우지 않고 모바일 화면에서도 자연스러운 줄바꿈과 읽기 흐름이 유지되는지 확인합니다', body_sections: [{ subhead: 'TEST FIXTURE — A contemporary editorial perspective on how brands are discovered across changing search experiences without losing the meaning of their message', paragraphs: ['요약 한 줄.', '긴 설명의 첫 문장입니다. 이어지는 문장은 서로 다른 길이로 작성된 테스트 본문입니다. 내용의 순서와 의미를 유지하며 읽을 수 있는지 확인합니다. 글자를 억지로 줄이지 않고 모바일에서도 충분한 크기를 유지합니다.'] }], key_takeaways: ['TEST FIXTURE — 단 하나의 저장된 핵심 포인트만 표시합니다.'] },
  sparse: { ...newsletterFixture, intro: undefined, body_sections: [{ subhead: 'TEST FIXTURE — 이미지 없는 본문', paragraphs: ['짧은 요약 한 줄.'] }], key_takeaways: [], for_your_career: undefined },
  legacy: { ...newsletterFixture, topic_headline: undefined, body_sections: undefined, key_takeaways: undefined, for_your_career: undefined, week_signals: 'TEST FIXTURE — 기존 시그널 문장입니다. 다음 문장도 그대로 보존합니다.', case_of_week: 'TEST FIXTURE — 기존 사례입니다.', ai_brief: 'TEST FIXTURE — 기존 실행 내용입니다.', portfolio_insight: 'TEST FIXTURE — 포트폴리오 내용입니다.', career_lens: 'TEST FIXTURE — 커리어 내용입니다.' },
}
