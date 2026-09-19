'use client'

interface Props {
  candidateCount: number;
  onStart: () => void;
}

export function ReviewEntryCard({ candidateCount, onStart }: Props) {
  const available = candidateCount >= 2;

  return (
    <section className={`review-entry ${available ? 'ready' : 'empty'}`} aria-labelledby="review-entry-title">
      <div className="review-entry-mark" aria-hidden="true">习</div>
      <div className="review-entry-copy">
        <div className="review-entry-heading">
          <h2 id="review-entry-title">今日复习</h2>
          {available && <span>{candidateCount} 个词</span>}
        </div>
        <p>{available ? '把最近学过的词再见一次' : '再玩一关，就能开始复习'}</p>
      </div>
      <div className="review-entry-action">
        {available && <span className="review-entry-time">约 2–3 分钟</span>}
        <button
          type="button"
          className="review-entry-button"
          onClick={onStart}
          disabled={!available}
          aria-label={available ? `开始今日复习，共 ${candidateCount} 个词` : '今日复习暂不可用'}
        >
          {available ? '开始复习' : '暂未开启'}
        </button>
      </div>
    </section>
  );
}
