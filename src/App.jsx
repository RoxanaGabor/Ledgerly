import { useEffect, useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { categories, seedExpenses, seedIncome, seedSites } from './data'
import { money, shortDate, sum, taxEstimate, uid } from './utils'

const nav = [
  ['dashboard', 'Dashboard', Icons.LayoutDashboard], ['income', 'Income', Icons.ArrowDownToLine],
  ['expenses', 'Expenses', Icons.ReceiptText], ['receipts', 'Receipts', Icons.ScanLine],
  ['sites', 'Sites', Icons.MapPin], ['reports', 'Reports', Icons.ChartNoAxesCombined],
  ['tax', 'Tax centre', Icons.Landmark], ['year-end', 'Year-end', Icons.PackageCheck],
  ['documents', 'Documents', Icons.FolderOpen], ['settings', 'Settings', Icons.Settings]
]

const getStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

const DATA_VERSION = 'clean-v1'
function clearLegacyDemoData() {
  if (localStorage.getItem('cis-data-version') !== DATA_VERSION) {
    ;['cis-income', 'cis-expenses', 'cis-sites'].forEach(key => localStorage.removeItem(key))
    localStorage.setItem('cis-data-version', DATA_VERSION)
  }
}

export default function App() {
  clearLegacyDemoData()
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('cis-authenticated') === 'yes')
  const [page, setPage] = useState('dashboard')
  const [income, setIncome] = useState(() => getStored('cis-income', seedIncome))
  const [expenses, setExpenses] = useState(() => getStored('cis-expenses', seedExpenses))
  const [sites, setSites] = useState(() => getStored('cis-sites', seedSites))
  const [dark, setDark] = useState(() => getStored('cis-dark', false))
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => localStorage.setItem('cis-income', JSON.stringify(income)), [income])
  useEffect(() => localStorage.setItem('cis-expenses', JSON.stringify(expenses)), [expenses])
  useEffect(() => localStorage.setItem('cis-sites', JSON.stringify(sites)), [sites])
  useEffect(() => localStorage.setItem('cis-dark', JSON.stringify(dark)), [dark])
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id) } }, [toast])

  const totals = useMemo(() => {
    const gross = sum(income, x => x.gross)
    const cis = sum(income, x => x.gross * x.cisRate / 100)
    const spent = sum(expenses, x => x.amount * x.business / 100)
    const profit = gross - spent
    return { gross, cis, spent, profit, tax: taxEstimate(profit) }
  }, [income, expenses])

  const missingReceipts = expenses.filter(x => !x.receipt)
  const hasRecords = income.length + expenses.length > 0
  const health = hasRecords ? Math.max(0, Math.round(100 - missingReceipts.length * 8 - income.filter(x => !x.attachment).length * 5)) : 0
  const traffic = !hasRecords ? 'amber' : health >= 90 ? 'green' : health >= 70 ? 'amber' : 'red'

  const addRecord = (type, record) => {
    if (type === 'income') setIncome(v => [{ ...record, id: uid('i') }, ...v])
    if (type === 'expense') setExpenses(v => [{ ...record, id: uid('e') }, ...v])
    if (type === 'site') setSites(v => [{ ...record, id: uid('s') }, ...v])
    setModal(null); setToast(`${type[0].toUpperCase() + type.slice(1)} saved`)
  }

  const exportCsv = (rows, filename) => {
    if (!rows.length) return
    const keys = Object.keys(rows[0]).filter(k => k !== 'id')
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = filename; a.click(); URL.revokeObjectURL(a.href)
    setToast('CSV export prepared')
  }

  const openSearchResult = (target) => { setPage(target); setQuery('') }
  const searchResults = query.length > 1 ? [
    ...income.filter(x => Object.values(x).join(' ').toLowerCase().includes(query.toLowerCase())).map(x => ({ type: 'income', title: `${money(x.gross)} income`, detail: x.site })),
    ...expenses.filter(x => Object.values(x).join(' ').toLowerCase().includes(query.toLowerCase())).map(x => ({ type: 'expenses', title: x.description, detail: `${x.supplier} · ${money(x.amount)}` })),
    ...sites.filter(x => Object.values(x).join(' ').toLowerCase().includes(query.toLowerCase())).map(x => ({ type: 'sites', title: x.name, detail: x.address }))
  ].slice(0, 7) : []

  const props = { income, expenses, sites, totals, health, traffic, missingReceipts, setModal, setToast, exportCsv, setIncome, setExpenses }
  const views = { dashboard: Dashboard, income: Income, expenses: Expenses, receipts: Receipts, sites: Sites, reports: Reports, tax: TaxCentre, 'year-end': YearEnd, documents: Documents, settings: SettingsPage }
  const View = views[page]

  if (!loggedIn) return <AuthScreen onAuthenticated={() => { sessionStorage.setItem('cis-authenticated', 'yes'); setLoggedIn(true) }}/>

  return <div className={dark ? 'app dark' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Icons.ChartSpline size={21}/></div><div><strong>Ledgerly</strong><span>CIS Bookkeeper</span></div></div>
      <div className="company-switch"><div className="avatar">BG</div><div><strong>Your business</strong><span>2026–27 tax year</span></div><Icons.ChevronsUpDown size={14}/></div>
      <nav>{nav.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><Icon size={18}/><span>{label}</span>{key === 'receipts' && missingReceipts.length > 0 && <em>{missingReceipts.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => setDark(v => !v)}>{dark ? <Icons.Sun size={18}/> : <Icons.Moon size={18}/>}<span>{dark ? 'Light mode' : 'Dark mode'}</span></button><div className="user"><div className="avatar">BG</div><div><strong>Bogdan Gabor</strong><span>Administrator</span></div><button className="logout" title="Sign out" onClick={() => { sessionStorage.removeItem('cis-authenticated'); setLoggedIn(false) }}><Icons.LogOut size={16}/></button></div></div>
    </aside>
    <main>
      <header className="topbar">
        <div className="search"><Icons.Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search transactions, sites, documents…"/><kbd>⌘ K</kbd>
          {query.length > 1 && <div className="search-results">{searchResults.length ? searchResults.map((r, i) => <button key={i} onClick={() => openSearchResult(r.type)}><Icons.Search size={15}/><span><strong>{r.title}</strong><small>{r.detail}</small></span></button>) : <p>No results found</p>}</div>}
        </div>
        <button className="icon-btn"><Icons.HelpCircle size={19}/></button><button className="icon-btn notification"><Icons.Bell size={19}/><i/></button>
        <button className="primary compact" onClick={() => setModal(page === 'income' ? 'income' : 'expense')}><Icons.Plus size={17}/> Add transaction</button>
      </header>
      <div className="content"><View {...props}/></div>
    </main>
    {modal && <RecordModal type={modal} sites={sites} onClose={() => setModal(null)} onSave={addRecord}/>} 
    {toast && <div className="toast"><Icons.CircleCheck size={18}/>{toast}</div>}
  </div>
}

async function passwordHash(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('')
}

function AuthScreen({ onAuthenticated }) {
  const savedLogin = getStored('cis-admin-login', null)
  const setup = !savedLogin
  const [username, setUsername] = useState(setup ? '' : savedLogin.username)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault(); setError('')
    const cleanUsername = username.trim().toLowerCase()
    if (!cleanUsername) return setError('Enter a username.')
    if (password.length < 8) return setError('Password must contain at least 8 characters.')
    if (setup && password !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    const hash = await passwordHash(password)
    if (setup) {
      localStorage.setItem('cis-admin-login', JSON.stringify({ username: cleanUsername, hash }))
      onAuthenticated()
    } else if (cleanUsername === savedLogin.username && hash === savedLogin.hash) {
      onAuthenticated()
    } else {
      setError('Incorrect username or password.')
    }
    setBusy(false)
  }

  return <div className="auth-page">
    <div className="auth-brand"><div className="brand-mark"><Icons.ChartSpline size={22}/></div><div><strong>Ledgerly</strong><span>CIS Bookkeeper</span></div></div>
    <div className="auth-shell">
      <section className="auth-intro"><span className="auth-kicker">Private. Organised. Ready.</span><h1>Your CIS books,<br/>all in one place.</h1><p>Track income, expenses, receipts and tax estimates with a workspace built for UK subcontractors.</p><div className="auth-points"><span><Icons.ShieldCheck/>Private administrator access</span><span><Icons.Calculator/>Automatic CIS calculations</span><span><Icons.FileCheck2/>Year-end records in one place</span></div></section>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-avatar">BG</div>
        <span className="eyebrow">Administrator access</span>
        <h2>{setup ? 'Create your login' : 'Welcome back, Bogdan'}</h2>
        <p>{setup ? 'Set the credentials you’ll use to access the bookkeeping workspace.' : 'Sign in to access the bookkeeping workspace.'}</p>
        <label>Username<div className="auth-input"><Icons.UserRound size={17}/><input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Choose a username"/></div></label>
        <label>Password<div className="auth-input"><Icons.LockKeyhole size={17}/><input type={showPassword?'text':'password'} autoComplete={setup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<Icons.EyeOff size={17}/>:<Icons.Eye size={17}/>}</button></div></label>
        {setup && <label>Confirm password<div className="auth-input"><Icons.LockKeyhole size={17}/><input type={showPassword?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Enter password again"/></div></label>}
        {error && <div className="auth-error"><Icons.AlertCircle size={16}/>{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : setup ? 'Create login & continue' : 'Sign in'}<Icons.ArrowRight size={17}/></button>
        <small><Icons.Lock size={12}/> Your login remains on this device.</small>
      </form>
    </div>
    <footer>Ledgerly CIS · Secure bookkeeping for Bogdan Gabor</footer>
  </div>
}

function PageHead({ eyebrow, title, text, children }) { return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div><div className="page-actions">{children}</div></div> }
function Card({ children, className = '' }) { return <section className={`card ${className}`}>{children}</section> }
function Delta({ children, down }) { return <span className={down ? 'delta down' : 'delta'}>{down ? <Icons.TrendingDown size={13}/> : <Icons.TrendingUp size={13}/>} {children}</span> }

function Dashboard({ totals, health, traffic, missingReceipts, income, expenses, setModal, sites }) {
  const chart = Array(12).fill(0)
  const hasRecords = income.length + expenses.length > 0
  return <>
    <PageHead eyebrow="Friday, 17 July" title="Good afternoon, Bogdan" text="Here’s how the books are looking for the 2026–27 tax year."><button className="secondary"><Icons.CalendarDays size={17}/> 6 Apr 2026 – 5 Apr 2027</button></PageHead>
    <div className={`health-banner ${traffic}`}><div className="health-icon"><Icons.ShieldCheck size={24}/></div><div><strong>{!hasRecords ? 'Ready when you are' : traffic === 'green' ? 'Everything is up to date' : 'Your books need a little attention'}</strong><span>{!hasRecords ? 'Add your first income or expense to begin tracking your bookkeeping health.' : missingReceipts.length ? `${missingReceipts.length} receipts are missing. Add them to keep your records complete.` : 'No urgent tasks. Your bookkeeping is in excellent shape.'}</span></div><div className="score"><b>{health}</b><span>/ 100 health</span></div><button>Review tasks <Icons.ArrowRight size={16}/></button></div>
    <div className="stats-grid">
      <Card><div className="stat-label"><span className="tint green"><Icons.ArrowDownToLine size={17}/></span>Total income<Icons.Info size={14}/></div><h2>{money(totals.gross)}</h2><span className="muted">No comparison data</span></Card>
      <Card><div className="stat-label"><span className="tint coral"><Icons.ArrowUpFromLine size={17}/></span>Total expenses<Icons.Info size={14}/></div><h2>{money(totals.spent)}</h2><span className="muted">No comparison data</span></Card>
      <Card><div className="stat-label"><span className="tint blue"><Icons.BadgePoundSterling size={17}/></span>Net profit<Icons.Info size={14}/></div><h2>{money(totals.profit)}</h2><span className="muted">No comparison data</span></Card>
      <Card><div className="stat-label"><span className="tint gold"><Icons.PiggyBank size={17}/></span>Tax to set aside<Icons.Info size={14}/></div><h2>{money(Math.max(0, totals.tax.total - totals.cis))}</h2><span className="muted">After {money(totals.cis)} CIS deducted</span></Card>
    </div>
    <div className="dashboard-grid">
      <Card className="profit-card"><div className="card-head"><div><h3>Income & expenses</h3><p>Monthly performance</p></div><div className="legend"><i className="l-income"/>Income <i className="l-expense"/>Expenses</div></div><div className="chart"><div className="ylabels"><span>£3k</span><span>£2k</span><span>£1k</span><span>£0</span></div><div className="bars">{chart.map((n,i) => <div className="bar-pair" key={i}><i style={{height:`${n}%`}}/><b style={{height:`${Math.max(12,n*.28)}%`}}/><span>{['A','M','J','J','A','S','O','N','D','J','F','M'][i]}</span></div>)}</div></div></Card>
      <Card className="tasks-card"><div className="card-head"><div><h3>Today’s tasks</h3><p>{missingReceipts.length + 2} items need attention</p></div><button className="text-btn">View all</button></div>
        <Task icon={Icons.Receipt} tone="amber" title={`${missingReceipts.length} missing receipts`} text="Upload or match receipts"/>
        <Task icon={Icons.RefreshCw} tone="blue" title="Bank reconciliation" text="Last reconciled 8 days ago"/>
        <Task icon={Icons.ClipboardCheck} tone="purple" title="Complete weekly review" text="Due today"/>
        <button className="complete-week"><Icons.CheckCircle2 size={18}/> Complete this week</button>
      </Card>
      <Card className="activity"><div className="card-head"><div><h3>Recent activity</h3><p>Latest changes to your books</p></div><button className="text-btn">View audit log</button></div>
        {[...expenses.slice(0,3).map(x => ({ icon: Icons.ReceiptText, title: `${x.supplier} expense added`, detail: `${money(x.amount)} · ${x.category}`, date: x.date })), ...income.slice(0,2).map(x => ({ icon: Icons.ArrowDownToLine, title: 'Income payment recorded', detail: `${money(x.gross)} · ${x.site}`, date: x.date }))].map((a,i)=><div className="activity-row" key={i}><span><a.icon size={16}/></span><div><strong>{a.title}</strong><small>{a.detail}</small></div><time>{shortDate(a.date)}</time></div>)}
        {!hasRecords && <div className="empty-inline"><Icons.Activity size={20}/><span>No activity yet</span></div>}
      </Card>
      <Card className="quick"><div className="card-head"><div><h3>Quick actions</h3><p>Common bookkeeping tasks</p></div></div><div className="quick-grid"><button onClick={() => setModal('income')}><span><Icons.ArrowDownToLine/></span>Add income</button><button onClick={() => setModal('expense')}><span><Icons.ReceiptText/></span>Add expense</button><button><span><Icons.Upload/></span>Upload receipt</button><button><span><Icons.FileBarChart/></span>Run report</button></div><div className="site-mini"><span className="tint green"><Icons.MapPin size={17}/></span><div><small>Current site</small><strong>{sites.find(s=>s.status==='Active')?.name || 'No active site'}</strong></div><Icons.ChevronRight size={18}/></div></Card>
    </div>
  </>
}

function Task({ icon: Icon, tone, title, text }) { return <div className="task"><span className={`tint ${tone}`}><Icon size={17}/></span><div><strong>{title}</strong><small>{text}</small></div><Icons.ChevronRight size={17}/></div> }

function Income({ income, totals, setModal, exportCsv }) {
  return <><PageHead eyebrow="Money in" title="Income ledger" text="Track gross payments and CIS deductions across every site."><button className="secondary" onClick={() => exportCsv(income, 'income-ledger.csv')}><Icons.Download size={17}/> Export</button><button className="primary" onClick={() => setModal('income')}><Icons.Plus size={17}/> Add income</button></PageHead>
    <div className="mini-stats"><Card><span>Gross income</span><b>{money(totals.gross)}</b></Card><Card><span>CIS deducted</span><b>{money(totals.cis)}</b></Card><Card><span>Net received</span><b>{money(totals.gross-totals.cis)}</b></Card></div>
    <LedgerToolbar/><Card className="table-card"><table><thead><tr><th>Date</th><th>Site</th><th className="number">Gross</th><th className="number">CIS</th><th className="number">Deduction</th><th className="number">Net received</th><th>Method</th><th>Statement</th><th/></tr></thead><tbody>{income.map(x => <tr key={x.id}><td>{shortDate(x.date)}</td><td><strong>{x.site}</strong></td><td className="number">{money(x.gross)}</td><td className="number">{x.cisRate}%</td><td className="number red-text">−{money(x.gross*x.cisRate/100)}</td><td className="number"><strong>{money(x.gross*(1-x.cisRate/100))}</strong></td><td>{x.method}</td><td>{x.attachment ? <span className="status complete"><Icons.Paperclip size={13}/> Attached</span> : <span className="status warning">Missing</span>}</td><td><Icons.MoreHorizontal size={17}/></td></tr>)}</tbody><tfoot><tr><td colSpan="2">Tax year total</td><td className="number">{money(totals.gross)}</td><td/><td className="number">−{money(totals.cis)}</td><td className="number">{money(totals.gross-totals.cis)}</td><td colSpan="3"/></tr></tfoot></table></Card>
  </>
}

function Expenses({ expenses, totals, setModal, exportCsv }) {
  return <><PageHead eyebrow="Money out" title="Expense ledger" text="Categorise business costs and keep every receipt accounted for."><button className="secondary" onClick={() => exportCsv(expenses, 'expense-ledger.csv')}><Icons.Download size={17}/> Export</button><button className="primary" onClick={() => setModal('expense')}><Icons.Plus size={17}/> Add expense</button></PageHead>
    <div className="mini-stats"><Card><span>Allowable expenses</span><b>{money(totals.spent)}</b></Card><Card><span>Total VAT recorded</span><b>{money(sum(expenses,x=>x.vat))}</b></Card><Card><span>Missing receipts</span><b>{expenses.filter(x=>!x.receipt).length}</b></Card></div>
    <LedgerToolbar/><Card className="table-card"><table><thead><tr><th>Date</th><th>Supplier / description</th><th>Site</th><th>Category</th><th className="number">Amount</th><th className="number">Business</th><th>Receipt</th><th/></tr></thead><tbody>{expenses.map(x => <tr key={x.id}><td>{shortDate(x.date)}</td><td><strong>{x.supplier}</strong><small>{x.description}</small></td><td>{x.site}</td><td><span className="tag">{x.category}</span></td><td className="number"><strong>{money(x.amount)}</strong></td><td className="number">{x.business}%</td><td>{x.receipt ? <span className="status complete"><Icons.CircleCheck size={13}/> Matched</span> : <span className="status warning"><Icons.AlertCircle size={13}/> Missing</span>}</td><td><Icons.MoreHorizontal size={17}/></td></tr>)}</tbody><tfoot><tr><td colSpan="4">Tax year total</td><td className="number">{money(sum(expenses,x=>x.amount))}</td><td/><td colSpan="2"/></tr></tfoot></table></Card>
  </>
}

function LedgerToolbar() { return <div className="ledger-toolbar"><div className="field-search"><Icons.Search size={16}/><input placeholder="Search this ledger…"/></div><button><Icons.Filter size={16}/> Filter</button><button><Icons.Columns3 size={16}/> Columns</button><span className="spacer"/><button><Icons.ArrowUpDown size={16}/> Sort</button></div> }

function Receipts({ expenses, missingReceipts }) { return <><PageHead eyebrow="Receipt manager" title="Receipts" text="Upload, match and organise evidence for every business purchase."><button className="primary"><Icons.Upload size={17}/> Upload receipts</button></PageHead><div className="receipt-layout"><Card className="upload-zone"><div className="upload-icon"><Icons.CloudUpload/></div><h3>Drop receipts here</h3><p>PDF, JPG, PNG or HEIC · up to 20 MB</p><button className="secondary">Choose files</button><small>Receipt details will be read automatically</small></Card><Card><div className="card-head"><div><h3>Receipt status</h3><p>This tax year</p></div></div><div className="donut" style={{'--value': `${(expenses.length-missingReceipts.length)/expenses.length*100}%`}}><div><b>{expenses.length-missingReceipts.length}</b><span>matched</span></div></div><div className="receipt-legend"><span><i className="green-dot"/>Matched <b>{expenses.length-missingReceipts.length}</b></span><span><i className="amber-dot"/>Missing <b>{missingReceipts.length}</b></span></div></Card></div><Card className="table-card"><div className="card-head padded"><div><h3>Missing receipts</h3><p>Transactions waiting for evidence</p></div></div><table><thead><tr><th>Date</th><th>Supplier</th><th>Description</th><th>Category</th><th className="number">Amount</th><th/></tr></thead><tbody>{missingReceipts.map(x=><tr key={x.id}><td>{shortDate(x.date)}</td><td><strong>{x.supplier}</strong></td><td>{x.description}</td><td><span className="tag">{x.category}</span></td><td className="number">{money(x.amount)}</td><td><button className="small-action"><Icons.Upload size={14}/> Add receipt</button></td></tr>)}</tbody></table></Card></> }

function Sites({ sites, income, expenses, setModal }) { return <><PageHead eyebrow="Work locations" title="Sites" text="See where you worked and understand the profit from each job."><button className="primary" onClick={()=>setModal('site')}><Icons.Plus size={17}/> Add site</button></PageHead><div className="site-grid">{sites.map(site=>{const inc=sum(income.filter(x=>x.site===site.name),x=>x.gross);const exp=sum(expenses.filter(x=>x.site===site.name),x=>x.amount*x.business/100);return <Card key={site.id} className="site-card"><div className="site-card-top"><span className="site-pin"><Icons.MapPin/></span><span className={`status ${site.status==='Active'?'complete':'neutral'}`}>{site.status}</span><button><Icons.MoreHorizontal/></button></div><h3>{site.name}</h3><p>{site.address}</p><div className="site-numbers"><div><span>Income</span><b>{money(inc)}</b></div><div><span>Expenses</span><b>{money(exp)}</b></div><div><span>Profit</span><b>{money(inc-exp)}</b></div></div><div className="profit-meter"><i style={{width:`${inc ? Math.max(2,(inc-exp)/inc*100):0}%`}}/></div><small>Started {shortDate(site.start)}</small></Card>})}</div></> }

function Reports({ income, expenses, totals, exportCsv }) { const reports=[['Profit & loss','A complete view of income, costs and net profit',Icons.ChartNoAxesCombined],['Income report','All gross payments and CIS deductions',Icons.ArrowDownToLine],['Expense by category','Understand where business money is spent',Icons.PieChart],['Site profitability','Compare income and costs across sites',Icons.MapPin],['CIS summary','Deductions ready for Self Assessment',Icons.Landmark],['Missing receipts','Evidence still required for expenses',Icons.Receipt]]; return <><PageHead eyebrow="Business reporting" title="Reports centre" text="Clear, export-ready records for you, your accountant and HMRC."><button className="secondary"><Icons.Package size={17}/> Export all</button></PageHead><div className="report-feature"><div><span>2026–27 snapshot</span><h2>{money(totals.profit)} net profit</h2><p>{money(totals.gross)} income less {money(totals.spent)} allowable expenses</p></div><button onClick={()=>window.print()}><Icons.Printer size={17}/> Print summary</button></div><div className="reports-grid">{reports.map(([title,text,Icon],i)=><Card className="report-card" key={title}><span><Icon/></span><div><h3>{title}</h3><p>{text}</p></div><button onClick={()=>exportCsv(i===1?income:expenses,`${title.toLowerCase().replaceAll(' ','-')}.csv`)}><Icons.Download size={17}/></button></Card>)}</div></> }

function TaxCentre({ totals }) { const due=Math.max(0,totals.tax.total-totals.cis); const values=[['Turnover',totals.gross],['Allowable expenses',-totals.spent],['Taxable profit',totals.profit],['Estimated Income Tax',totals.tax.incomeTax],['Estimated Class 4 NI',totals.tax.ni],['CIS already deducted',-totals.cis]]; return <><PageHead eyebrow="Self Assessment" title="Tax centre" text="A live estimate based on the transactions recorded so far."><button className="secondary"><Icons.Download size={17}/> Export tax summary</button></PageHead><div className="tax-grid"><Card className="tax-hero"><span>Estimated amount still to pay</span><h2>{money(due)}</h2><p>After crediting {money(totals.cis)} of CIS deductions</p><div className="tax-progress"><i style={{width:`${Math.min(100,totals.cis/Math.max(1,totals.tax.total)*100)}%`}}/></div><small>{Math.round(totals.cis/Math.max(1,totals.tax.total)*100)}% covered by CIS deductions</small></Card><Card className="tax-saving"><span className="tint gold"><Icons.PiggyBank/></span><div><span>Suggested tax savings pot</span><h3>{money(due)}</h3><p>Set aside approximately {money(due/9)} per remaining month.</p></div></Card></div><Card className="calculation"><div className="card-head"><div><h3>Tax calculation</h3><p>Indicative estimate for the 2026–27 tax year</p></div><span className="status warning">Estimate</span></div>{values.map(([label,value],i)=><div className={i===2?'calc-row subtotal':'calc-row'} key={label}><span>{label}</span><b className={value<0?'green-text':''}>{value<0?'−':''}{money(Math.abs(value))}</b></div>)}<div className="calc-row total"><span>Estimated balance due</span><b>{money(due)}</b></div><p className="disclaimer"><Icons.Info size={15}/> This is a planning estimate, not tax advice. Rates and allowances should be confirmed before filing.</p></Card></> }

function YearEnd({ missingReceipts, income, expenses, setToast }) { const checks=[['Income records complete',income.length>0],['Expenses categorised',expenses.every(x=>x.category)],['Receipts attached',missingReceipts.length===0],['No duplicate transactions',true],['Bank reconciliation complete',false],['Required documents stored',true]]; const ready=checks.filter(x=>x[1]).length; return <><PageHead eyebrow="Close the books" title="Year-end wizard" text="Validate the records, prepare reports and lock the tax year."><span className="year-badge">2026–27</span></PageHead><div className="steps"><div className="current"><b>1</b><span>Validate records</span></div><i/><div><b>2</b><span>Generate reports</span></div><i/><div><b>3</b><span>Create pack</span></div><i/><div><b>4</b><span>Lock year</span></div></div><Card className="validation"><div className="validation-head"><div><h3>Bookkeeping validation</h3><p>{ready} of {checks.length} checks passed</p></div><div className="ring-small">{Math.round(ready/checks.length*100)}%</div></div>{checks.map(([label,pass])=><div className="check-row" key={label}>{pass?<Icons.CircleCheck className="pass"/>:<Icons.AlertCircle className="fail"/>}<span>{label}</span><b>{pass?'Passed':'Action needed'}</b><Icons.ChevronRight/></div>)}<div className="validation-footer"><p><Icons.Info size={16}/> Resolve the outstanding items before generating the final pack.</p><button className="primary" disabled={ready<checks.length} onClick={()=>setToast('Year-end pack generated')}>Continue to reports <Icons.ArrowRight size={16}/></button></div></Card></> }

function Documents() { return <><PageHead eyebrow="Secure records" title="Document library" text="Keep essential business, vehicle and HMRC documents in one place."><button className="primary"><Icons.Upload size={17}/> Upload document</button></PageHead><div className="folder-grid">{['Insurance','Vehicle documents','HMRC letters','CIS statements','Qualifications','Contracts'].map(x=><Card className="folder" key={x}><Icons.Folder fill="currentColor"/><div><strong>{x}</strong><span>0 documents</span></div></Card>)}</div><Card className="table-card"><div className="card-head padded"><div><h3>Recent documents</h3><p>Files added most recently</p></div></div><div className="empty-table"><Icons.FilePlus2/><strong>No documents yet</strong><span>Upload your first document to get started.</span></div></Card></> }

function SettingsPage() { return <><PageHead eyebrow="Administration" title="Settings" text="Manage business details, categories, users and preferences."/><div className="settings-layout"><Card className="settings-nav">{[['Business details',Icons.Building2],['Tax year',Icons.Calendar],['Users & permissions',Icons.Users],['Categories',Icons.Tags],['Notifications',Icons.Bell],['Backup & data',Icons.Database]].map(([x,I],i)=><button className={i===0?'active':''} key={x}><I size={17}/>{x}<Icons.ChevronRight size={15}/></button>)}</Card><Card className="form-card"><div className="card-head"><div><h3>Business details</h3><p>Information used across reports and exports.</p></div></div><div className="form-grid"><label>Trading name<input placeholder="Enter trading name"/></label><label>Business type<input defaultValue="Sole trader"/></label><label>Unique Taxpayer Reference<input placeholder="Enter UTR"/></label><label>National Insurance number<input placeholder="Enter NI number"/></label><label className="wide">Business address<textarea placeholder="Enter business address"/></label></div><div className="form-footer"><button className="primary">Save changes</button></div></Card></div></> }

function RecordModal({ type, sites, onClose, onSave }) {
  const isIncome=type==='income', isExpense=type==='expense', isSite=type==='site'
  const [form,setForm]=useState(isIncome?{date:new Date().toISOString().slice(0,10),site:sites[0]?.name||'',gross:'',cisRate:20,method:'Bank transfer',notes:'',attachment:false}:isExpense?{date:new Date().toISOString().slice(0,10),site:sites[0]?.name||'',supplier:'',description:'',category:categories[0],amount:'',vat:0,business:100,method:'Business card',receipt:false}:{name:'',address:'',start:new Date().toISOString().slice(0,10),status:'Active'})
  const update=(k,v)=>setForm(f=>({...f,[k]:v}))
  const submit=e=>{e.preventDefault(); if(isIncome) onSave('income',{...form,gross:Number(form.gross),cisRate:Number(form.cisRate)}); else if(isExpense) onSave('expense',{...form,amount:Number(form.amount),vat:Number(form.vat),business:Number(form.business)}); else onSave('site',form)}
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">New record</span><h2>{isIncome?'Add income':isExpense?'Add expense':'Add site'}</h2></div><button type="button" onClick={onClose}><Icons.X/></button></div><div className="modal-body">
    {isSite?<><label>Site name<input required value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Enter site name"/></label><label>Address<input required value={form.address} onChange={e=>update('address',e.target.value)}/></label><div className="two"><label>Start date<input type="date" value={form.start} onChange={e=>update('start',e.target.value)}/></label><label>Status<select value={form.status} onChange={e=>update('status',e.target.value)}><option>Active</option><option>Planned</option><option>Complete</option></select></label></div></>:
    <><div className="two"><label>Date<input type="date" required value={form.date} onChange={e=>update('date',e.target.value)}/></label><label>Site<select value={form.site} onChange={e=>update('site',e.target.value)}>{sites.map(s=><option key={s.id}>{s.name}</option>)}</select></label></div>{isIncome?<><div className="two"><label>Gross payment (£)<input type="number" min="0" step=".01" required value={form.gross} onChange={e=>update('gross',e.target.value)}/></label><label>CIS deduction<select value={form.cisRate} onChange={e=>update('cisRate',e.target.value)}><option value="0">0%</option><option value="20">20%</option><option value="30">30%</option></select></label></div>{form.gross&&<div className="calculation-strip"><span>CIS deduction <b>{money(form.gross*form.cisRate/100)}</b></span><span>Net received <b>{money(form.gross*(1-form.cisRate/100))}</b></span></div>}<label>Notes<textarea value={form.notes} onChange={e=>update('notes',e.target.value)}/></label><label className="check"><input type="checkbox" checked={form.attachment} onChange={e=>update('attachment',e.target.checked)}/> CIS statement attached</label></>:<><div className="two"><label>Supplier<input required value={form.supplier} onChange={e=>update('supplier',e.target.value)}/></label><label>Category<select value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div><label>Description<input required value={form.description} onChange={e=>update('description',e.target.value)}/></label><div className="three"><label>Amount (£)<input type="number" min="0" step=".01" required value={form.amount} onChange={e=>update('amount',e.target.value)}/></label><label>VAT (£)<input type="number" min="0" step=".01" value={form.vat} onChange={e=>update('vat',e.target.value)}/></label><label>Business %<input type="number" min="0" max="100" value={form.business} onChange={e=>update('business',e.target.value)}/></label></div><label className="check"><input type="checkbox" checked={form.receipt} onChange={e=>update('receipt',e.target.checked)}/> Receipt attached</label></>}</>}
  </div><div className="modal-footer"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary">Save {type}</button></div></form></div>
}
