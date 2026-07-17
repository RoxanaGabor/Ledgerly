import http from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dataDir = join(root, '.data')
mkdirSync(dataDir, { recursive: true })
const uploadsDir = join(dataDir, 'invoices')
mkdirSync(uploadsDir, { recursive: true })
const db = new DatabaseSync(join(dataDir, 'ledgerly.sqlite'))
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
    start TEXT NOT NULL, end TEXT, status TEXT NOT NULL DEFAULT 'Active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS income (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, site TEXT NOT NULL DEFAULT '', gross REAL NOT NULL,
    cis_rate REAL NOT NULL DEFAULT 20, method TEXT NOT NULL DEFAULT 'Bank transfer',
    notes TEXT NOT NULL DEFAULT '', attachment INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, site TEXT NOT NULL DEFAULT '', supplier TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, amount REAL NOT NULL,
    vat REAL NOT NULL DEFAULT 0, business REAL NOT NULL DEFAULT 100,
    method TEXT NOT NULL DEFAULT 'Business card', receipt INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS quarterly_updates (
    quarter INTEGER PRIMARY KEY CHECK (quarter BETWEEN 0 AND 3), submitted INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS weekly_reviews (
    week_key TEXT PRIMARY KEY, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, invoice_date TEXT NOT NULL,
    sent_date TEXT, due_date TEXT, paid_date TEXT, site TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '', gross REAL NOT NULL, cis_rate REAL NOT NULL DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'Sent', notes TEXT NOT NULL DEFAULT '', file_name TEXT,
    stored_name TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

const queries = {
  income: db.prepare(`SELECT id,date,site,gross,cis_rate AS cisRate,method,notes,attachment FROM income ORDER BY date DESC, created_at DESC`),
  expenses: db.prepare(`SELECT id,date,site,supplier,description,category,amount,vat,business,method,receipt FROM expenses ORDER BY date DESC, created_at DESC`),
  sites: db.prepare(`SELECT id,name,address,start,end,status FROM sites ORDER BY start DESC, created_at DESC`),
  invoices: db.prepare(`SELECT id,invoice_number AS invoiceNumber,invoice_date AS invoiceDate,sent_date AS sentDate,due_date AS dueDate,paid_date AS paidDate,site,description,gross,cis_rate AS cisRate,status,notes,file_name AS fileName FROM invoices ORDER BY invoice_date DESC, created_at DESC`)
}
const inserts = {
  income: db.prepare(`INSERT INTO income (id,date,site,gross,cis_rate,method,notes,attachment) VALUES (?,?,?,?,?,?,?,?)`),
  expense: db.prepare(`INSERT INTO expenses (id,date,site,supplier,description,category,amount,vat,business,method,receipt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
  site: db.prepare(`INSERT INTO sites (id,name,address,start,end,status) VALUES (?,?,?,?,?,?)`),
  invoice: db.prepare(`INSERT INTO invoices (id,invoice_number,invoice_date,sent_date,due_date,paid_date,site,description,gross,cis_rate,status,notes,file_name,stored_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function body(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString() || '{}')
}

function add(type, value) {
  if (type === 'income') inserts.income.run(value.id,value.date,value.site,value.gross,value.cisRate,value.method,value.notes,value.attachment?1:0)
  if (type === 'expense') inserts.expense.run(value.id,value.date,value.site,value.supplier,value.description,value.category,value.amount,value.vat,value.business,value.method,value.receipt?1:0)
  if (type === 'site') inserts.site.run(value.id,value.name,value.address,value.start,value.end||null,value.status)
  if (type === 'invoice') {
    let storedName = null
    if (value.fileData && value.fileName) {
      const extension = extname(value.fileName).toLowerCase().replace(/[^.a-z0-9]/g,'')
      storedName = value.id + extension
      writeFileSync(join(uploadsDir,storedName),Buffer.from(value.fileData.split(',').pop(),'base64'))
    }
    inserts.invoice.run(value.id,value.invoiceNumber,value.invoiceDate,value.sentDate||null,value.dueDate||null,value.paidDate||null,value.site,value.description,value.gross,value.cisRate,value.status,value.notes,value.fileName||null,storedName)
  }
}

const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.pdf':'application/pdf' }
function staticFile(req, res) {
  const dist = join(root, 'dist')
  let path = join(dist, req.url === '/' ? 'index.html' : req.url.split('?')[0])
  if (!existsSync(path) || !extname(path)) path = join(dist, 'index.html')
  if (!existsSync(path)) return json(res, 404, { error:'Run npm run build first.' })
  res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' })
  res.end(readFileSync(path))
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/bootstrap') {
      return json(res, 200, { income:queries.income.all(), expenses:queries.expenses.all(), sites:queries.sites.all(), invoices:queries.invoices.all(), weeklyReviews:db.prepare('SELECT week_key AS weekKey, completed_at AS completedAt FROM weekly_reviews ORDER BY completed_at DESC').all() })
    }
    if (req.method === 'POST' && req.url === '/api/migrate') {
      const records = await body(req)
      let imported = 0
      for (const [type, items] of Object.entries(records)) {
        const singular = type === 'expenses' ? 'expense' : type === 'sites' ? 'site' : type
        for (const item of Array.isArray(items) ? items : []) {
          try { add(singular, item); imported += 1 } catch (error) {
            if (!String(error.message).includes('UNIQUE constraint')) throw error
          }
        }
      }
      return json(res, 200, { imported })
    }
    if (req.method === 'POST' && req.url === '/api/weekly-review') {
      const value = await body(req)
      db.prepare('INSERT OR REPLACE INTO weekly_reviews (week_key,completed_at) VALUES (?,CURRENT_TIMESTAMP)').run(value.weekKey)
      return json(res, 201, { weekKey:value.weekKey, completedAt:new Date().toISOString() })
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/invoice-file/')) {
      const id = req.url.split('/').pop()
      const file = db.prepare('SELECT file_name AS fileName,stored_name AS storedName FROM invoices WHERE id=?').get(id)
      if (!file?.storedName) return json(res,404,{error:'File not found'})
      const path = join(uploadsDir,file.storedName)
      res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Disposition':`inline; filename="${file.fileName.replaceAll('"','')}"`})
      return res.end(readFileSync(path))
    }
    if (req.method === 'POST' && req.url?.startsWith('/api/')) {
      const type = req.url.slice(5)
      if (!['income','expense','site','invoice'].includes(type)) return json(res,404,{error:'Unknown resource'})
      const value = await body(req)
      add(type,value)
      return json(res,201,value)
    }
    if (req.method === 'GET' && req.url === '/api/health') return json(res,200,{ok:true,database:'sqlite'})
    return staticFile(req,res)
  } catch (error) {
    console.error(error)
    return json(res, 500, { error:'Unable to save the record.' })
  }
})

const port = Number(process.env.PORT || 3001)
server.listen(port, '127.0.0.1', () => console.log(`Ledgerly database server: http://127.0.0.1:${port}`))
