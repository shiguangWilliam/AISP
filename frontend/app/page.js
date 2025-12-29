import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <h1>AI 大模型与医学生问诊训练</h1>
        <p>进行标准化问诊练习，沉淀对话历史，查看成绩与分析。</p>
        <div className="hero-actions">
          <Link className="btn" href="/register">立即注册</Link>
          <Link className="btn ghost" href="/login">已有账号登录</Link>
        </div>
      </section>
      <section className="features">
        <div className="card">
          <h3>问诊对话</h3>
          <p>以结构化引导提问采集病史，提高效率与完整性。</p>
        </div>
        <div className="card">
          <h3>历史记录</h3>
          <p>所有问诊自动存档，支持复盘与持续优化。</p>
        </div>
        <div className="card">
          <h3>成绩分析</h3>
          <p>按关键词覆盖率评分，定位薄弱环节，提升训练效果。</p>
        </div>
      </section>
    </main>
  )
}
