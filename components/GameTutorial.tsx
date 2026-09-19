'use client';

interface Props {
  onDismiss: () => void;
}

export function GameTutorial({ onDismiss }: Props) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="game-tutorial-title">
      <div className="game-tutorial">
        <div className="game-tutorial-demo" aria-hidden="true">
          <span>洗</span><b>＋</b><span>手</span><b>＝</b><strong>洗手</strong>
        </div>
        <h2 id="game-tutorial-title">给汉字找伙伴</h2>
        <p>先点左边一个字，再从右边找到能和它组成词语的伙伴。</p>
        <p className="game-tutorial-tip">小秘密：长按汉字可以查看拼音。</p>
        <button className="btn btn-primary btn-big btn-block" onClick={onDismiss} autoFocus>
          我会啦，开始！
        </button>
      </div>
    </div>
  );
}
