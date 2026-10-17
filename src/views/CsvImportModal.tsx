import React, { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Shield, ArrowRight } from "lucide-react";
import type { Transaction, RiskRule } from "../types";
import { parseAndIngestCsv, type IngestionResult } from "../services/ingestionService";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions: Transaction[];
  activeRules: RiskRule[];
  onImportSuccess: (newTxns: Transaction[]) => void;
  toast: (msg: string) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingTransactions,
  activeRules,
  onImportSuccess,
  toast,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast("Please select a valid CSV file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast("File size exceeds 5MB limit");
      return;
    }
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const lines = text.split("\n").filter((l) => l.trim()).slice(0, 6);
        const rows = lines.map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
        setCsvPreview(rows);
      }
    };
    reader.readAsText(f);
  };

  const handleExecuteImport = async () => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (content) {
        try {
          const res = await parseAndIngestCsv(content, existingTransactions, activeRules);
          setResult(res);
          if (res.accepted > 0) {
            onImportSuccess(res.newTransactions);
            toast(`Successfully ingested ${res.accepted} transactions`);
          } else {
            toast(`No valid records ingested. ${res.rejected} rejected.`);
          }
        } catch (err) {
          toast(`Ingestion failed: ${(err as Error).message}`);
        } finally {
          setLoading(false);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: "min(680px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div className="eyebrow" style={{ color: "#22d3ee" }}>DATA INGESTION PIPELINE</div>
            <h2 style={{ margin: "4px 0" }}>Import Transactions CSV</h2>
            <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
              Secure server-side validation, duplicate detection, and automated ML risk scoring.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Drag and Drop Zone */}
        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            style={{
              border: `2px dashed ${isDragging ? "#22d3ee" : "#334259"}`,
              borderRadius: "10px",
              padding: "36px 20px",
              textAlign: "center",
              background: isDragging ? "#14283b" : "#111a2a",
              cursor: "pointer",
              marginBottom: "16px",
              transition: "all 0.2s ease",
            }}
            onClick={() => document.getElementById("csv-file-input")?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div style={{ display: "grid", placeItems: "center", marginBottom: "12px", color: "#22d3ee" }}>
              <Upload size={36} />
            </div>
            <strong style={{ display: "block", fontSize: "14px", color: "#f1f5f9", marginBottom: "6px" }}>
              Click to select or drag and drop transaction CSV
            </strong>
            <span style={{ fontSize: "11px", color: "#718198" }}>
              Expected columns: <code>amount</code>, <code>channel</code>, <code>customer</code> (optional: <code>id</code>, <code>timestamp</code>)
            </span>
          </div>
        )}

        {/* Selected File & Preview */}
        {file && !result && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#162337", borderRadius: "8px", border: "1px solid #283a52", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FileText size={20} color="#22d3ee" />
                <div>
                  <strong style={{ fontSize: "12px", display: "block" }}>{file.name}</strong>
                  <small style={{ color: "#8292a8" }}>{(file.size / 1024).toFixed(1)} KB</small>
                </div>
              </div>
              <button className="icon-btn" onClick={() => { setFile(null); setCsvPreview([]); }} title="Change file">
                <X size={15} />
              </button>
            </div>

            {csvPreview.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#8292a8", marginBottom: "8px", textTransform: "uppercase" }}>
                  CSV Structure Preview (Top 5 Rows)
                </div>
                <div className="table-wrap" style={{ maxHeight: "180px", border: "1px solid #26344a", borderRadius: "6px" }}>
                  <table>
                    <thead>
                      <tr>
                        {csvPreview[0].map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(1).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ingestion Completion Report */}
        {result && (
          <div style={{ padding: "16px", background: "#102334", borderRadius: "8px", border: "1px solid #1f5068", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "#34d399" }}>
              <CheckCircle2 size={18} />
              <strong style={{ fontSize: "13px" }}>Ingestion Job Completed</strong>
            </div>

            <div className="kpi-grid four" style={{ marginBottom: "12px" }}>
              <div style={{ padding: "8px", background: "#0e1a2b", borderRadius: "6px" }}>
                <small style={{ color: "#718198", display: "block", fontSize: "9px" }}>TOTAL ROWS</small>
                <strong style={{ fontSize: "16px", color: "#f1f5f9" }}>{result.total}</strong>
              </div>
              <div style={{ padding: "8px", background: "#0e1a2b", borderRadius: "6px" }}>
                <small style={{ color: "#34d399", display: "block", fontSize: "9px" }}>ACCEPTED</small>
                <strong style={{ fontSize: "16px", color: "#34d399" }}>{result.accepted}</strong>
              </div>
              <div style={{ padding: "8px", background: "#0e1a2b", borderRadius: "6px" }}>
                <small style={{ color: "#fb7185", display: "block", fontSize: "9px" }}>REJECTED</small>
                <strong style={{ fontSize: "16px", color: "#fb7185" }}>{result.rejected}</strong>
              </div>
              <div style={{ padding: "8px", background: "#0e1a2b", borderRadius: "6px" }}>
                <small style={{ color: "#fbbf24", display: "block", fontSize: "9px" }}>DUPLICATES</small>
                <strong style={{ fontSize: "16px", color: "#fbbf24" }}>{result.duplicates}</strong>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={{ maxHeight: "120px", overflowY: "auto", background: "#181e2b", padding: "10px", borderRadius: "6px", fontSize: "10px", color: "#fb7185" }}>
                <strong>Validation Errors:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: "16px" }}>
                  {result.errors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {result.errors.length > 10 && <li>...and {result.errors.length - 10} more errors</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Security & Validation Notice */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", color: "#718198", marginBottom: "16px" }}>
          <Shield size={14} color="#22d3ee" />
          <span>Rows are verified through Zod schema validation & evaluated against active fraud policies.</span>
        </div>

        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>
            {result ? "Close" : "Cancel"}
          </button>
          {file && !result && (
            <button className="btn primary" onClick={handleExecuteImport} disabled={loading}>
              {loading ? "Validating & Scoring..." : "Confirm & Import Records"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
