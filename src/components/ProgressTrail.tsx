import { CheckCircle2, CircleDashed, Flag } from 'lucide-react';
import type { ProgressBeat } from '../game/types';

interface ProgressTrailProps {
  beats: ProgressBeat[];
  flags: string[];
}

export function ProgressTrail({ beats, flags }: ProgressTrailProps) {
  if (!beats.length) return null;

  const completed = beats.filter((beat) => flags.includes(beat.flag)).length;
  const nextBeat = beats.find((beat) => !flags.includes(beat.flag));
  const percent = Math.round((completed / beats.length) * 100);

  return (
    <div className="progress-trail" aria-label="Case roadmap">
      <div className="progress-trail-heading">
        <div>
          <span>CASE ROADMAP</span>
          <strong>
            {completed}/{beats.length} milestones
          </strong>
        </div>
        <em>{percent}%</em>
      </div>
      <div className="progress-trail-meter" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      {nextBeat ? (
        <div className="progress-next-beat">
          <Flag aria-hidden="true" />
          <span>Next</span>
          <strong>{nextBeat.label}</strong>
        </div>
      ) : (
        <div className="progress-next-beat complete">
          <CheckCircle2 aria-hidden="true" />
          <span>Complete</span>
          <strong>All roadmap milestones are cleared.</strong>
        </div>
      )}
      {beats.map((beat) => {
        const done = flags.includes(beat.flag);
        const Icon = done ? CheckCircle2 : CircleDashed;

        return (
          <div className={done ? 'progress-step complete' : 'progress-step'} key={beat.id}>
            <Icon aria-hidden="true" />
            <span>{beat.label}</span>
          </div>
        );
      })}
    </div>
  );
}
