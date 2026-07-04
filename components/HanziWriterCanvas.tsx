'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  char: string;
  size?: number;
  strokeColor?: string;
  shouldStart?: boolean;            // default true; set false to defer animation
  onPhaseOneComplete?: () => void;  // fires when stroke animation ends (before quiz)
  onQuizComplete?: () => void;      // fires when tracing quiz is successfully done
}

export function HanziWriterCanvas({
  char,
  size = 140,
  strokeColor = '#c06020',
  shouldStart = true,
  onPhaseOneComplete,
  onQuizComplete,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const containerId = `hw-${uid}-${char}`;
  const writerRef = useRef<unknown>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!shouldStart) return;
    let cancelled = false;
    let cueTimer: ReturnType<typeof setTimeout> | undefined;

    async function init() {
      const HanziWriter = (await import('hanzi-writer')).default;
      if (cancelled) return;

      const el = document.getElementById(containerId);
      if (!el) return;

      const writer = HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: 8,
        strokeColor,
        outlineColor: '#d4a574',
        drawingColor: '#8a5628',
        highlightColor: '#f59e0b',
        strokeAnimationSpeed: 1,
        strokeHighlightSpeed: 1,
        delayBetweenStrokes: 300,
        showOutline: true,
        showCharacter: false,
        onLoadCharDataError: () => {
          if (cancelled) return;
          setLoadFailed(true);
          // Auto-advance so the parent doesn't stay blocked on a missing character
          onPhaseOneComplete?.();
          onQuizComplete?.();
        },
      });

      writerRef.current = writer;

      // Proactively flashes the upcoming stroke in highlightColor so kids know
      // where to start, instead of only hinting reactively after a miss.
      const cueStroke = (strokeIndex: number, delayMs = 0) => {
        const fire = () => {
          if (cancelled) return;
          writer.highlightStroke(strokeIndex);
        };
        if (delayMs > 0) {
          cueTimer = setTimeout(fire, delayMs);
        } else {
          fire();
        }
      };

      writer.animateCharacter({
        onComplete: () => {
          if (cancelled) return;
          onPhaseOneComplete?.();
          writer.quiz({
            // showOutline stays true through the quiz (it's never hidden below),
            // which makes hanzi-writer itself grade strokes more strictly
            // (it halves its own distance threshold whenever the outline is
            // visible) — raise leniency to compensate for kids' shakier strokes.
            leniency: 1.6,
            acceptBackwardsStrokes: true,
            showHintAfterMisses: 1,
            markStrokeCorrectAfterMisses: 3,
            onCorrectStroke: (strokeData) => {
              if (cancelled) return;
              if (strokeData.strokesRemaining > 0) cueStroke(strokeData.strokeNum + 1);
            },
            onComplete: () => {
              if (!cancelled) onQuizComplete?.();
            },
          }).then(() => cueStroke(0, 350));
        },
      });
    }

    init();

    return () => {
      cancelled = true;
      clearTimeout(cueTimer);
    };
  // char/size/strokeColor are stable after mount; only re-run when shouldStart flips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStart]);

  if (loadFailed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.55,
          color: strokeColor,
          fontFamily: "'Ma Shan Zheng', serif",
          border: '2px dashed #d4a574',
          borderRadius: 12,
          background: '#fff8ef',
        }}
      >
        {char}
      </div>
    );
  }

  return <div id={containerId} style={{ width: size, height: size }} />;
}
