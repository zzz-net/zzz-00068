import { useMemo } from 'react';
import type { Bed, BedType, BedStatus } from '@/types';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { getTodayStr } from '@/lib/utils';

interface BedCardProps {
  bed: Bed;
  onClick?: () => void;
  selected?: boolean;
  dateStr?: string;
}

const typeEmoji: Record<BedType, string> = {
  normal: '🛏️',
  negative: '☣️',
  wheelchair: '♿',
};

const statusColors: Record<BedStatus, { border: string; top: string }> = {
  idle: { border: 'border-emerald-500', top: 'bg-emerald-500' },
  occupied: { border: 'border-blue-500', top: 'bg-blue-500' },
  isolated: { border: 'border-amber-500', top: 'bg-amber-500' },
  cleaning: { border: 'border-slate-400', top: 'bg-slate-400' },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function BedCard({ bed, onClick, selected = false, dateStr }: BedCardProps) {
  const patients = useAppStore((s) => s.patients);
  const appointments = useAppStore((s) => s.appointments);
  const careNotes = useAppStore((s) => s.careNotes);

  const colors = statusColors[bed.status];
  void dateStr;

  const currentPatient = useMemo(() => {
    if (!bed.currentPatientId) return null;
    return patients.find((p) => p.id === bed.currentPatientId) ?? null;
  }, [bed.currentPatientId, patients]);

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    const today = dateStr ?? getTodayStr();
    return appointments
      .filter(
        (a) =>
          a.bedId === bed.id &&
          a.status === 'pending' &&
          a.appointmentDate === today &&
          a.startTime > now,
      )
      .sort((a, b) => a.startTime - b.startTime)[0];
  }, [appointments, bed.id, dateStr]);

  const nextPatient = useMemo(() => {
    if (!nextAppointment) return null;
    return patients.find((p) => p.id === nextAppointment.patientId) ?? null;
  }, [nextAppointment, patients]);

  const latestCareNote = useMemo(() => {
    if (!bed.currentAdmissionId) return null;
    const notes = careNotes
      .filter((n) => n.admissionId === bed.currentAdmissionId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return notes[0] ?? null;
  }, [bed.currentAdmissionId, careNotes]);

  const bottomNote = bed.notes || latestCareNote?.content;

  return (
    <div
      onClick={onClick}
      className={`w-[160px] h-[200px] rounded-xl bg-white border-2 ${colors.border} ${
        selected ? 'ring-2 ring-offset-2 ring-blue-500 shadow-lg' : 'shadow-sm'
      } hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden flex flex-col`}
    >
      <div className={`h-1.5 ${colors.top}`} />

      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-1">
          <span className="text-3xl font-bold text-slate-900 leading-none">
            {bed.bedNumber}
          </span>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {bed.zone}
            </span>
            <span className="text-lg leading-none">{typeEmoji[bed.type]}</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 flex-1 min-h-0">
        {currentPatient ? (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {currentPatient.name}
            </p>
            <p className="text-xs text-slate-500">
              {currentPatient.gender === 'male' ? '男' : '女'} · {currentPatient.age}岁
            </p>
          </div>
        ) : nextAppointment && nextPatient ? (
          <div className="space-y-0.5">
            <p className="text-xs text-indigo-500 font-medium">下一位</p>
            <p className="text-sm font-semibold text-indigo-700 truncate">
              {nextPatient.name}
            </p>
            <p className="text-xs text-slate-500">
              {formatTime(nextAppointment.startTime)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">空闲</p>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2">
        <StatusBadge status={bed.status} />
        {bottomNote && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
            {bottomNote}
          </p>
        )}
      </div>
    </div>
  );
}

export default BedCard;
