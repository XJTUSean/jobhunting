import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'

type StepStatus = 'done' | 'current' | 'todo'
type Priority = 'high' | 'middle' | 'low'
type CompanyStatus = 'active' | 'waiting' | 'passed' | 'rejected' | 'declined'

type SelectionStep = {
  id: number
  name: string
  status: StepStatus
}

type Company = {
  id: string
  name: string
  position: string
  nextAction: string
  deadline: string
  priority: Priority
  status: CompanyStatus
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
  priority: Priority
  status: CompanyStatus
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

const createEmptyForm = (): CompanyForm => ({
  name: '',
  position: '',
  nextAction: '',
  deadline: '',
  priority: 'middle',
  status: 'active',
  myPageUrl: '',
  loginId: '',
  loginPassword: '',
  memo: '',
  steps: defaultSteps.map((step) => ({ ...step })),
})

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'ログインまたは登録に失敗しました'
  }

  if (error.message.includes('auth/email-already-in-use')) {
    return 'このメールアドレスはすでに登録されています'
  }

  if (error.message.includes('auth/invalid-email')) {
    return 'メールアドレスの形式が正しくありません'
  }

  if (error.message.includes('auth/weak-password')) {
    return 'パスワードは6文字以上にしてください'
  }

  if (
    error.message.includes('auth/invalid-credential') ||
    error.message.includes('auth/user-not-found') ||
    error.message.includes('auth/wrong-password')
  ) {
    return 'メールアドレスまたはパスワードが違います'
  }

  return 'ログインまたは登録に失敗しました'
}

function getPriorityLabel(priority: Priority) {
  if (priority === 'high') return '高'
  if (priority === 'middle') return '中'
  return '低'
}

function getStatusLabel(status: CompanyStatus) {
  if (status === 'active') return '進行中'
  if (status === 'waiting') return '結果待ち'
  if (status === 'passed') return '通過/内定'
  if (status === 'rejected') return '落選'
  return '辞退'
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authError, setAuthError] = useState('')

  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyForm>(createEmptyForm)

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [searchKeyword, setSearchKeyword] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setCompanies([])
      setCompaniesLoading(false)
      return
    }

    setCompaniesLoading(true)

    const companiesRef = collection(db, 'users', user.uid, 'companies')
    const companiesQuery = query(companiesRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      companiesQuery,
      (snapshot) => {
        const loadedCompanies: Company[] = snapshot.docs.map((document) => {
          const data = document.data()

          return {
            id: document.id,
            name: data.name ?? '',
            position: data.position ?? '',
            nextAction: data.nextAction ?? '',
            deadline: data.deadline ?? '',
            priority: data.priority ?? 'middle',
            status: data.status ?? 'active',
            myPageUrl: data.myPageUrl ?? '',
            loginId: data.loginId ?? '',
            loginPassword: data.loginPassword ?? '',
            memo: data.memo ?? '',
            steps: data.steps ?? [],
          }
        })

        setCompanies(loadedCompanies)
        setCompaniesLoading(false)
      },
      (error) => {
        console.error(error)
        setCompaniesLoading(false)
        alert('会社情報の読み込みに失敗しました')
      }
    )

    return () => unsubscribe()
  }, [user])

  const filteredCompanies = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    if (!keyword) {
      return companies
    }

    return companies.filter((company) => {
      const targetText = [
        company.name,
        company.position,
        company.nextAction,
        company.deadline,
        company.myPageUrl,
        company.loginId,
        company.memo,
        company.steps.map((step) => step.name).join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return targetText.includes(keyword)
    })
  }, [companies, searchKeyword])

  const handleAuth = async () => {
    setAuthError('')

    if (!email || !password) {
      setAuthError('メールアドレスとパスワードを入力してください')
      return
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setAuthError('パスワードは6文字以上にしてください')
        return
      }

      if (password !== passwordConfirm) {
        setAuthError('確認用パスワードが一致していません')
        return
      }
    }

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }

      setPassword('')
      setPasswordConfirm('')
    } catch (error) {
      console.error(error)
      setAuthError(getAuthErrorMessage(error))
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setCompanies([])
    setIsFormOpen(false)
    setEditingCompanyId(null)
    setForm(createEmptyForm())
    setVisiblePasswords({})
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
    setForm(createEmptyForm())
    setEditingCompanyId(null)
  }

  const openAddForm = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditForm = (company: Company) => {
    setForm({
      name: company.name,
      position: company.position,
      nextAction: company.nextAction,
      deadline: company.deadline,
      priority: company.priority,
      status: company.status,
      myPageUrl: company.myPageUrl ?? '',
      loginId: company.loginId ?? '',
      loginPassword: company.loginPassword ?? '',
      memo: company.memo ?? '',
      steps:
        company.steps.length > 0
          ? company.steps.map((step, index) => ({
              id: step.id || Date.now() + index,
              name: step.name,
              status: step.status,
            }))
          : defaultSteps.map((step) => ({ ...step })),
    })

    setEditingCompanyId(company.id)
    setIsFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveCompany = async () => {
    if (!user) {
      alert('ログインしてください')
      return
    }

    if (!form.name.trim()) {
      alert('会社名を入力してください')
      return
    }

    const validSteps = form.steps
      .filter((step) => step.name.trim() !== '')
      .map((step) => ({ ...step, name: step.name.trim() }))

    if (validSteps.length === 0) {
      alert('選考フローを1つ以上入力してください')
      return
    }

    const companyData = {
      name: form.name.trim(),
      position: form.position.trim(),
      nextAction: form.nextAction.trim(),
      deadline: form.deadline.trim(),
      priority: form.priority,
      status: form.status,
      myPageUrl: form.myPageUrl.trim(),
      loginId: form.loginId.trim(),
      loginPassword: form.loginPassword,
      memo: form.memo.trim(),
      steps: validSteps,
      updatedAt: serverTimestamp(),
    }

    try {
      if (editingCompanyId) {
        const companyRef = doc(db, 'users', user.uid, 'companies', editingCompanyId)
        await updateDoc(companyRef, companyData)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'companies'), {
          ...companyData,
          createdAt: serverTimestamp(),
        })
      }

      resetForm()
      setIsFormOpen(false)
    } catch (error) {
      console.error(error)
      alert('会社情報の保存に失敗しました')
    }
  }

  const removeCompany = async (company: Company) => {
    if (!user) {
      return
    }

    const ok = window.confirm(`${company.name} を削除しますか？`)

    if (!ok) {
      return
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'companies', company.id))
    } catch (error) {
      console.error(error)
      alert('会社情報の削除に失敗しました')
    }
  }

  const toggleCompanyPassword = (companyId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }))
  }

  if (authLoading) {
    return <div className="auth-page">読み込み中...</div>
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>JobFlow</h1>
          <p>就活情報を管理するため、ログインしてください。</p>

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
            <div className="inline-input-button">
              <input
                type={showAuthPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6文字以上"
              />
              <button
                type="button"
                className="mini-button"
                onClick={() => setShowAuthPassword((prev) => !prev)}
              >
                {showAuthPassword ? '隠す' : '表示'}
              </button>
            </div>
          </label>

          {isRegisterMode && (
            <label>
              パスワード確認
              <input
                type={showAuthPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="もう一度入力"
              />
            </label>
          )}

          {authError && <p className="error-text">{authError}</p>}

          <button className="primary-button auth-button" onClick={handleAuth}>
            {isRegisterMode ? '新規登録' : 'ログイン'}
          </button>

          <button
            className="text-button"
            onClick={() => {
              setIsRegisterMode((prev) => !prev)
              setAuthError('')
              setPassword('')
              setPasswordConfirm('')
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

      <section className="toolbar toolbar-row">
        <button onClick={openAddForm}>＋会社を追加</button>

        <input
          className="search-input"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="会社名・職種・メモなどで検索"
        />
      </section>

      {isFormOpen && (
        <section className="form-card">
          <div className="form-header">
            <h2>{editingCompanyId ? '会社を編集' : '会社を追加'}</h2>
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
              優先度
              <select
                value={form.priority}
                onChange={(event) =>
                  updateFormField('priority', event.target.value)
                }
              >
                <option value="high">高</option>
                <option value="middle">中</option>
                <option value="low">低</option>
              </select>
            </label>

            <label>
              状態
              <select
                value={form.status}
                onChange={(event) =>
                  updateFormField('status', event.target.value)
                }
              >
                <option value="active">進行中</option>
                <option value="waiting">結果待ち</option>
                <option value="passed">通過/内定</option>
                <option value="rejected">落選</option>
                <option value="declined">辞退</option>
              </select>
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
            <button className="primary-button" onClick={saveCompany}>
              {editingCompanyId ? '更新する' : '追加する'}
            </button>
          </div>
        </section>
      )}

      <section className="company-list">
        {companiesLoading && <div className="empty-card">読み込み中...</div>}

        {!companiesLoading && companies.length === 0 && (
          <div className="empty-card">
            まだ会社情報がありません。まずは「＋会社を追加」から登録してください。
          </div>
        )}

        {!companiesLoading && companies.length > 0 && filteredCompanies.length === 0 && (
          <div className="empty-card">
            検索条件に一致する会社がありません。
          </div>
        )}

        {!companiesLoading &&
          filteredCompanies.map((company) => (
            <article className="company-card" key={company.id}>
              <div className="company-header">
                <div>
                  <h2>{company.name}</h2>
                  <p>{company.position || '職種未入力'}</p>
                  <div className="badge-row">
                    <span className={`badge priority-${company.priority}`}>
                      優先度：{getPriorityLabel(company.priority)}
                    </span>
                    <span className={`badge status-${company.status}`}>
                      {getStatusLabel(company.status)}
                    </span>
                  </div>
                </div>

                <div className="card-side">
                  {company.deadline && (
                    <span className="deadline">{company.deadline}</span>
                  )}

                  <div className="card-actions">
                    <button
                      className="secondary-button"
                      onClick={() => openEditForm(company)}
                    >
                      編集
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => removeCompany(company)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>

              <div className="flow">
                {company.steps.map((step, index) => (
                  <div className="step-wrap" key={`${company.id}-${step.id}`}>
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
                  <p className="password-row">
                    <strong>パスワード：</strong>
                    <span>
                      {visiblePasswords[company.id]
                        ? company.loginPassword
                        : '••••••••••••'}
                    </span>
                    <button
                      className="mini-button"
                      onClick={() => toggleCompanyPassword(company.id)}
                    >
                      {visiblePasswords[company.id] ? '隠す' : '表示'}
                    </button>
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