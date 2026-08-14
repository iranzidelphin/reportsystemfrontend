import { useEffect, useRef, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, CalendarDays, ChevronDown, CircleDollarSign, ClipboardList,
  Edit2, LayoutDashboard, LogOut, Menu, Package, Plus, ReceiptText, Search,
  Trash2, Users, Wallet, X,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import api from './services/api'
import './App.css'

const money = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0))
const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const liveRefreshMs = 10 * 60 * 1000

const navItems = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Transactions', '/transactions', ReceiptText],
  ['Reports', '/reports', BarChart3],
  ['Imported stock', '/expenses', Package],
  ['Users', '/users', Users],
]

const isAdmin = (user) => ['ADMIN', 'OWNER'].includes(user?.role)
const isManager = (user) => user?.role === 'MANAGER'
const canManageBusiness = (user) => isAdmin(user) || isManager(user)
const canManageAdmin = (user) => isAdmin(user)

const emptyTransaction = {
  productName: '',
  paidAmount: '',
  remainingAmount: '',
  paymentMethod: 'CASH',
  description: '',
}

const emptyStock = {
  description: '',
  amount: '',
  paymentMethod: 'CASH',
}

function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('shop_report_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      sessionStorage.removeItem('shop_report_user')
      sessionStorage.removeItem('shop_report_token')
      return null
    }
  })

  const saveAuth = (data) => {
    sessionStorage.setItem('shop_report_token', data.token)
    sessionStorage.setItem('shop_report_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const logout = () => {
    sessionStorage.removeItem('shop_report_token')
    sessionStorage.removeItem('shop_report_user')
    setUser(null)
  }

  return { user, saveAuth, logout }
}

function useApi(path, options = {}) {
  const params = options.params
  const initial = options.initial ?? null
  const enabled = options.enabled ?? true
  const refreshMs = options.refreshMs || 0
  const initialRef = useRef(initial)
  const [state, setState] = useState({ data: initial, loading: enabled, error: '' })
  const [poll, setPoll] = useState(0)
  const key = JSON.stringify(params || {})

  useEffect(() => {
    if (!enabled) {
      setState({ data: initialRef.current, loading: false, error: '' })
      return undefined
    }
    let alive = true
    const requestParams = key ? JSON.parse(key) : undefined
    setState((current) => ({ ...current, loading: true, error: '' }))
    api.get(path, { params: requestParams })
      .then(({ data }) => alive && setState({ data: data.data, meta: data.meta, loading: false, error: '' }))
      .catch((error) => alive && setState({ data: initialRef.current, loading: false, error: apiMessage(error) }))
    return () => { alive = false }
  }, [path, key, enabled, poll])

  useEffect(() => {
    if (!enabled || !refreshMs) return undefined
    const id = window.setInterval(() => setPoll((value) => value + 1), refreshMs)
    return () => window.clearInterval(id)
  }, [enabled, refreshMs])

  return state
}

function apiMessage(error) {
  return error.response?.data?.message || error.message || 'Something went wrong'
}

function Card({ children, className = '' }) {
  return <section className={'card ' + className}>{children}</section>
}

function AppShell({ children, title, auth }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const initials = auth.user?.name?.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'SR'

  return <div className="app-shell">
    {open && <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={'sidebar ' + (open ? 'open' : '')}>
      <div className="brand">
        <div className="brand-mark"><ReceiptText size={21} /></div>
        <div><strong>SHOP REPORT</strong><small>SYSTEM</small></div>
        <button className="mobile-close" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
      <div className="shop-label">BUSINESS WORKSPACE</div>
      <nav>{navItems.filter(([label]) => {
        if (label === 'Users') return canManageAdmin(auth.user)
        return true
      }).map(([label, path, Icon]) =>
        <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon size={18} /><span>{label}</span>
        </NavLink>)}</nav>
      <button className="logout" onClick={() => { auth.logout(); navigate('/login') }}><LogOut size={18} /> Logout</button>
      <p className="sidebar-foot">© 2026 Shop Report System</p>
    </aside>
    <main>
      <header className="topbar">
        <button className="menu-button" onClick={() => setOpen(true)}><Menu size={21} /></button>
        <div><p className="eyebrow">OVERVIEW</p><h1>{title}</h1></div>
        <div className="top-actions">
          <button className="icon-button"><Bell size={19} /><i /></button>
          <div className="avatar">{initials}</div>
          <div className="user-name"><strong>{auth.user?.name || 'Shop User'}</strong><span>{auth.user?.role || 'USER'}</span></div>
          <ChevronDown size={16} />
        </div>
      </header>
      {children}
    </main>
  </div>
}

function DateControls({ range, setRange, compact = false }) {
  return <div className={'date-controls ' + (compact ? 'compact' : '')}>
    <label><span>From date</span><input type="date" value={range.fromDate} onChange={(e) => setRange({ ...range, fromDate: e.target.value })} /></label>
    <label><span>To date</span><input type="date" value={range.toDate} onChange={(e) => setRange({ ...range, toDate: e.target.value })} /></label>
    <button className="button secondary" onClick={() => setRange({ ...range, fromDate: monthStart, toDate: today })}><CalendarDays size={16} /> This month</button>
    <button className="button"><Search size={16} /> Search</button>
  </div>
}

function TableState({ loading, error, empty, colSpan = 7 }) {
  if (loading) return <tr><td colSpan={colSpan} className="empty-cell">Loading records...</td></tr>
  if (error) return <tr><td colSpan={colSpan} className="empty-cell">{error}</td></tr>
  if (empty) return <tr><td colSpan={colSpan} className="empty-cell">No records found.</td></tr>
  return null
}

function TransactionTable({ rows = [], loading, error, adding = false, draft = emptyTransaction, setDraft, onSave, onCancel, saving = false, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState('')
  const [editDraft, setEditDraft] = useState(emptyTransaction)
  const [editing, setEditing] = useState(false)
  const totals = rows.reduce((sum, row) => ({
    paidAmount: sum.paidAmount + Number(row.paidAmount || 0),
    remainingAmount: sum.remainingAmount + Number(row.remainingAmount || 0),
  }), { paidAmount: 0, remainingAmount: 0 })
  const canChangeRows = Boolean(onUpdate || onDelete)
  const startEdit = (row) => {
    setEditingId(row._id)
    setEditDraft({
      productName: row.productOrService || row.serviceOrProduct || '',
      paidAmount: row.paidAmount ?? '',
      remainingAmount: row.remainingAmount ?? '',
      paymentMethod: row.paymentMethod || 'CASH',
      description: row.notes || '',
    })
  }
  const saveEdit = async () => {
    setEditing(true)
    try {
      await onUpdate?.(editingId, editDraft)
      setEditingId('')
      setEditDraft(emptyTransaction)
    } finally {
      setEditing(false)
    }
  }

  return <div className="table-wrap"><table>
    <thead><tr><th>Date</th><th>User</th><th>Product name</th><th>Paid</th><th>Rest</th><th>Method</th><th>Description</th><th></th></tr></thead>
    <tbody>
      {adding && <tr className="inline-row">
        <td>Today</td>
        <td>Me</td>
        <td><input required value={draft.productName} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} placeholder="Product name" /></td>
        <td><input required min="0" type="number" value={draft.paidAmount} onChange={(e) => setDraft({ ...draft, paidAmount: e.target.value })} placeholder="0" /></td>
        <td><input required min="0" type="number" value={draft.remainingAmount} onChange={(e) => setDraft({ ...draft, remainingAmount: e.target.value })} placeholder="0" /></td>
        <td><Select value={draft.paymentMethod} onChange={(paymentMethod) => setDraft({ ...draft, paymentMethod })} /></td>
        <td><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" /></td>
        <td className="row-buttons"><button className="button" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="button secondary" onClick={onCancel}>Cancel</button></td>
      </tr>}
      <TableState loading={loading} error={error} empty={!rows.length && !adding} colSpan={8} />
      {rows.map((t) => editingId === t._id ? <tr key={t._id} className="inline-row">
        <td>{new Date(t.saleDate || t.transactionDate || t.createdAt).toLocaleDateString()}</td>
        <td>{t.staff?.fullName || t.staff?.name || t.createdBy?.fullName || t.createdBy?.name || '-'}</td>
        <td><input required value={editDraft.productName} onChange={(e) => setEditDraft({ ...editDraft, productName: e.target.value })} /></td>
        <td><input required min="0" type="number" value={editDraft.paidAmount} onChange={(e) => setEditDraft({ ...editDraft, paidAmount: e.target.value })} /></td>
        <td><input required min="0" type="number" value={editDraft.remainingAmount} onChange={(e) => setEditDraft({ ...editDraft, remainingAmount: e.target.value })} /></td>
        <td><Select value={editDraft.paymentMethod} onChange={(paymentMethod) => setEditDraft({ ...editDraft, paymentMethod })} /></td>
        <td><input value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
        <td className="row-buttons"><button className="button" onClick={saveEdit} disabled={editing}>{editing ? 'Saving...' : 'Save'}</button><button className="button secondary" onClick={() => setEditingId('')}>Cancel</button></td>
      </tr> : <tr key={t._id}>
        <td>{new Date(t.saleDate || t.transactionDate || t.createdAt).toLocaleDateString()}</td>
        <td>{t.staff?.fullName || t.staff?.name || t.createdBy?.fullName || t.createdBy?.name || '-'}</td>
        <td><strong>{t.productOrService || t.serviceOrProduct}</strong></td>
        <td>{money(t.paidAmount)} <small>RWF</small></td>
        <td>{money(t.remainingAmount)} <small>RWF</small></td>
        <td>{t.paymentMethod === 'MOMO' ? 'MoMo Pay' : 'Cash'}</td>
        <td>{t.notes || '-'}</td>
        <td>{canChangeRows && <><button className="row-action" onClick={() => startEdit(t)}><Edit2 size={16} /></button><button className="row-action" onClick={() => onDelete?.(t._id)}><Trash2 size={16} /></button></>}</td>
      </tr>)}
      <tr className="total-row"><td colSpan="3">Total</td><td>{money(totals.paidAmount)} <small>RWF</small></td><td>{money(totals.remainingAmount)} <small>RWF</small></td><td colSpan="3"></td></tr>
    </tbody>
  </table></div>
}

function Dashboard({ auth }) {
  const [range, setRange] = useState({ fromDate: monthStart, toDate: today })
  const [refresh, setRefresh] = useState(0)
  const updateTransaction = async (id, data) => {
    await api.put(`/transactions/${id}`, data)
    setRefresh((value) => value + 1)
  }
  const deleteTransaction = async (id) => {
    await api.delete(`/transactions/${id}`)
    setRefresh((value) => value + 1)
  }
  const summary = useApi('/dashboard/summary', { params: { ...range, refresh }, initial: {}, refreshMs: liveRefreshMs })
  const recent = useApi('/transactions', { params: { ...range, limit: 5, refresh }, initial: [], refreshMs: liveRefreshMs })
  const stock = useApi('/expenses', { params: { ...range, refresh }, initial: [], refreshMs: liveRefreshMs })
  const data = summary.data || {}
  const paid = data.totalPaid || data.paidAmount || 0
  const unpaid = data.totalRemaining || data.notPaid || 0
  const imported = (stock.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const pie = [{ name: 'Earned', value: paid, color: '#246bfd' }, { name: 'Remaining', value: unpaid, color: '#f3ae35' }]

  return <AppShell title="Dashboard" auth={auth}><div className="page-content">
    <DateControls range={range} setRange={setRange} />
    {summary.error && <Notice tone="error">{summary.error}</Notice>}
    <div className="stat-grid">{[
      [CircleDollarSign, 'Money earned', money(paid), 'RWF', 'Today and selected dates', 'green'],
      [Wallet, 'Amount rest', money(unpaid), 'RWF', 'Remaining money', 'orange'],
      [ClipboardList, 'Transactions', data.transactionCount || 0, '', 'Selected period', 'purple'],
      [Package, 'Imported stock', money(imported), 'RWF', 'Selected period', 'blue'],
    ].map(([Icon, label, value, unit, note, color]) => <Card className="stat-card" key={label}>
      <div className={'stat-icon ' + color}><Icon size={20} /></div><p>{label}</p><h2>{value} <small>{unit}</small></h2><span className="change">{note}</span>
    </Card>)}</div>
    <div className="dashboard-grid">
      <Card className="recent"><SectionTitle title="Recent transactions" text="Latest sales activity" link="/transactions" /><TransactionTable rows={recent.data || []} loading={recent.loading} error={recent.error} onUpdate={updateTransaction} onDelete={deleteTransaction} /></Card>
      <Card className="payment-card">
        <div className="section-title"><div><h2>Payment summary</h2><p>Selected period</p></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={pie} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={4} stroke="none">{pie.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie><Tooltip formatter={(v) => `${money(v)} RWF`} /></PieChart></ResponsiveContainer><div className="chart-total"><strong>{money(paid)}</strong><span>Earned</span></div></div>
        <div className="legend">{pie.map((x) => <div key={x.name}><i style={{ background: x.color }} /><span>{x.name}</span><strong>{money(x.value)} RWF</strong></div>)}</div>
      </Card>
    </div>
    <Card className="recent dashboard-stock"><SectionTitle title="Recent imported stock" text="Latest inventory purchases by all users" link="/expenses" /><ResourceTable type="expenses" rows={(stock.data || []).slice(0, 5)} loading={stock.loading} error={stock.error} /></Card>
    <Card className="quick"><div><h2>Quick actions</h2><p>Work faster</p></div><NavLink className="quick-action" to="/transactions/new"><Plus /> New transaction</NavLink><NavLink className="quick-action muted" to="/reports"><BarChart3 /> View reports</NavLink></Card>
  </div></AppShell>
}

function SectionTitle({ title, text, link, action }) {
  return <div className="section-title"><div><h2>{title}</h2><p>{text}</p></div>{action || (link && <NavLink to={link}>View all</NavLink>)}</div>
}

function Notice({ children, tone = 'info' }) {
  return <div className={'notice ' + tone}>{children}</div>
}

function Login({ auth }) {
  const [phoneNumber, setPhoneNumber] = useState('0788721005')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const login = async (event) => {
    event?.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { phoneNumber, pin })
      auth.saveAuth(data.data)
      navigate('/dashboard')
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return <div className="login">
    <div className="login-panel">
      <div className="login-brand"><div className="brand-mark"><ReceiptText /></div><strong>SHOP REPORT</strong><span>SYSTEM</span></div>
      <div className="login-copy"><h1>Sign in</h1><p>Enter your phone number and PIN.</p></div>
      {error && <Notice tone="error">{error}</Notice>}
      <form className="login-form" onSubmit={login}>
        <label><span>Phone number</span><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="username" autoFocus placeholder="0788721005" /></label>
        <label><span>PIN</span><input inputMode="numeric" maxLength="4" pattern="[0-9]*" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="current-password" placeholder="Enter 4-digit PIN" /></label>
        <button className="login-button" disabled={pin.length !== 4 || phoneNumber.length < 7 || loading}>{loading ? 'Signing in...' : 'Sign in securely'}</button>
      </form>
    </div>
  </div>
}

function TransactionsPage({ auth }) {
  const [range, setRange] = useState({ fromDate: monthStart, toDate: today })
  const [refresh, setRefresh] = useState(0)
  const updateTransaction = async (id, data) => {
    await api.put(`/transactions/${id}`, data)
    setRefresh((value) => value + 1)
  }
  const deleteTransaction = async (id) => {
    await api.delete(`/transactions/${id}`)
    setRefresh((value) => value + 1)
  }
  const list = useApi('/transactions', { params: { ...range, limit: 50, refresh }, initial: [], refreshMs: liveRefreshMs })
  return <AppShell title="Transactions" auth={auth}><div className="page-content">
    <Hero title="Transactions" text="Record and review customer sales." action="/transactions/new" actionText="New transaction" />
    <DateControls range={range} setRange={setRange} compact />
    <Card className="recent"><SectionTitle title="All transactions" text="Showing records from your selected period" /><TransactionTable rows={list.data || []} loading={list.loading} error={list.error} onUpdate={updateTransaction} onDelete={deleteTransaction} /></Card>
  </div></AppShell>
}

function NewTransaction({ auth }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyTransaction)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await api.post('/transactions', { ...form, transactionDate: new Date().toISOString() })
      setMessage('Transaction saved successfully.')
      setForm(emptyTransaction)
    } catch (error) {
      setError(apiMessage(error))
    }
  }

  return <AppShell title="New transaction" auth={auth}><div className="page-content">
    <Card className="form-card"><SectionTitle title="Add transaction" text="Record a sale." />
      {message && <Notice>{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Product name"><input required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field>
          <Field label="Amount paid"><input required min="0" type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></Field>
          <Field label="Amount rest"><input required min="0" type="number" value={form.remainingAmount} onChange={(e) => setForm({ ...form, remainingAmount: e.target.value })} /></Field>
          <Field label="Payment method"><Select value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} /></Field>
          <Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <div className="form-actions"><button type="button" className="button secondary" onClick={() => navigate('/transactions')}>Cancel</button><button className="button">Save transaction</button></div>
      </form>
    </Card>
  </div></AppShell>
}

function Field({ label, children }) {
  return <label><span>{label}</span>{children}</label>
}

function Select({ value, onChange }) {
  return <select required value={value} onChange={(e) => onChange(e.target.value)}><option value="MOMO">MoMo Pay</option><option value="CASH">Cash</option></select>
}

function Hero({ title, text, action, actionText }) {
  return <Card className="page-hero"><div><p className="eyebrow">MANAGEMENT</p><h2>{title}</h2><p>{text}</p></div>{action && <div className="hero-buttons"><NavLink className="button" to={action}><Plus size={17} /> {actionText}</NavLink></div>}</Card>
}

function ReportsPage({ auth }) {
  const [range, setRange] = useState({ fromDate: today, toDate: today })
  const [refresh, setRefresh] = useState(0)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyTransaction)
  const [saving, setSaving] = useState(false)
  const reportParams = Object.fromEntries(Object.entries(range).filter(([, value]) => value))
  reportParams.refresh = refresh
  const report = useApi('/reports/sales', { params: reportParams, initial: { transactions: [], paymentMethods: {} }, refreshMs: liveRefreshMs })
  const data = report.data || {}
  const saveRow = async () => {
    setSaving(true)
    try {
      await api.post('/transactions', { ...draft, transactionDate: new Date().toISOString() })
      setDraft(emptyTransaction)
      setAdding(false)
      setRefresh((value) => value + 1)
    } finally {
      setSaving(false)
    }
  }
  const updateTransaction = async (id, data) => {
    await api.put(`/transactions/${id}`, data)
    setRefresh((value) => value + 1)
  }
  const deleteTransaction = async (id) => {
    await api.delete(`/transactions/${id}`)
    setRefresh((value) => value + 1)
  }
  const downloadReport = async () => {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(range).filter(([, value]) => value))).toString()
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/sales/pdf?${params}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('shop_report_token')}` },
    })
    const blob = await response.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  return <AppShell title="Reports" auth={auth}><div className="page-content">
    <Card className="page-hero"><div><p className="eyebrow">REPORTING</p><h2>Daily reports</h2><p>Totals update automatically from saved transactions.</p></div><div className="hero-buttons"><button className="button" onClick={downloadReport}>Download report</button></div></Card>
    <DateControls range={range} setRange={setRange} compact />
    <div className="stat-grid report-stats">{[
      ['Total money earned', data.totalMoneyEarned ?? data.totalPaid], ['Total remaining money', data.totalRemainingMoney ?? data.totalRemaining],
    ].map(([label, value]) => <Card className="stat-card" key={label}><p>{label}</p><h2>{money(value)} <small>RWF</small></h2></Card>)}</div>
    <Card className="recent"><SectionTitle title="Sales report" text="Transactions for the selected device date" action={<button className="button" onClick={() => setAdding(true)}><Plus size={16} /> Add row</button>} /><TransactionTable rows={data.transactions || []} loading={report.loading} error={report.error} adding={adding} draft={draft} setDraft={setDraft} onSave={saveRow} onCancel={() => { setAdding(false); setDraft(emptyTransaction) }} saving={saving} onUpdate={updateTransaction} onDelete={deleteTransaction} /></Card>
  </div></AppShell>
}

function ResourcePage({ auth, type, title }) {
  const endpoints = {
    expenses: '/expenses',
    users: '/users',
    logs: '/activity-logs',
  }
  const resource = useApi(endpoints[type], { initial: [] })
  const [form, setForm] = useState({})
  const [addingRow, setAddingRow] = useState(false)
  const [rowDraft, setRowDraft] = useState(emptyStock)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [range, setRange] = useState({ fromDate: today, toDate: today })
  const params = type === 'expenses' ? { ...range, refresh } : { refresh }
  const list = useApi(endpoints[type], { params, initial: [], refreshMs: type === 'expenses' ? liveRefreshMs : 0 })
  const data = type === 'logs' ? resource.data : list.data

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      if (editingId) await api.put(`${endpoints[type]}/${editingId}`, normalizeForm(type, form, Boolean(editingId)))
      else await api.post(endpoints[type], normalizeForm(type, form))
      setForm({})
      setEditingId('')
      setRefresh((x) => x + 1)
      setMessage(editingId ? 'Saved successfully.' : 'Created successfully.')
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }
  const edit = (row) => {
    if (type !== 'users') return
    setEditingId(row._id)
    setForm({ username: row.fullName || row.name || '', phoneNumber: row.phoneNumber || '', pin: '' })
  }
  const remove = async (id) => {
    setMessage(''); setError('')
    try {
      await api.delete(`${endpoints[type]}/${id}`)
      setRefresh((x) => x + 1)
      setMessage('Deleted successfully.')
    } catch (error) {
      setError(apiMessage(error))
    }
  }
  const saveStockRow = async () => {
    setSaving(true); setMessage(''); setError('')
    try {
      await api.post(endpoints[type], normalizeForm(type, rowDraft))
      setRowDraft(emptyStock)
      setAddingRow(false)
      setRefresh((x) => x + 1)
      setMessage('Imported stock saved.')
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }
  const updateStockRow = async (id, stock) => {
    setMessage(''); setError('')
    try {
      await api.put(`${endpoints[type]}/${id}`, normalizeForm(type, stock))
      setRefresh((x) => x + 1)
      setMessage('Imported stock updated.')
    } catch (error) {
      setError(apiMessage(error))
      throw error
    }
  }
  const downloadStockReport = async () => {
    const params = new URLSearchParams(range).toString()
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/imported-stock/pdf?${params}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('shop_report_token')}` },
    })
    const blob = await response.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  return <AppShell title={title} auth={auth}><div className="page-content">
    {type === 'expenses' ? <Card className="page-hero"><div><p className="eyebrow">MANAGEMENT</p><h2>{title}</h2><p>Imported stock by selected date.</p></div><div className="hero-buttons"><button className="button" onClick={downloadStockReport}>Download report</button></div></Card> : <Hero title={title} text={type === 'logs' ? 'Review team activity across the system.' : `Manage ${title.toLowerCase()} from the live database.`} />}
    {type === 'expenses' && <DateControls range={range} setRange={setRange} compact />}
    {message && <Notice>{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {type === 'users' && <Card className="form-card compact-form"><SectionTitle title={editingId ? 'Edit user' : 'Add user'} text="Username, phone number, and PIN only." /><form onSubmit={submit}><ResourceFields type={type} form={form} setForm={setForm} editing={Boolean(editingId)} /><div className="form-actions">{editingId && <button type="button" className="button secondary" onClick={() => { setEditingId(''); setForm({}) }}>Cancel edit</button>}<button className="button" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div></form></Card>}
    <Card className="recent"><SectionTitle title={`All ${title.toLowerCase()}`} text={type === 'expenses' ? 'Inventory purchases' : 'Live records from MongoDB'} action={type === 'expenses' && <button className="button" onClick={() => setAddingRow(true)}><Plus size={16} /> Add row</button>} /><ResourceTable type={type} rows={data || []} loading={(type === 'logs' ? resource : list).loading} error={(type === 'logs' ? resource : list).error} onDelete={remove} onEdit={type === 'expenses' ? undefined : edit} onUpdate={type === 'expenses' ? updateStockRow : undefined} adding={addingRow} draft={rowDraft} setDraft={setRowDraft} onSave={saveStockRow} onCancel={() => { setAddingRow(false); setRowDraft(emptyStock) }} saving={saving} /></Card>
  </div></AppShell>
}

function normalizeForm(type, form, editing = false) {
  if (type === 'expenses') return { description: form.description, amount: Number(form.amount || 0), paymentMethod: form.paymentMethod || 'CASH' }
  const data = { username: form.username, phoneNumber: form.phoneNumber }
  if (!editing || form.pin) data.pin = form.pin
  return data
}

function ResourceFields({ type, form, setForm, editing = false }) {
  const set = (key, value) => setForm({ ...form, [key]: value })
  if (type === 'expenses') return <div className="form-grid"><Field label="Description"><input required value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></Field><Field label="Amount"><input required type="number" min="1" value={form.amount || ''} onChange={(e) => set('amount', e.target.value)} /></Field><Field label="Payment method"><Select value={form.paymentMethod || 'CASH'} onChange={(v) => set('paymentMethod', v)} /></Field></div>
  return <div className="form-grid"><Field label="Username"><input required value={form.username || ''} onChange={(e) => set('username', e.target.value)} /></Field><Field label="Phone number"><input required inputMode="numeric" value={form.phoneNumber || ''} onChange={(e) => set('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field><Field label="PIN"><input required={!editing} inputMode="numeric" maxLength="4" pattern="[0-9]*" type="password" value={form.pin || ''} onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field></div>
}

function ResourceTable({ type, rows = [], loading, error, onDelete, onEdit, onUpdate, adding = false, draft = emptyStock, setDraft, onSave, onCancel, saving = false }) {
  const [editingId, setEditingId] = useState('')
  const [editDraft, setEditDraft] = useState(emptyStock)
  const [editing, setEditing] = useState(false)
  const cols = {
    expenses: ['Date', 'User', 'What imported', 'Amount', 'Payment method'],
    users: ['Username', 'Phone number'],
    logs: ['Action', 'Description', 'User', 'Time'],
  }[type]
  const stockTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const startStockEdit = (row) => {
    setEditingId(row._id)
    setEditDraft({ description: row.description || '', amount: row.amount ?? '', paymentMethod: row.paymentMethod || 'CASH' })
  }
  const saveStockEdit = async () => {
    setEditing(true)
    try {
      await onUpdate?.(editingId, editDraft)
      setEditingId('')
      setEditDraft(emptyStock)
    } finally {
      setEditing(false)
    }
  }
  return <div className="table-wrap"><table><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}<th></th></tr></thead><tbody>
    {type === 'expenses' && adding && <tr className="inline-row">
      <td>Today</td>
      <td>Me</td>
      <td><input required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Imported item" /></td>
      <td><input required min="1" type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="0" /></td>
      <td><Select value={draft.paymentMethod} onChange={(paymentMethod) => setDraft({ ...draft, paymentMethod })} /></td>
      <td className="row-buttons"><button className="button" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="button secondary" onClick={onCancel}>Cancel</button></td>
    </tr>}
    <TableState loading={loading} error={error} empty={!rows.length && !adding} colSpan={cols.length + 1} />
    {rows.map((row) => type === 'expenses' && editingId === row._id ? <tr key={row._id} className="inline-row">
      <td>{new Date(row.expenseDate || row.date || row.createdAt).toLocaleDateString()}</td>
      <td>{row.createdBy?.fullName || row.createdBy?.name || '-'}</td>
      <td><input required value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
      <td><input required min="1" type="number" value={editDraft.amount} onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })} /></td>
      <td><Select value={editDraft.paymentMethod} onChange={(paymentMethod) => setEditDraft({ ...editDraft, paymentMethod })} /></td>
      <td className="row-buttons"><button className="button" onClick={saveStockEdit} disabled={editing}>{editing ? 'Saving...' : 'Save'}</button><button className="button secondary" onClick={() => setEditingId('')}>Cancel</button></td>
    </tr> : <tr key={row._id}>{resourceCells(type, row).map((cell, i) => <td key={i}>{cell}</td>)}<td>{type === 'expenses' && onUpdate && <button className="row-action" onClick={() => startStockEdit(row)}><Edit2 size={16} /></button>}{type === 'users' && onEdit && <button className="row-action" onClick={() => onEdit(row)}><Edit2 size={16} /></button>}{type !== 'logs' && onDelete && <button className="row-action" onClick={() => onDelete(row._id)}><Trash2 size={16} /></button>}</td></tr>)}
    {type === 'expenses' && <tr className="total-row"><td colSpan="3">Total</td><td>{money(stockTotal)} <small>RWF</small></td><td colSpan="2"></td></tr>}
  </tbody></table></div>
}

function resourceCells(type, row) {
  if (type === 'expenses') return [new Date(row.expenseDate || row.date || row.createdAt).toLocaleDateString(), row.createdBy?.fullName || row.createdBy?.name || '-', <strong key="description">{row.description}</strong>, `${money(row.amount)} RWF`, row.paymentMethod === 'MOMO' ? 'MoMo Pay' : 'Cash']
  if (type === 'users') return [<strong key="name">{row.fullName || row.name}</strong>, row.phoneNumber || '-']
  return [row.action, row.description, row.user?.fullName || row.user?.name || '-', new Date(row.timestamp).toLocaleString()]
}

function Protected({ children }) {
  return sessionStorage.getItem('shop_report_token') ? children : <Navigate to="/login" replace />
}

function RoleProtected({ auth, admin = false, business = false, children }) {
  if (admin && !canManageAdmin(auth.user)) return <Navigate to="/dashboard" replace />
  if (business && !canManageBusiness(auth.user)) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const auth = useAuth()
  const protect = (children) => <Protected auth={auth}>{children}</Protected>
  return <Routes>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<Login auth={auth} />} />
    <Route path="/dashboard" element={protect(<Dashboard auth={auth} />)} />
    <Route path="/transactions/new" element={protect(<NewTransaction auth={auth} />)} />
    <Route path="/transactions" element={protect(<TransactionsPage auth={auth} />)} />
    <Route path="/reports" element={protect(<ReportsPage auth={auth} />)} />
    <Route path="/expenses" element={protect(<ResourcePage auth={auth} type="expenses" title="Imported stock" />)} />
    <Route path="/users" element={protect(<RoleProtected auth={auth} admin><ResourcePage auth={auth} type="users" title="Users management" /></RoleProtected>)} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
}

function App() {
  return <HashRouter><AppRoutes /></HashRouter>
}

export default App
