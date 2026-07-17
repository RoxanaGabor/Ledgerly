import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { money } from './utils'

const today = () => new Date().toISOString().slice(0,10)
const addDays = (date, days) => { const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10) }
const displayStatus = invoice => invoice.status !== 'Paid' && invoice.dueDate && invoice.dueDate < today() ? 'Overdue' : invoice.status

export default function Invoices({ invoices, sites, onSave }) {
  const [open,setOpen] = useState(false)
  const [filter,setFilter] = useState('All')
  const visible = filter==='All' ? invoices : invoices.filter(x=>displayStatus(x)===filter)
  const totals = useMemo(()=>({
    invoiced:invoices.reduce((n,x)=>n+Number(x.gross),0),
    outstanding:invoices.filter(x=>displayStatus(x)!=='Paid').reduce((n,x)=>n+Number(x.gross)*(1-Number(x.cisRate)/100),0),
    paid:invoices.filter(x=>displayStatus(x)==='Paid').reduce((n,x)=>n+Number(x.gross)*(1-Number(x.cisRate)/100),0)
  }),[invoices])
  return <>
    <div className="page-head"><div><span className="eyebrow">Money requested</span><h1>Invoices sent</h1><p>Store invoices issued to the company and track when you get paid.</p></div><div className="page-actions"><button className="primary" onClick={()=>setOpen(true)}><Icons.Upload size={17}/> Upload invoice</button></div></div>
    <div className="mini-stats"><section className="card"><span>Total invoiced</span><b>{money(totals.invoiced)}</b></section><section className="card"><span>Outstanding net payment</span><b>{money(totals.outstanding)}</b></section><section className="card"><span>Paid to date</span><b>{money(totals.paid)}</b></section></div>
    <div className="invoice-toolbar"><div>{['All','Sent','Paid','Overdue'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x}</button>)}</div><span>{visible.length} invoice{visible.length===1?'':'s'}</span></div>
    <section className="card table-card invoice-table"><table><thead><tr><th>Invoice</th><th>Invoice date</th><th>Site</th><th className="number">Gross</th><th className="number">CIS deduction</th><th className="number">Expected net</th><th>Due</th><th>Status</th><th>File</th></tr></thead><tbody>{visible.map(x=>{const status=displayStatus(x);return <tr key={x.id}><td><strong>{x.invoiceNumber}</strong><small>{x.description}</small></td><td>{x.invoiceDate}</td><td>{x.site||'—'}</td><td className="number">{money(x.gross)}</td><td className="number red-text">−{money(x.gross*x.cisRate/100)}</td><td className="number"><strong>{money(x.gross*(1-x.cisRate/100))}</strong></td><td>{x.dueDate||'—'}</td><td><span className={'status '+(status==='Paid'?'complete':status==='Overdue'?'danger':'warning')}>{status}</span></td><td>{x.fileName?<a className="file-link" href={'/api/invoice-file/'+x.id} target="_blank" rel="noreferrer"><Icons.Paperclip size={14}/>{x.fileName}</a>:'—'}</td></tr>})}</tbody></table>{!visible.length&&<div className="empty-table"><Icons.FileUp/><strong>No invoices here yet</strong><span>Upload the first invoice you sent to the company.</span></div>}</section>
    {open&&<InvoiceModal sites={sites} onClose={()=>setOpen(false)} onSave={async value=>{if(await onSave(value))setOpen(false)}}/>}
  </>
}

function InvoiceModal({ sites,onClose,onSave }) {
  const date=today()
  const [form,setForm]=useState({invoiceNumber:'',invoiceDate:date,sentDate:date,dueDate:addDays(date,14),paidDate:'',site:sites[0]?.name||'',description:'',gross:'',cisRate:20,status:'Sent',notes:'',fileName:'',fileData:''})
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const update=(key,value)=>setForm(x=>({...x,[key]:value}))
  const file=event=>{const selected=event.target.files[0];if(!selected)return;if(selected.size>10*1024*1024){setError('The invoice file must be smaller than 10 MB.');return}const reader=new FileReader();reader.onload=()=>setForm(x=>({...x,fileName:selected.name,fileData:reader.result}));reader.readAsDataURL(selected)}
  const submit=async event=>{event.preventDefault();setError('');setBusy(true);const ok=await onSave({...form,gross:Number(form.gross),cisRate:Number(form.cisRate)});if(!ok)setError('The invoice could not be saved. Check that the invoice number is unique.');setBusy(false)}
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal invoice-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Invoice issued</span><h2>Upload sent invoice</h2></div><button type="button" onClick={onClose}><Icons.X/></button></div><div className="modal-body">
    <div className="two"><label>Invoice number<input required value={form.invoiceNumber} onChange={e=>update('invoiceNumber',e.target.value)} placeholder="e.g. INV-2026-001"/></label><label>Site<select value={form.site} onChange={e=>update('site',e.target.value)}><option value="">No site</option>{sites.map(s=><option key={s.id}>{s.name}</option>)}</select></label></div>
    <label>Work description<input required value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Work covered by this invoice"/></label>
    <div className="three"><label>Invoice date<input type="date" required value={form.invoiceDate} onChange={e=>update('invoiceDate',e.target.value)}/></label><label>Sent date<input type="date" value={form.sentDate} onChange={e=>update('sentDate',e.target.value)}/></label><label>Payment due<input type="date" value={form.dueDate} onChange={e=>update('dueDate',e.target.value)}/></label></div>
    <div className="three"><label>Gross amount (£)<input type="number" min="0" step=".01" required value={form.gross} onChange={e=>update('gross',e.target.value)}/></label><label>CIS rate<select value={form.cisRate} onChange={e=>update('cisRate',e.target.value)}><option value="0">0%</option><option value="20">20%</option><option value="30">30%</option></select></label><label>Status<select value={form.status} onChange={e=>update('status',e.target.value)}><option>Sent</option><option>Paid</option><option>Draft</option></select></label></div>
    {form.gross&&<div className="calculation-strip"><span>CIS deduction <b>{money(form.gross*form.cisRate/100)}</b></span><span>Expected payment <b>{money(form.gross*(1-form.cisRate/100))}</b></span></div>}
    <label className="invoice-upload"><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={file}/><Icons.CloudUpload/><span><strong>{form.fileName||'Choose invoice file'}</strong><small>PDF, JPG or PNG · maximum 10 MB</small></span></label>
    <label>Notes<textarea value={form.notes} onChange={e=>update('notes',e.target.value)}/></label>{error&&<div className="auth-error"><Icons.AlertCircle size={16}/>{error}</div>}
  </div><div className="modal-footer"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save invoice'}</button></div></form></div>
}
