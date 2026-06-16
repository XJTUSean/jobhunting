import './App.css'

type StepStatus = 'done' | 'current' | 'todo'

type Company = {
  id: number
  name: string
  position: string
  nextAction: string
  deadline: string
  steps: {
    name: string
    status: StepStatus
  }[]
}

const companies: Company[] = [
  {
    id: 1,
    name: 'フィールズ株式会社',
    position: 'デザイナー職',
    nextAction: 'ES＋ポートフォリオ提出',
    deadline: '2026/6/30 18:00',
    steps: [
      { name: 'Entry', status: 'done' },
      { name: '説明会', status: 'done' },
      { name: 'ES', status: 'current' },
      { name: 'Webテスト', status: 'todo' },
      { name: '一面', status: 'todo' },
      { name: '二面', status: 'todo' },
      { name: '最終', status: 'todo' },
    ],
  },
]

function App() {
  return (
    <main className="app">
      <header className="header">
        <h1>JobFlow</h1>
        <p>就活の選考進捗・DDL・面接予定を管理するアプリ</p>
      </header>

      <section className="toolbar">
        <button>＋会社を追加</button>
      </section>

      <section className="company-list">
        {companies.map((company) => (
          <article className="company-card" key={company.id}>
            <div className="company-header">
              <div>
                <h2>{company.name}</h2>
                <p>{company.position}</p>
              </div>
              <span className="deadline">{company.deadline}</span>
            </div>

            <div className="flow">
              {company.steps.map((step, index) => (
                <div className="step-wrap" key={step.name}>
                  <span className={`step ${step.status}`}>
                    {step.name}
                  </span>
                  {index < company.steps.length - 1 && (
                    <span className="arrow">→</span>
                  )}
                </div>
              ))}
            </div>

            <div className="next-action">
              <strong>次にやること：</strong>
              {company.nextAction}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App