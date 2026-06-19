import { useNavigate } from "react-router-dom"
import { Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="text-[120px] font-black leading-none bg-gradient-to-br from-medical-500 to-medical-700 bg-clip-text text-transparent select-none">
          404
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">页面未找到</h1>
        <p className="text-slate-500 mt-2">
          您访问的页面不存在或已被移除
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </button>
          <button onClick={() => navigate("/dashboard")} className="btn-primary">
            <Home className="w-4 h-4" />
            回到首页
          </button>
        </div>
      </div>
    </div>
  )
}
