import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(__dirname, "../audits.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_address TEXT NOT NULL,
    contract_name TEXT NOT NULL,
    contract_hash TEXT NOT NULL,
    score INTEGER NOT NULL,
    report_json TEXT NOT NULL,
    report_hash TEXT,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface AuditRow {
  id: number;
  caller_address: string;
  contract_name: string;
  contract_hash: string;
  score: number;
  report_json: string;
  report_hash: string | null;
  tx_hash: string | null;
  created_at: string;
}

export function insertAudit(data: {
  callerAddress: string;
  contractName: string;
  contractHash: string;
  score: number;
  reportJson: string;
  reportHash: string | null;
  txHash: string | null;
}): number {
  const stmt = db.prepare(`
    INSERT INTO audits 
    (caller_address, contract_name, contract_hash, score, report_json, report_hash, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.callerAddress,
    data.contractName,
    data.contractHash,
    data.score,
    data.reportJson,
    data.reportHash,
    data.txHash
  );

  return result.lastInsertRowid as number;
}

export function getAuditById(id: number): AuditRow | null {
  const stmt = db.prepare("SELECT * FROM audits WHERE id = ?");
  return (stmt.get(id) as AuditRow) || null;
}

export function getAuditCount(): number {
  const stmt = db.prepare("SELECT COUNT(*) as count FROM audits");
  const row = stmt.get() as { count: number };
  return row.count;
}
