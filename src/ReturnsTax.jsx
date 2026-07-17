import { useState } from 'react'
import * as Icons from 'lucide-react'
import { money, sum, taxEstimate } from './utils'

const periods = [
  ['Q1','6 Apr – 5 Jul','2026-04-06','2026-07-05','7 Aug 2026','6 Apr – 5 Jul'],
  ['Q2','6 Jul – 5 Oct','2026-07-06','2026-10-05','7 Nov 2026','6 Apr – 5 Oct'],
  ['Q3','6 Oct – 5 Jan','2026-10-06','2027-01-05','7 Feb 2027','6 Apr – 5 Jan'],
  ['Q4','6 Jan – 5 Apr','2027-01-06','2027-04-05','7 May 2027','6 Apr – 5 Apr']
]

const stored = () => {
  try { return JSON.parse(localStorage.getItem('cis-quarterly-submitted')) || [] }
  catch { return [] }
}

export default function ReturnsTax({ totals, income, expenses, setToast }) {
  const [mode,setMode] = useState('quarterly')
  const [selected,setSelected] = useState(0)
  const [submitted,setSubmitted] = useState(stored)
  const today = new Date().toISOString().slice(0,10)
  const quarters = periods.map((p,index) => {
    const inc=income.filter(x=>x.date>=p[2]&&x.date<=p[3])
    const exp=expenses.filter(x=>x.date>=p[2]&&x.date<=p[3])
    const gross=sum(inc,x=>x.gross)
    const costs=sum(exp,x=>x.amount*x.business/100)
    const status=submitted.includes(index)?'Submitted':today>p[3]?'Ready':today>=p[2]?'In progress':'Upcoming'
    return {name:p[0],label:p[1],start:p[2],end:p[3],deadline:p[4],cumulative:p[5],gross,costs,
      profit:gross-costs,cis:sum(inc,x=>x.gross*x.cisRate/100),missing:exp.filter(x=>!x.receipt).length,status}
  })
  const active=quarters[selected]
  const cumulativeIncome=sum(income.filter(x=>x.date>='2026-04-06'&&x.date<=active.end),x=>x.gross)
  const cumulativeCosts=sum(expenses.filter(x=>x.date>='2026-04-06'&&x.date<=active.end),x=>x.amount*x.business/100)
  const due=Math.max(0,taxEstimate(totals.profit).total-totals.cis)
  const submit=()=>{const next=[...new Set([...submitted,selected])];setSubmitted(next);localStorage.setItem('cis-quarterly-submitted',JSON.stringify(next));setToast(active.name+' marked as submitted')}

  return <div>
    <div className="page-head"><div><span className="eyebrow">Making Tax Digital</span><h1>Returns & tax</h1><p>Review quarterly updates and your full annual position.</p></div></div>
    <div className="return-switch"><button className={mode==='quarterly'?'active':''} onClick={()=>setMode('quarterly')}><Icons.CalendarRange size={16}/>Quarterly updates</button><button className={mode==='annual'?'active':''} onClick={()=>setMode('annual')}><Icons.CalendarDays size={16}/>Annual view</button></div>
    {mode==='quarterly'?<>
      <div className="quarter-grid">{quarters.map((q,i)=><button key={q.name} className={'quarter-card '+(selected===i?'selected':'')} onClick={()=>setSelected(i)}><div><b>{q.name}</b><span>{q.status}</span></div><strong>{q.label}</strong><small>Due {q.deadline}</small><dl><div><dt>Income</dt><dd>{money(q.gross)}</dd></div><div><dt>Expenses</dt><dd>{money(q.costs)}</dd></div></dl></button>)}</div>
      <section className="card quarter-detail">
        <div className="quarter-detail-head"><div><span className="eyebrow">{active.name} · 2026–27</span><h3>Quarterly update review</h3><p>Quarter activity for {active.label}. HMRC receives cumulative totals for {active.cumulative}.</p></div><span className={'status '+(active.status==='Submitted'?'complete':'warning')}>{active.status}</span></div>
        <div className="quarter-summary"><div><span>Income</span><b>{money(active.gross)}</b></div><div><span>Expenses</span><b>{money(active.costs)}</b></div><div><span>Profit</span><b>{money(active.profit)}</b></div><div><span>CIS deducted</span><b>{money(active.cis)}</b></div></div>
        <div className="cumulative-box"><div><Icons.Layers3/><span><strong>HMRC cumulative totals</strong><small>{active.cumulative}</small></span></div><div><span>Income <b>{money(cumulativeIncome)}</b></span><span>Expenses <b>{money(cumulativeCosts)}</b></span></div></div>
        <div className="return-checks"><div><span>{active.missing?<Icons.AlertCircle/>:<Icons.CircleCheck/>}Receipts complete</span><b>{active.missing?active.missing+' missing':'Ready'}</b></div><div><span><Icons.CircleCheck/>Expenses categorised</span><b>Ready</b></div><div><span><Icons.Info/>HMRC connection</span><b>Manual submission</b></div></div>
        <div className="quarter-actions"><p><Icons.Info/>Quarterly updates are summaries, not separate tax returns.</p><button className="primary" disabled={active.status==='Submitted'} onClick={submit}>{active.status==='Submitted'?'Submitted':'Mark as submitted'}</button></div>
      </section>
    </>:<>
      <div className="tax-grid"><section className="card tax-hero"><span>Estimated annual balance</span><h2>{money(due)}</h2><p>After crediting {money(totals.cis)} of CIS deductions</p></section><section className="card tax-saving"><span className="tint gold"><Icons.PiggyBank/></span><div><span>Annual net profit</span><h3>{money(totals.profit)}</h3><p>6 April 2026 to 5 April 2027</p></div></section></div>
      <section className="card annual-quarters"><div className="card-head padded"><div><h3>Annual quarter comparison</h3><p>Full 2026–27 tax year</p></div><span className="year-badge">2026–27</span></div>
        <table><thead><tr><th>Quarter</th><th className="number">Income</th><th className="number">Expenses</th><th className="number">Profit</th><th className="number">CIS</th><th>Status</th></tr></thead><tbody>{quarters.map(q=><tr key={q.name}><td><strong>{q.name}</strong><small>{q.label}</small></td><td className="number">{money(q.gross)}</td><td className="number">{money(q.costs)}</td><td className="number"><strong>{money(q.profit)}</strong></td><td className="number">{money(q.cis)}</td><td><span className={'status '+(q.status==='Submitted'?'complete':'neutral')}>{q.status}</span></td></tr>)}</tbody><tfoot><tr><td>Annual total</td><td className="number">{money(totals.gross)}</td><td className="number">{money(totals.spent)}</td><td className="number">{money(totals.profit)}</td><td className="number">{money(totals.cis)}</td><td/></tr></tfoot></table>
      </section>
    </>}
  </div>
}
