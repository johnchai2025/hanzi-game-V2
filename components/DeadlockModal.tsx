'use client';

interface DeadlockModalProps {
  onReshuffle: () => void;
  onRestart: () => void;
}

export function DeadlockModal({ onReshuffle, onRestart }: DeadlockModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal deadlock-modal">
        <div className="deadlock-icon">🧩</div>
        <h2>棋盘陷入僵局！</h2>
        <p>找不到可以消除的对子啦～</p>
        <div className="modal-buttons">
          <button className="btn btn-secondary" onClick={onRestart}>
            🔄 重新开始
          </button>
          <button className="btn btn-primary" onClick={onReshuffle}>
            🔀 换几个词再试试
          </button>
        </div>
      </div>
    </div>
  );
}
