import { useMemo } from "react"
import { useAppStore } from "@/store"
import { cn } from "@/lib/utils"
import {
  BedDouble,
  Clock,
  UserCheck,
  AlertTriangle,
  Sparkles,
  AlertOctagon,
} from "lucide-react"

type BedStatusColor = {
  bg: string
  border: string
  dot: string
  text: string
  chip: string
}

const STATUS_MAP: Record<string, { label: string; color: BedStatusColor }> = {
  idle: {
    label: "空闲",
    color: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      chip: "bg-emerald-100 text-emerald-700",
    },
  },
  occupied: {
    label: "占用",
    color: {
      bg: "bg-medical-50",
      border: "border-medical-200",
      dot: "bg-medical-500",
      text: "text-medical-700",
      chip: "bg-medical-100 text-medical-700",
    },
  },
  isolated: {
    label: "隔离中",
    color: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      dot: "bg-amber-500",
      text: "text-amber-700",
      chip: "bg-amber-100 text-amber-700",
    },
  },
  cleaning: {
    label: "清洁中",
    color: {
      bg: "bg-slate-100",
      border: "border-slate-300",
      dot: "bg-slate-500",
      text: "text-slate-700",
      chip: "bg-slate-200 text-slate-700",
    },
  },
}

const BED_TYPE_LABEL: Record<string, string> = {
  normal: "普通",
  negative: "负压",
  wheelchair: "轮椅位",
}

export default function Dashboard() {
  const beds = useAppStore((s) => s.beds)
  const patients = useAppStore((s) => s.patients)
  const admissions = useAppStore((s) => s.admissions)
  const abnormalRecords = useAppStore((s) => s.abnormalRecords)

  const stats = useMemo(() => {
    const total = beds.length
    const idle = beds.filter((b) => b.status === "idle").length
    const occupied =
      beds.filter((b) => b.status === "occupied" || b.status === "isolated")
        .length
    const cleaning = beds.filter((b) => b.status === "cleaning").length
    const unhandledAbnormal = abnormalRecords.filter((a) => !a.handled).length
    const inBedToday = admissions.filter((a) => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return a.admittedAt >= start.getTime()
    }).length
    return { total, idle, occupied, cleaning, unhandledAbnormal, inBedToday }
  }, [beds, admissions, abnormalRecords])

  const zones = useMemo(() => {
    const map = new Map<string, typeof beds>()
    for (const bed of beds) {
      const arr = map.get(bed.zone) || []
      arr.push(bed)
      map.set(bed.zone, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [beds])

  const patientName = (pid?: string) =>
    pid ? patients.find((p) => p.id === pid)?.name ?? "—" : "—"

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">床位周转板</h1>
          <p className="text-sm text-slate-500 mt-1">
            实时查看床位状态与在床患者情况
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<BedDouble className="w-5 h-5" />}
          label="总床位"
          value={stats.total}
          color="text-slate-700"
          bg="bg-slate-100"
        />
        <StatCard
          icon={<Sparkles className="w-5 h-5" />}
          label="空闲"
          value={stats.idle}
          color="text-emerald-600"
          bg="bg-emerald-100"
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          label="在床"
          value={stats.occupied}
          color="text-medical-600"
          bg="bg-medical-100"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="清洁中"
          value={stats.cleaning}
          color="text-slate-600"
          bg="bg-slate-100"
        />
        <StatCard
          icon={<BedDouble className="w-5 h-5" />}
          label="今日入床"
          value={stats.inBedToday}
          color="text-violet-600"
          bg="bg-violet-100"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="未处理异常"
          value={stats.unhandledAbnormal}
          color="text-red-600"
          bg="bg-red-100"
        />
      </div>

      {zones.length === 0 ? (
        <div className="card p-16 text-center">
          <BedDouble className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <div className="text-slate-500 font-medium">暂无床位数据</div>
          <div className="text-sm text-slate-400 mt-1">
            请前往【系统配置】添加床位
          </div>
        </div>
      ) : (
        zones.map(([zone, zoneBeds]) => (
          <section key={zone}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-slate-900">{zone}</h2>
              <span className="chip">共 {zoneBeds.length} 张</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {zoneBeds.map((bed) => {
                const status = STATUS_MAP[bed.status] ?? STATUS_MAP.idle
                const c = status.color
                const currentAdm = bed.currentAdmissionId
                  ? admissions.find((a) => a.id === bed.currentAdmissionId)
                  : null
                return (
                  <div
                    key={bed.id}
                    className={cn(
                      "card p-4 border-2 transition-all hover:shadow-md",
                      c.border,
                      c.bg,
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", c.dot)} />
                        <div className="font-bold text-slate-900">
                          {bed.bedNumber}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          c.chip,
                        )}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mb-3">
                      <span
                        className={cn(
                          "inline-block mr-2 px-1.5 py-0.5 rounded border",
                          c.border,
                          c.text,
                        )}
                      >
                        {BED_TYPE_LABEL[bed.type] ?? bed.type}
                      </span>
                    </div>

                    {currentAdm ? (
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">患者</span>
                          <span className="font-medium text-slate-900">
                            {patientName(bed.currentPatientId)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200/70 text-xs text-slate-400">
                        {bed.status === "cleaning"
                          ? "等待清洁完成"
                          : "可接受预约"}
                      </div>
                    )}

                    {bed.status === "isolated" && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        隔离床位
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", bg, color)}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  )
}
