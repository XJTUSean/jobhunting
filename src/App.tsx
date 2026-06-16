import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from './firebase'
import './App.css'

type StepStatus = 'done' | 'current' | 'todo'

type SelectionStep = {
  id: number
  name: string
  status: StepStatus
}

type Company = {
  id: number
  name: string
  position: string
  nextAction: string
  deadline: string
  myPageUrl?: string
  loginId?: string
  loginPassword?: string
  memo?: string
  steps: SelectionStep[]
}

type CompanyForm = {
  name: string
  position: string
  nextAction: string
  deadline: string
  myPageUrl: string
  loginId: string
  loginPassword: string
  memo: string
  steps: SelectionStep[]
}

const defaultSteps: SelectionStep[] = [
  { id: 1, name: 'Entry', status: 'done' },
  { id: 2, name: '説明会', status: 'current' },
  { id: 3, name: 'ES', status: 'todo' },
  { id: 4, name: 'Webテスト', status: 'todo' },
  { id: 5, name: '一面', status: 'todo' },
  { id: 6, name: '二面', status: 'todo' },
  { id: 7, name: '最終', status: 'todo' },
]

const emptyForm: CompanyForm = {
  name: '',
  position: '',
  nextAction: '',
  deadline: '',
  myPageUrl: '',
  loginId: '',
  loginPassword: '',
  memo: '',
  steps: defaultSteps.map((step) => ({ ...step })),
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [companies, setCompanies] = useState<Company[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<CompanyForm>(emptyForm)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleAuth = async () => {
    setAuthError('')

    if (!email || !password) {
      setAuthError('メールアドレスとパスワードを入力してください')
      return
    }

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error) {
      console.error(error)
      setAuthError('ログインまたは登録に失敗しました')
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setCompanies([])
  }

  const updateFormField = (field: keyof CompanyForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const updateStepName = (stepId: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) =>
        step.id === stepId ? { ...step, name: value } : step
      ),
    }))
  }

  const updateStepStatus = (stepId: number, value: StepStatus) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) =>
        step.id === stepId ? { ...step, status: value } : step
      ),
    }))
  }

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: Date.now(),
          name: '',
          status: 'todo',
        },
      ],
    }))
  }

  const deleteStep = (stepId: number) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId),
    }))
  }

  const resetForm = () => {
    setForm({
      ...emptyForm,
      steps: defaultSteps.map((step) => ({ ...step })),
    })
  }

  const addCompany = () => {
    if (!form.name.trim()) {
      alert('会社名を入力してください')
      return
    }

    const newCompany: Company = {
      id: Date.now(),
      name: form.name,
      position: form.position,
      nextAction: form.nextAction,
      deadline: form.deadline,
      myPageUrl: form.myPageUrl,
      loginId: form.loginId,
      loginPassword: form.loginPassword,
      memo: form.memo,
      steps: form.steps
        .filter((step) => step.name.trim() !== '')
        .map((step) => ({ ...step })),
    }

    setCompanies((prev) => [newCompany, ...prev])
    resetForm()
    setIsFormOpen(false)
  }

  if (authLoading) {
    return <div className="auth-page">読み込み中...</div>
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>JobFlow</h1>
          <p>就活情報を安全に管理するため、ログインしてください。</p>

          <label>
            メールアドレス
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@gmail.com"
            />
          </label>

          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6文字以上"
            />
          </label>

          {authError && <p className="error-text">{authError}</p>}

          <button className="primary-button auth-button" onClick={handleAuth}>
            {isRegisterMode ? '新規登録' : 'ログイン'}
          </button>

          <button
            className="text-button"
            onClick={() => {
              setIsRegisterMode((prev) => !prev)
              setAuthError('')
            }}
          >
            {isRegisterMode
              ? 'すでにアカウントを持っている方はこちら'
              : '初めて使う方はこちらから登録'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="header app-header-row">
        <div>
          <h1>JobFlow</h1>
          <p>就活の選考進捗・DDL・面接予定を管理するアプリ</p>
          <p className="login-user">ログイン中：{user.email}</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          ログアウト
        </button>
      </header>

      <section className="toolbar">
        <button onClick={() => setIsFormOpen(true)}>＋会社を追加</button>
      </section>

      {isFormOpen && (
        <section className="form-card">
          <div className="form-header">
            <h2>会社を追加</h2>
            <button
              className="secondary-button"
              onClick={() => {
                resetForm()
                setIsFormOpen(false)
              }}
            >
              閉じる
            </button>
          </div>

          <div className="form-grid">
            <label>
              会社名
              <input
                value={form.name}
                onChange={(event) => updateFormField('name', event.target.value)}
                placeholder="例：フィールズ株式会社"
              />
            </label>

            <label>
              職種
              <input
                value={form.position}
                onChange={(event) =>
                  updateFormField('position', event.target.value)
                }
                placeholder="例：デザイナー職"
              />
            </label>

            <label>
              次にやること
              <input
                value={form.nextAction}
                onChange={(event) =>
                  updateFormField('nextAction', event.target.value)
                }
                placeholder="例：ES＋ポートフォリオ提出"
              />
            </label>

            <label>
              DDL / 予定
              <input
                value={form.deadline}
                onChange={(event) =>
                  updateFormField('deadline', event.target.value)
                }
                placeholder="例：2026/6/30 18:00"
              />
            </label>

            <label>
              My Page URL
              <input
                value={form.myPageUrl}
                onChange={(event) =>
                  updateFormField('myPageUrl', event.target.value)
                }
                placeholder="https://..."
              />
            </label>

            <label>
              My Page ログインID / メール
              <input
                value={form.loginId}
                onChange={(event) =>
                  updateFormField('loginId', event.target.value)
                }
                placeholder="メールアドレスなど"
              />
            </label>

            <label>
              My Page パスワード
              <input
                type="password"
                value={form.loginPassword}
                onChange={(event) =>
                  updateFormField('loginPassword', event.target.value)
                }
                placeholder="パスワード"
              />
            </label>
          </div>

          <label className="memo-field">
            メモ
            <textarea
              value={form.memo}
              onChange={(event) => updateFormField('memo', event.target.value)}
              placeholder="メール内容、提出物、志望動機メモなど"
            />
          </label>

          <div className="steps-editor">
            <div className="steps-editor-header">
              <h3>選考フロー</h3>
              <button className="secondary-button" onClick={addStep}>
                ＋段階を追加
              </button>
            </div>

            {form.steps.map((step, index) => (
              <div className="step-editor-row" key={step.id}>
                <span className="step-number">{index + 1}</span>

                <input
                  value={step.name}
                  onChange={(event) =>
                    updateStepName(step.id, event.target.value)
                  }
                  placeholder="例：ES"
                />

                <select
                  value={step.status}
                  onChange={(event) =>
                    updateStepStatus(step.id, event.target.value as StepStatus)
                  }
                >
                  <option value="done">完了</option>
                  <option value="current">次にやる</option>
                  <option value="todo">未着手</option>
                </select>

                <button
                  className="danger-button"
                  onClick={() => deleteStep(step.id)}
                >
                  削除
                </button>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button className="primary-button" onClick={addCompany}>
              追加する
            </button>
          </div>
        </section>
      )}

      <section className="company-list">
        {companies.length === 0 && (
          <div className="empty-card">
            まだ会社情報がありません。まずは「＋会社を追加」から登録してください。
          </div>
        )}

        {companies.map((company) => (
          <article className="company-card" key={company.id}>
            <div className="company-header">
              <div>
                <h2>{company.name}</h2>
                <p>{company.position || '職種未入力'}</p>
              </div>
              {company.deadline && (
                <span className="deadline">{company.deadline}</span>
              )}
            </div>

            <div className="flow">
              {company.steps.map((step, index) => (
                <div className="step-wrap" key={step.id}>
                  <span className={`step ${step.status}`}>{step.name}</span>
                  {index < company.steps.length - 1 && (
                    <span className="arrow">→</span>
                  )}
                </div>
              ))}
            </div>

            {company.nextAction && (
              <div className="next-action">
                <strong>次にやること：</strong>
                {company.nextAction}
              </div>
            )}

            <div className="company-extra">
              {company.myPageUrl && (
                <p>
                  <strong>My Page：</strong>
                  <a
                    href={company.myPageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {company.myPageUrl}
                  </a>
                </p>
              )}

              {company.loginId && (
                <p>
                  <strong>ログインID：</strong>
                  {company.loginId}
                </p>
              )}

              {company.loginPassword && (
                <p>
                  <strong>パスワード：</strong>
                  {'•'.repeat(Math.min(company.loginPassword.length, 12))}
                </p>
              )}

              {company.memo && (
                <p>
                  <strong>メモ：</strong>
                  {company.memo}
                </p>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App