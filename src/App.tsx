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
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import { auth, db } from './firebase'
import './App.css'

type StepStatus = 'done' | 'current' | 'todo'
type Priority = 'high' | 'middle' | 'low'
type CompanyStatus = 'active' | 'waiting' | 'passed' | 'rejected' | 'declined'
type EventType = 'deadline' | 'seminar' | 'interview' | 'webtest' | 'submission' | 'other'

type SelectionStep = {
  id: number
  name: string
  status: StepStatus
}

type JobEvent = {
  id: number
  title: string
  type: EventType
  start: string
  end: string
  memo: string
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
  events: JobEvent[]
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
  events: JobEvent[]
}

const defaultSteps: SelectionStep[] = [
  { id: 1, name: '投递', status: 'done' },
  { id: 2, name: '公司说明会', status: 'current' },
  { id: 3, name: '申请表 / ES', status: 'todo' },
  { id: 4, name: '网测', status: 'todo' },
  { id: 5, name: '一面', status: 'todo' },
  { id: 6, name: '二面', status: 'todo' },
  { id: 7, name: '最终面试', status: 'todo' },
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
  events: [],
})

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return '登录或注册失败'
  }

  if (error.message.includes('auth/email-already-in-use')) {
    return '这个邮箱已经注册过了'
  }

  if (error.message.includes('auth/invalid-email')) {
    return '邮箱格式不正确'
  }

  if (error.message.includes('auth/weak-password')) {
    return '密码请设置为 6 位以上'
  }

  if (
    error.message.includes('auth/invalid-credential') ||
    error.message.includes('auth/user-not-found') ||
    error.message.includes('auth/wrong-password')
  ) {
    return '邮箱或密码不正确'
  }

  return '登录或注册失败'
}

function getPriorityLabel(priority: Priority) {
  if (priority === 'high') return '高'
  if (priority === 'middle') return '中'
  return '低'
}

function getStatusLabel(status: CompanyStatus) {
  if (status === 'active') return '进行中'
  if (status === 'waiting') return '等待结果'
  if (status === 'passed') return '通过 / 内定'
  if (status === 'rejected') return '落选'
  return '辞退'
}

function getEventTypeLabel(type: EventType) {
  if (type === 'deadline') return 'DDL'
  if (type === 'seminar') return '说明会'
  if (type === 'interview') return '面试'
  if (type === 'webtest') return '网测'
  if (type === 'submission') return '提交材料'
  return '其他'
}

function applyCurrentStep(steps: SelectionStep[], currentIndex: number) {
  return steps.map((step, index) => ({
    ...step,
    status:
      index < currentIndex
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'todo',
  }))
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
            events: data.events ?? [],
          }
        })

        setCompanies(loadedCompanies)
        setCompaniesLoading(false)
      },
      (error) => {
        console.error(error)
        setCompaniesLoading(false)
        alert('读取公司信息失败')
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
      const eventText = company.events
        .map((event) => `${event.title} ${getEventTypeLabel(event.type)} ${event.memo}`)
        .join(' ')

      const targetText = [
        company.name,
        company.position,
        company.nextAction,
        company.deadline,
        company.myPageUrl,
        company.loginId,
        company.memo,
        company.steps.map((step) => step.name).join(' '),
        eventText,
      ]
        .join(' ')
        .toLowerCase()

      return targetText.includes(keyword)
    })
  }, [companies, searchKeyword])

  const calendarEvents = useMemo(() => {
    return companies.flatMap((company) =>
      company.events
        .filter((event) => event.title.trim() && event.start)
        .map((event) => ({
          id: `${company.id}-${event.id}`,
          title: `${company.name}｜${event.title}`,
          start: event.start,
          end: event.end || undefined,
          extendedProps: {
            companyName: company.name,
            eventTitle: event.title,
            eventType: getEventTypeLabel(event.type),
            memo: event.memo,
            companyId: company.id,
          },
        }))
    )
  }, [companies])

  const handleAuth = async () => {
    setAuthError('')

    if (!email || !password) {
      setAuthError('请输入邮箱和密码')
      return
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setAuthError('密码请设置为 6 位以上')
        return
      }

      if (password !== passwordConfirm) {
        setAuthError('两次输入的密码不一致')
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

  const updateFormField = <K extends keyof CompanyForm>(
    field: K,
    value: CompanyForm[K]
  ) => {
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

  const addEvent = () => {
    setForm((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        {
          id: Date.now(),
          title: '',
          type: 'deadline',
          start: '',
          end: '',
          memo: '',
        },
      ],
    }))
  }

  const updateEvent = <K extends keyof JobEvent>(
    eventId: number,
    field: K,
    value: JobEvent[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.map((event) =>
        event.id === eventId ? { ...event, [field]: value } : event
      ),
    }))
  }

  const deleteEvent = (eventId: number) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.filter((event) => event.id !== eventId),
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
      events:
        company.events.length > 0
          ? company.events.map((event, index) => ({
              id: event.id || Date.now() + index,
              title: event.title,
              type: event.type,
              start: event.start,
              end: event.end,
              memo: event.memo,
            }))
          : [],
    })

    setEditingCompanyId(company.id)
    setIsFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveCompany = async () => {
    if (!user) {
      alert('请先登录')
      return
    }

    if (!form.name.trim()) {
      alert('请输入公司名')
      return
    }

    const validSteps = form.steps
      .filter((step) => step.name.trim() !== '')
      .map((step, index) => ({
        ...step,
        id: step.id || Date.now() + index,
        name: step.name.trim(),
      }))

    if (validSteps.length === 0) {
      alert('请至少输入一个选考阶段')
      return
    }

    const validEvents = form.events
      .filter((event) => event.title.trim() !== '' || event.start !== '')
      .map((event, index) => ({
        id: event.id || Date.now() + index,
        title: event.title.trim(),
        type: event.type,
        start: event.start,
        end: event.end,
        memo: event.memo.trim(),
      }))

    const invalidEvent = validEvents.find(
      (event) => event.title.trim() === '' || event.start.trim() === ''
    )

    if (invalidEvent) {
      alert('活动需要至少填写标题和开始时间')
      return
    }

    const hasCurrentStep = validSteps.some((step) => step.status === 'current')
    const normalizedSteps = hasCurrentStep
      ? validSteps
      : applyCurrentStep(validSteps, 0)

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
      steps: normalizedSteps,
      events: validEvents,
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
      alert('保存公司信息失败')
    }
  }

  const removeCompany = async (company: Company) => {
    if (!user) {
      return
    }

    const ok = window.confirm(`确定要删除 ${company.name} 吗？`)

    if (!ok) {
      return
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'companies', company.id))
    } catch (error) {
      console.error(error)
      alert('删除公司信息失败')
    }
  }

  const setCurrentStep = async (company: Company, currentIndex: number) => {
    if (!user) {
      return
    }

    const updatedSteps = applyCurrentStep(company.steps, currentIndex)
    const currentStepName = updatedSteps[currentIndex]?.name ?? company.nextAction

    try {
      const companyRef = doc(db, 'users', user.uid, 'companies', company.id)
      await updateDoc(companyRef, {
        steps: updatedSteps,
        nextAction: currentStepName,
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error(error)
      alert('选考流程更新失败')
    }
  }

  const toggleCompanyPassword = (companyId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }))
  }

  if (authLoading) {
    return <div className="auth-page">加载中...</div>
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>JobFlow</h1>
          <p>请登录后管理你的求职进度和公司账号信息。</p>

          <label>
            邮箱
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@gmail.com"
            />
          </label>

          <label>
            密码
            <div className="inline-input-button">
              <input
                type={showAuthPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
              />
              <button
                type="button"
                className="mini-button"
                onClick={() => setShowAuthPassword((prev) => !prev)}
              >
                {showAuthPassword ? '隐藏' : '显示'}
              </button>
            </div>
          </label>

          {isRegisterMode && (
            <label>
              确认密码
              <input
                type={showAuthPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="请再输入一次密码"
              />
            </label>
          )}

          {authError && <p className="error-text">{authError}</p>}

          <button className="primary-button auth-button" onClick={handleAuth}>
            {isRegisterMode ? '注册' : '登录'}
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
              ? '已有账号？点击登录'
              : '第一次使用？点击注册'}
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
          <p>求职进度、DDL、面试安排和公司账号信息管理工具</p>
          <p className="login-user">当前登录：{user.email}</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          退出登录
        </button>
      </header>

      <section className="toolbar toolbar-row">
        <button onClick={openAddForm}>＋添加公司</button>

        <input
          className="search-input"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="按公司名、职位、备注、活动等搜索"
        />
      </section>

      {isFormOpen && (
        <section className="form-card">
          <div className="form-header">
            <h2>{editingCompanyId ? '编辑公司' : '添加公司'}</h2>
            <button
              className="secondary-button"
              onClick={() => {
                resetForm()
                setIsFormOpen(false)
              }}
            >
              关闭
            </button>
          </div>

          <div className="form-grid">
            <label>
              公司名
              <input
                value={form.name}
                onChange={(event) => updateFormField('name', event.target.value)}
                placeholder="例：Fields 株式会社"
              />
            </label>

            <label>
              应聘职位
              <input
                value={form.position}
                onChange={(event) =>
                  updateFormField('position', event.target.value)
                }
                placeholder="例：设计师职位"
              />
            </label>

            <label>
              优先度
              <select
                value={form.priority}
                onChange={(event) =>
                  updateFormField('priority', event.target.value as Priority)
                }
              >
                <option value="high">高</option>
                <option value="middle">中</option>
                <option value="low">低</option>
              </select>
            </label>

            <label>
              状态
              <select
                value={form.status}
                onChange={(event) =>
                  updateFormField('status', event.target.value as CompanyStatus)
                }
              >
                <option value="active">进行中</option>
                <option value="waiting">等待结果</option>
                <option value="passed">通过 / 内定</option>
                <option value="rejected">落选</option>
                <option value="declined">辞退</option>
              </select>
            </label>

            <label>
              下一步要做
              <input
                value={form.nextAction}
                onChange={(event) =>
                  updateFormField('nextAction', event.target.value)
                }
                placeholder="例：提交 ES 和作品集"
              />
            </label>

            <label>
              DDL / 预定
              <input
                value={form.deadline}
                onChange={(event) =>
                  updateFormField('deadline', event.target.value)
                }
                placeholder="例：2026/6/30 18:00"
              />
            </label>

            <label>
              My Page 网址
              <input
                value={form.myPageUrl}
                onChange={(event) =>
                  updateFormField('myPageUrl', event.target.value)
                }
                placeholder="https://..."
              />
            </label>

            <label>
              My Page 登录 ID / 邮箱
              <input
                value={form.loginId}
                onChange={(event) =>
                  updateFormField('loginId', event.target.value)
                }
                placeholder="邮箱或登录 ID"
              />
            </label>

            <label>
              My Page 密码
              <input
                type="password"
                value={form.loginPassword}
                onChange={(event) =>
                  updateFormField('loginPassword', event.target.value)
                }
                placeholder="密码"
              />
            </label>
          </div>

          <label className="memo-field">
            备注
            <textarea
              value={form.memo}
              onChange={(event) => updateFormField('memo', event.target.value)}
              placeholder="邮件内容、提交材料、志望动机、面试准备等"
            />
          </label>

          <div className="steps-editor">
            <div className="steps-editor-header">
              <h3>选考流程</h3>
              <button className="secondary-button" onClick={addStep}>
                ＋添加阶段
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

                <span className={`step ${step.status}`}>
                  {step.status === 'done'
                    ? '已完成'
                    : step.status === 'current'
                      ? '下一步'
                      : '未开始'}
                </span>

                <button
                  className="danger-button"
                  onClick={() => deleteStep(step.id)}
                >
                  删除
                </button>
              </div>
            ))}

            <p className="form-hint">
              提示：添加或编辑公司时只需要填写阶段名称。之后可以直接点击公司卡片上的某个阶段来更新当前进度。
            </p>
          </div>

          <div className="events-editor">
            <div className="steps-editor-header">
              <h3>活动 / DDL</h3>
              <button className="secondary-button" onClick={addEvent}>
                ＋添加活动
              </button>
            </div>

            {form.events.length === 0 && (
              <p className="form-hint">
                还没有活动。可以添加说明会、ES截止、网测期限、面试时间等。
              </p>
            )}

            {form.events.map((event) => (
              <div className="event-editor-card" key={event.id}>
                <div className="event-editor-grid">
                  <label>
                    活动标题
                    <input
                      value={event.title}
                      onChange={(inputEvent) =>
                        updateEvent(event.id, 'title', inputEvent.target.value)
                      }
                      placeholder="例：ES提交截止 / 一面"
                    />
                  </label>

                  <label>
                    类型
                    <select
                      value={event.type}
                      onChange={(inputEvent) =>
                        updateEvent(
                          event.id,
                          'type',
                          inputEvent.target.value as EventType
                        )
                      }
                    >
                      <option value="deadline">DDL</option>
                      <option value="seminar">说明会</option>
                      <option value="interview">面试</option>
                      <option value="webtest">网测</option>
                      <option value="submission">提交材料</option>
                      <option value="other">其他</option>
                    </select>
                  </label>

                  <label>
                    开始时间
                    <input
                      type="datetime-local"
                      value={event.start}
                      onChange={(inputEvent) =>
                        updateEvent(event.id, 'start', inputEvent.target.value)
                      }
                    />
                  </label>

                  <label>
                    结束时间，可选
                    <input
                      type="datetime-local"
                      value={event.end}
                      onChange={(inputEvent) =>
                        updateEvent(event.id, 'end', inputEvent.target.value)
                      }
                    />
                  </label>
                </div>

                <label className="memo-field">
                  活动备注
                  <textarea
                    value={event.memo}
                    onChange={(inputEvent) =>
                      updateEvent(event.id, 'memo', inputEvent.target.value)
                    }
                    placeholder="例：Zoom链接、携带材料、面试官信息等"
                  />
                </label>

                <div className="form-actions">
                  <button
                    className="danger-button"
                    onClick={() => deleteEvent(event.id)}
                  >
                    删除活动
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button className="primary-button" onClick={saveCompany}>
              {editingCompanyId ? '更新' : '添加'}
            </button>
          </div>
        </section>
      )}

      <section className="company-list">
        {companiesLoading && <div className="empty-card">加载中...</div>}

        {!companiesLoading && companies.length === 0 && (
          <div className="empty-card">
            还没有公司信息。请先点击“＋添加公司”进行登记。
          </div>
        )}

        {!companiesLoading && companies.length > 0 && filteredCompanies.length === 0 && (
          <div className="empty-card">
            没有找到符合搜索条件的公司。
          </div>
        )}

        {!companiesLoading &&
          filteredCompanies.map((company) => (
            <article className="company-card" key={company.id}>
              <div className="company-header">
                <div>
                  <h2>{company.name}</h2>
                  <p>{company.position || '未填写职位'}</p>
                  <div className="badge-row">
                    <span className={`badge priority-${company.priority}`}>
                      优先度：{getPriorityLabel(company.priority)}
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
                      编辑
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => removeCompany(company)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>

              <div className="flow">
                {company.steps.map((step, index) => (
                  <div className="step-wrap" key={`${company.id}-${step.id}`}>
                    <button
                      type="button"
                      className={`step step-button ${step.status}`}
                      onClick={() => setCurrentStep(company, index)}
                      title="点击后将此阶段设为下一步"
                    >
                      {step.name}
                    </button>
                    {index < company.steps.length - 1 && (
                      <span className="arrow">→</span>
                    )}
                  </div>
                ))}
              </div>

              {company.nextAction && (
                <div className="next-action">
                  <strong>下一步：</strong>
                  {company.nextAction}
                </div>
              )}

              {company.events.length > 0 && (
                <div className="company-events">
                  <strong>活动：</strong>
                  <div className="company-event-list">
                    {company.events.map((event) => (
                      <span className="company-event-chip" key={event.id}>
                        {getEventTypeLabel(event.type)}：{event.title}
                      </span>
                    ))}
                  </div>
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
                    <strong>登录 ID：</strong>
                    {company.loginId}
                  </p>
                )}

                {company.loginPassword && (
                  <p className="password-row">
                    <strong>密码：</strong>
                    <span>
                      {visiblePasswords[company.id]
                        ? company.loginPassword
                        : '••••••••••••'}
                    </span>
                    <button
                      className="mini-button"
                      onClick={() => toggleCompanyPassword(company.id)}
                    >
                      {visiblePasswords[company.id] ? '隐藏' : '显示'}
                    </button>
                  </p>
                )}

                {company.memo && (
                  <p>
                    <strong>备注：</strong>
                    {company.memo}
                  </p>
                )}
              </div>
            </article>
          ))}
      </section>

      <section className="calendar-section">
        <div className="calendar-header">
          <h2>日历</h2>
          <p>公司词条中添加的活动会自动显示在这里。</p>
        </div>

        <div className="calendar-card">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locales={[zhCnLocale]}
            locale="zh-cn"
            initialView="dayGridMonth"
            height="auto"
            events={calendarEvents}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: '今天',
              month: '月',
              week: '周',
              day: '日',
            }}
            eventClick={(info) => {
              const props = info.event.extendedProps

              alert(
                [
                  `公司：${props.companyName}`,
                  `活动：${props.eventTitle}`,
                  `类型：${props.eventType}`,
                  `开始：${info.event.start?.toLocaleString() ?? ''}`,
                  `结束：${info.event.end?.toLocaleString() ?? '未设置'}`,
                  props.memo ? `备注：${props.memo}` : '',
                ]
                  .filter(Boolean)
                  .join('\n')
              )
            }}
          />
        </div>
      </section>
    </main>
  )
}

export default App