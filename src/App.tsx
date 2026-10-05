import { useMemo, useState } from 'react'
import {
  capabilityAreas, capabilityStatus, entityTrend, findings, metricsByCse, peerRange, reviewQueue,
  syntheticValidation, type Finding, type Priority,
} from './analytics'
import {
  acceptedRecordCount, alertById, assetById, assets, caseById, entities,
  escalationByCase, investigationByCase, period, quarantinedRecordCount, quarantinedRecords, sourceCounts, submissions,
} from './data'

 type View = 'overview' | 'submission' | 'quality' | 'normalization' | 'findings' | 'review' | 'entities' | 'peers' | 'trends' | 'evidence' | 'audit' | 'validation'
const number = new Intl.NumberFormat('en-IN')
const pct = (value: number) => `${Math.round(value * 100)}%`
const fmt = (value: number) => number.format(value)
const views: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'submission', label: 'Submission' }, { key: 'quality', label: 'Data quality' },
  { key: 'normalization', label: 'Normalization' }, { key: 'findings', label: 'Findings' }, { key: 'review', label: 'Review queue' },
  { key: 'entities', label: 'Entities' }, { key: 'peers', label: 'Peer analysis' }, { key: 'trends', label: 'Trends' },
  { key: 'evidence', label: 'Evidence' }, { key: 'audit', label: 'Audit trail' }, { key: 'validation', label: 'Analytical validation' },
]
const findingTone: Record<Priority, string> = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }

function App() {
  const [view, setView] = useState<View>('overview')
  const [findingId, setFindingId] = useState(reviewQueue[0]?.findingId ?? findings[0]?.id ?? '')
  const [sampleId, setSampleId] = useState(reviewQueue[0]?.id ?? '')
  const [entityId, setEntityId] = useState('CSE-07')
  const [peerEntityId, setPeerEntityId] = useState('CSE-03')
  const [contextOpen, setContextOpen] = useState(false)
  const [findingSearch, setFindingSearch] = useState('')
  const [findingCapability, setFindingCapability] = useState('All capabilities')
  const [findingFamily, setFindingFamily] = useState('All signal families')
  const [findingPriority, setFindingPriority] = useState('All priorities')
  const [queueSearch, setQueueSearch] = useState('')
  const [queueCse, setQueueCse] = useState('All CSEs')
  const [queueCapability, setQueueCapability] = useState('All capabilities')
  const [queueFamily, setQueueFamily] = useState('All signal types')
  const [queuePriority, setQueuePriority] = useState('All priorities')
  const [queueRecordType, setQueueRecordType] = useState('All record types')
  const [queueReviewStatus, setQueueReviewStatus] = useState('All review statuses')
  const [reviewStates, setReviewStates] = useState<Record<string, string>>({})
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState('')

  const selectedFinding = findings.find((finding) => finding.id === findingId) ?? findings[0]
  const selectedSample = reviewQueue.find((sample) => sample.id === sampleId) ?? (view === 'evidence' ? reviewQueue[0] : undefined)
  const selectedAlert = selectedSample ? alertById.get(selectedSample.alertId) : undefined
  const selectedCase = selectedSample ? caseById.get(selectedSample.caseId) : undefined
  const selectedInvestigation = selectedCase ? investigationByCase.get(selectedCase.case_id) : undefined
  const selectedEscalation = selectedCase ? escalationByCase.get(selectedCase.case_id) : undefined
  const selectedAsset = selectedAlert ? assetById.get(selectedAlert.asset_id) : undefined
  const highCount = findings.filter((finding) => finding.priority === 'HIGH').length
  const mediumCount = findings.filter((finding) => finding.priority === 'MEDIUM').length
  const lowCount = findings.filter((finding) => finding.priority === 'LOW').length
  const entitiesRequiringAttention = new Set(findings.map((finding) => finding.cseId)).size
  const title = views.find((item) => item.key === view)?.label ?? 'Assessment'
  const signalFamilies = [...new Set(findings.map((finding) => finding.type))]
  const filteredFindings = useMemo(() => findings.filter((finding) => {
    const search = findingSearch.trim().toLowerCase()
    return (!search || `${finding.id} ${finding.cseId} ${finding.title} ${finding.type} ${finding.sourceRecordIds.join(' ')}`.toLowerCase().includes(search))
      && (findingCapability === 'All capabilities' || finding.capability === findingCapability)
      && (findingFamily === 'All signal families' || finding.type === findingFamily)
      && (findingPriority === 'All priorities' || finding.priority === findingPriority)
  }), [findingSearch, findingCapability, findingFamily, findingPriority])
  const filteredQueue = useMemo(() => reviewQueue.filter((sample) => {
    const finding = findings.find((item) => item.id === sample.findingId)
    const search = queueSearch.trim().toLowerCase()
    return (!search || `${sample.id} ${sample.cseId} ${sample.recordId} ${sample.caseId} ${sample.alertId}`.toLowerCase().includes(search))
      && (queueCse === 'All CSEs' || sample.cseId === queueCse)
      && (!finding || queueCapability === 'All capabilities' || finding.capability === queueCapability)
      && (!finding || queueFamily === 'All signal types' || finding.type === queueFamily)
      && (!finding || queuePriority === 'All priorities' || finding.priority === queuePriority)
      && (queueRecordType === 'All record types' || sample.type === queueRecordType)
      && (queueReviewStatus === 'All review statuses' || (reviewStates[sample.id] ?? 'Pending human review') === queueReviewStatus)
  }), [queueSearch, queueCse, queueCapability, queueFamily, queuePriority, queueRecordType, queueReviewStatus, reviewStates])

  const openFinding = (finding: Finding) => {
    setFindingId(finding.id)
    const sample = reviewQueue.find((item) => item.findingId === finding.id)
    setSampleId(sample?.id ?? '')
    setNoteDraft(sample ? reviewNotes[sample.id] ?? '' : '')
    setContextOpen(true)
  }
  const openSample = (id: string) => {
    const sample = reviewQueue.find((item) => item.id === id)
    if (!sample) return
    setSampleId(id)
    setFindingId(sample.findingId)
    setNoteDraft(reviewNotes[id] ?? '')
    setContextOpen(true)
  }
  const setReviewState = (status: string) => selectedSample && setReviewStates((current) => ({ ...current, [selectedSample.id]: status }))
  const saveNote = () => selectedSample && setReviewNotes((current) => ({ ...current, [selectedSample.id]: noteDraft }))

  const findingTable = (compact = false) => <div className="table-wrap"><table className="data-table"><thead><tr><th>Priority</th><th>Finding ID</th><th>CSE</th><th>Capability</th><th>Signal type</th><th>Finding</th><th>Indicators</th><th>Review samples</th><th>Evidence</th><th>Review status</th><th></th></tr></thead><tbody>
    {filteredFindings.map((finding) => <tr key={finding.id} onClick={() => openFinding(finding)}>
      <td><span className={`priority-label ${findingTone[finding.priority]}`}>{finding.priority}</span></td><td className="mono">{finding.id}</td><td className="mono">{finding.cseId}</td><td>{finding.capability}</td><td>{finding.type}</td><td><strong>{finding.title}</strong><small className="cell-secondary">{period.start} — {period.end}</small></td><td>{finding.indicators.length} indicators</td><td>{finding.sampleCount}</td><td>{finding.sourceRecordIds.length ? 'Available' : 'Insufficient evidence'}</td><td>{reviewStates[reviewQueue.find((sample) => sample.findingId === finding.id)?.id ?? ''] ?? finding.status}</td><td><button className="table-action" onClick={(event) => { event.stopPropagation(); openFinding(finding) }}>Open evidence →</button></td>
    </tr>)}
  </tbody></table>{!compact && <div className="table-foot">{filteredFindings.length} findings · Sorted by supervisory priority · Select a row to trace the evidence</div>}</div>

  const queueTable = (compact = false) => <div className="table-wrap"><table className="data-table queue-table"><thead><tr><th>Rank</th><th>CSE</th><th>Sample ID</th><th>Record type</th><th>Capability</th><th>Signal type</th><th>Priority</th><th>Reason selected</th><th>Review status</th><th></th></tr></thead><tbody>
    {(compact ? filteredQueue.slice(0, 5) : filteredQueue).map((sample, index) => { const finding = findings.find((item) => item.id === sample.findingId); return <tr key={sample.id} onClick={() => openSample(sample.id)}><td className="mono">{index + 1}</td><td className="mono">{sample.cseId}</td><td className="mono">{sample.recordId}<small className="cell-secondary">{sample.caseId}</small></td><td>{sample.type}<small className="cell-secondary">{sample.severity}</small></td><td>{finding?.capability}</td><td>{finding?.type}</td><td><span className={`priority-label ${findingTone[finding?.priority ?? 'LOW']}`}>{finding?.priority ?? 'LOW'}</span></td><td>{sample.reason}</td><td>{reviewStates[sample.id] ?? 'Pending human review'}</td><td><button className="table-action" onClick={(event) => { event.stopPropagation(); openSample(sample.id) }}>Open evidence →</button></td></tr>})}
  </tbody></table></div>

  const entityTable = <div className="table-wrap"><table className="data-table"><thead><tr><th>CSE</th><th>Alerts</th><th>Cases</th><th>Case conversion</th><th>Investigation completion</th><th>Escalation completion</th><th>Mean acknowledgement</th><th>Findings</th></tr></thead><tbody>{entities.map((entity) => {
    const metric = metricsByCse.get(entity.id)!
    const count = findings.filter((finding) => finding.cseId === entity.id).length
    return <tr key={entity.id} onClick={() => { setEntityId(entity.id); setView('entities') }}><td className="mono">{entity.id}<small className="cell-secondary">{entity.name}</small></td><td>{fmt(metric.alertCount)}</td><td>{fmt(metric.caseCount)}</td><td>{pct(metric.caseConversion)}</td><td>{pct(metric.investigationRate)}</td><td>{pct(metric.escalationCompletion)}</td><td>{Math.round(metric.responseMinutes)} min</td><td>{count || '—'}</td></tr>
  })}</tbody></table></div>

  const renderOverview = () => <>
    <section className="assessment-banner"><div><span className="section-label">SOC ASSESSMENT</span><h2>{period.id}</h2><p>Periodic SOC submission · {period.start} — {period.end}</p></div><div className="banner-status"><span>ASSESSMENT STATUS</span><strong>COMPLETE</strong><small>Validation passed with warnings</small></div></section>
    <section className="workflow-strip" aria-label="Assessment workflow">{[['submission', '01', 'Submission'], ['quality', '02', 'Validate'], ['normalization', '03', 'Normalize'], ['findings', '04', 'Assess']].map(([key, index, label], step) => <button key={key} className={`workflow-step ${step === 3 ? 'current' : 'complete'}`} onClick={() => setView(key as View)}><b>{index}</b><span>{label}</span>{step < 3 && <i>›</i>}</button>)}</section>
    <section className="assessment-facts"><Fact label="CSEs ASSESSED" value={`${entities.length}`} /><Fact label="ENTITIES REQUIRING ATTENTION" value={`${entitiesRequiringAttention}`} tone="warn" /><Fact label="FINDINGS FOR REVIEW" value={`${findings.length}`} /><Fact label="ACCEPTED RECORDS" value={fmt(acceptedRecordCount)} /><Fact label="QUARANTINED RECORDS" value={fmt(quarantinedRecordCount)} tone="warn" /><Fact label="SUBMISSION STATUS" value="Passed with warnings" tone="ok" /></section>
    <section className="split-heading"><div><span className="section-label">ASSESSMENT OUTPUT</span><h2>Supervisory findings</h2><p>Entity-level signals derived from periodic operational evidence.</p></div><button className="button-secondary" onClick={() => setView('findings')}>View all findings</button></section>
    <section className="priority-counts"><div><span className="priority-label high">HIGH</span><strong>{highCount}</strong><small>Review first</small></div><div><span className="priority-label medium">MEDIUM</span><strong>{mediumCount}</strong><small>Review</small></div><div><span className="priority-label low">LOW</span><strong>{lowCount}</strong><small>Monitor</small></div><div className="count-note">Priority indicates review order, not a verdict or automated risk determination.</div></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">CAPABILITY EVIDENCE</span><h2>{entityId} · eight assessment areas</h2></div><label className="compact-select-label">Entity<select value={entityId} onChange={(event) => setEntityId(event.target.value)}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.id}</option>)}</select></label></div><div className="capability-grid">{capabilityAreas.map((area) => <div key={area}><strong>{area}</strong><span className={capabilityStatus(entityId, area).startsWith('Insufficient') ? 'status-warn' : ''}>{capabilityStatus(entityId, area)}</span></div>)}</div></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">SUPERVISORY FINDINGS</span><h2>Findings register</h2></div><span className="quiet-meta">{findings.length} findings · {entities.length} entities</span></div>{findingTable(true)}</section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">MANUAL REVIEW</span><h2>Review queue</h2></div><div className="section-actions"><span className="quiet-meta">{reviewQueue.length} alert and investigation samples</span><button className="table-action" onClick={() => setView('review')}>Open queue →</button></div></div>{queueTable(true)}</section>
    <section className="section-block data-quality-summary"><div><span className="section-label">DATA QUALITY</span><strong>{fmt(quarantinedRecordCount)} records quarantined</strong><small>Optional-field warnings are retained separately; quarantined records are excluded from analytics.</small></div><button className="button-secondary" onClick={() => setView('quality')}>Review validation →</button></section>
    <div className="closing-principle">SAT-SA assists supervisory assessment. <strong>The human examiner remains the final decision-maker.</strong></div>
  </>

  const renderSubmission = () => <>
    <PageIntro eyebrow="PERIODIC DATA INTAKE" title="Submission package" text="Local synthetic submission package for a 30-day CSE assessment. No live file upload or external source is connected." />
    <div className="package-header"><div><span className="section-label">ASSESSMENT ID</span><strong className="mono">{period.id}</strong></div><div><span className="section-label">SUBMISSION PERIOD</span><strong>{period.start} — {period.end}</strong></div><div><span className="section-label">ENTITIES</span><strong>{entities.length} CSEs</strong></div><div><span className="section-label">PACKAGE STATUS</span><strong className="status-text">Received · validation passed with warnings</strong></div></div><div className="submission-meta"><span>SCHEMA VERSION <strong className="mono">{submissions[0].schema_version}</strong></span><span>EARLIEST RECEIPT <strong className="mono">01 Oct 2026 09:14 UTC</strong></span><span>ASSET INVENTORY <strong>{fmt(assets.length)} records · optional reference</strong></span></div>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">RECEIVED DATASETS</span><h2>Submission inventory</h2></div><span className="quiet-meta">Asset inventory supplied as supporting reference</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Dataset</th><th>Accepted records</th><th>Quarantined</th><th>Source period</th><th>Status</th></tr></thead><tbody>{sourceCounts.map((source) => <tr key={source.name}><td><strong>{source.name}</strong></td><td>{fmt(source.accepted)}</td><td>{source.quarantined || '—'}</td><td>{period.start} — {period.end}</td><td><span className="status-ok">Received</span></td></tr>)}</tbody><tfoot><tr><th>Total accepted</th><th>{fmt(acceptedRecordCount)}</th><th>{fmt(quarantinedRecordCount)}</th><th></th><th>4 datasets</th></tr></tfoot></table></div><div className="package-note">Synthetic Demonstration Dataset · {entities.length} fictional CSEs · Asset inventory: {fmt(assets.length)} records · Quarantined rows excluded before assessment.</div></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">CSE SUBMISSION MANIFEST</span><h2>Received assessment batches</h2></div><span className="quiet-meta">{submissions.length} deterministic local packages</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Submission</th><th>CSE</th><th>Period</th><th>Received</th><th>Schema</th><th>Source files</th><th>Record counts</th><th>Validation</th></tr></thead><tbody>{submissions.map((submission) => <tr key={submission.submission_id}><td className="mono">{submission.submission_id}</td><td className="mono">{submission.cse_id}</td><td>{submission.assessment_period}</td><td className="mono">{new Date(submission.received_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</td><td className="mono">{submission.schema_version}</td><td>{submission.source_files.join(', ')}</td><td>{fmt(submission.accepted_records)} total<small className="cell-secondary">{Object.entries(submission.record_counts).map(([dataset, count]) => `${dataset}: ${fmt(count)}`).join(' · ')}</small></td><td>{submission.validation_status}</td></tr>)}</tbody></table></div></section>
    <div className="bottom-actions"><span>Submission is represented locally; no real CSE data is present.</span><button className="button-primary" onClick={() => setView('quality')}>Validate submission →</button></div>
  </>

  const renderQuality = () => <>
    <PageIntro eyebrow="INGEST / VALIDATE" title="Data quality and validation" text="Schema, type, required-field, referential-integrity, timestamp, and duplicate checks are represented for the synthetic package." />
    <div className="validation-summary"><strong>VALIDATION PASSED WITH WARNINGS</strong><span>{fmt(acceptedRecordCount)} accepted</span><span>{fmt(quarantinedRecordCount)} quarantined</span><span>0 blocking errors</span></div>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">SOURCE VALIDATION</span><h2>Record acceptance</h2></div><span className="quiet-meta">Quarantined records are not part of canonical analytics.</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Dataset</th><th>Schema</th><th>Types</th><th>Required fields</th><th>References</th><th>Accepted</th><th>Quarantined</th></tr></thead><tbody>{sourceCounts.map((source, index) => <tr key={source.name}><td>{source.name}</td><td><span className="status-ok">PASS</span></td><td><span className="status-ok">PASS</span></td><td><span className="status-ok">PASS</span></td><td><span className={index === 2 ? 'status-warn' : 'status-ok'}>{index === 2 ? '8 quarantined' : 'PASS'}</span></td><td>{fmt(source.accepted)}</td><td>{source.quarantined || '—'}</td></tr>)}</tbody></table></div></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">VALIDATION FINDINGS</span><h2>Warnings and quarantine</h2></div><span className="quiet-meta">{fmt(quarantinedRecordCount)} records excluded from analysis</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Finding</th><th>Condition</th><th>Records</th><th>Disposition</th><th>Analytics impact</th></tr></thead><tbody>{quarantinedRecords.map((issue) => <tr key={issue.code}><td className="mono">{issue.code}</td><td>{issue.issue}</td><td>{issue.records}</td><td>{issue.disposition}</td><td>{issue.disposition === 'Quarantined' ? 'Excluded from canonical model' : 'Optional field; retained without classification'}</td></tr>)}</tbody></table></div></section>
    <section className="check-grid">{['Schema validation', 'Type validation', 'Required fields', 'Referential integrity', 'Timestamp consistency', 'Duplicate detection'].map((check, index) => { const notes = ['Validated for accepted records', 'Canonical field types recognized', 'Required identifiers present', '8 unknown case references quarantined', '6 malformed timestamps quarantined', '23 duplicate alert identifiers quarantined']; return <div key={check}><span className={index >= 3 ? 'check-warn' : 'check-ok'}>{index >= 3 ? 'WARN' : 'PASS'}</span><strong>{check}</strong><small>{notes[index]}</small></div> })}</section>
    <div className="bottom-actions"><span>Non-blocking warnings recorded. Quarantine remains outside the analytical dataset.</span><button className="button-primary" onClick={() => setView('normalization')}>Continue to normalization →</button></div>
  </>

  const renderNormalization = () => <>
    <PageIntro eyebrow="NORMALIZE" title="Canonical analytical model" text="Source fields are mapped locally to a consistent supervisory evidence model before assessment." />
    <section className="normalization-status"><div><span className="status-ok">COMPLETE</span><strong>4 source datasets → 1 canonical analytical model</strong></div><span>{fmt(acceptedRecordCount)} accepted records · {fmt(quarantinedRecordCount)} excluded before normalization</span></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">FIELD MAPPING</span><h2>Source to canonical fields</h2></div><span className="quiet-meta">Deterministic local transformation</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Source dataset</th><th>Source field</th><th></th><th>Canonical field</th><th>Canonical model</th></tr></thead><tbody>{sourceCounts.map((source) => <tr key={source.sourceField}><td>{source.name}</td><td className="mono">{source.sourceField}</td><td className="mapping-arrow">→</td><td className="mono">{source.canonicalField}</td><td>Operational evidence</td></tr>)}<tr><td>Alert Metadata</td><td className="mono">src_entity</td><td className="mapping-arrow">→</td><td className="mono">cse_id</td><td>Entity reference</td></tr><tr><td>Alert Metadata</td><td className="mono">src_severity</td><td className="mapping-arrow">→</td><td className="mono">severity</td><td>Normalized enum</td></tr><tr><td>Investigation Workflow</td><td className="mono">src_evidence_refs</td><td className="mapping-arrow">→</td><td className="mono">evidence_reference_count</td><td>Workflow evidence</td></tr></tbody></table></div></section>
    <section className="relationship-strip"><div><strong>Alert</strong><span>alert_id</span></div><i>→</i><div><strong>Case</strong><span>case_id</span></div><i>→</i><div><strong>Investigation</strong><span>case_id</span></div><i>→</i><div><strong>Escalation</strong><span>case_id</span></div><p>Record IDs preserve source traceability across the canonical model.</p></section>
    <div className="bottom-actions"><span>Normalized values retain links to source record IDs.</span><button className="button-primary" onClick={() => setView('overview')}>Open assessment →</button></div>
  </>

  const renderFindings = () => <>
    <PageIntro eyebrow="ASSESS" title="Supervisory findings" text="Findings connect operational evidence to capability areas. Priority orders manual review; it is not a score or verdict." />
    <div className="findings-summary"><span><b className="priority-label high">HIGH</b>{highCount} review first</span><span><b className="priority-label medium">MEDIUM</b>{mediumCount} review</span><span className="quiet-meta">Analytics version SAT-SA-POC-0.2 · {findings.length} traceable findings</span></div>
    <div className="filter-bar"><label>Search<input value={findingSearch} onChange={(event) => setFindingSearch(event.target.value)} placeholder="CSE, finding ID, record ID" /></label><label>Capability<select value={findingCapability} onChange={(event) => setFindingCapability(event.target.value)}><option>All capabilities</option>{capabilityAreas.map((area) => <option key={area}>{area}</option>)}</select></label><label>Signal family<select value={findingFamily} onChange={(event) => setFindingFamily(event.target.value)}><option>All signal families</option>{signalFamilies.map((family) => <option key={family}>{family}</option>)}</select></label><label>Priority<select value={findingPriority} onChange={(event) => setFindingPriority(event.target.value)}><option>All priorities</option>{(['HIGH', 'MEDIUM', 'LOW'] as const).map((priority) => <option key={priority}>{priority}</option>)}</select></label></div>
    {filteredFindings.length ? findingTable() : <div className="empty-results">No findings match the selected filters.</div>}
    <section className="capability-overview"><div className="section-bar"><div><span className="section-label">CAPABILITY EVIDENCE</span><h2>{entityId} · eight supervisory areas</h2></div><span className="quiet-meta">Evidence indicates review areas, not maturity certifications.</span></div><div className="capability-grid">{capabilityAreas.map((area) => <div key={area}><strong>{area}</strong><span>{capabilityStatus(entityId, area)}</span></div>)}</div></section>
  </>

  const renderReviewQueue = () => <>
    <PageIntro eyebrow="HUMAN EXAMINATION" title="Manual review queue" text="Prioritized alert, case, and investigation samples selected for supervisor examination. Open a record to inspect linked evidence." />
    <div className="queue-summary"><strong>{reviewQueue.length} samples selected</strong><span>Alerts, cases, and investigations · Local demonstration state</span><span>Queue order is rule-based and reviewable.</span></div>
    <div className="filter-bar"><label>Search<input value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} placeholder="Record ID or CSE" /></label><label>CSE<select value={queueCse} onChange={(event) => setQueueCse(event.target.value)}><option>All CSEs</option>{entities.map((entity) => <option key={entity.id}>{entity.id}</option>)}</select></label><label>Capability<select value={queueCapability} onChange={(event) => setQueueCapability(event.target.value)}><option>All capabilities</option>{capabilityAreas.map((area) => <option key={area}>{area}</option>)}</select></label><label>Signal type<select value={queueFamily} onChange={(event) => setQueueFamily(event.target.value)}><option>All signal types</option>{signalFamilies.map((family) => <option key={family}>{family}</option>)}</select></label><label>Priority<select value={queuePriority} onChange={(event) => setQueuePriority(event.target.value)}><option>All priorities</option>{(['HIGH', 'MEDIUM', 'LOW'] as const).map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>Record type<select value={queueRecordType} onChange={(event) => setQueueRecordType(event.target.value)}><option>All record types</option>{(['Alert', 'Case', 'Investigation'] as const).map((type) => <option key={type}>{type}</option>)}</select></label><label>Review status<select value={queueReviewStatus} onChange={(event) => setQueueReviewStatus(event.target.value)}><option>All review statuses</option><option>Pending human review</option><option>Queued for manual examination</option><option>Dismissed / not substantiated</option></select></label></div>
    {filteredQueue.length ? queueTable() : <div className="empty-results">No review samples match the selected filters.</div>}
  </>

  const renderEntities = () => <>
    <PageIntro eyebrow="ENTITY ASSESSMENT" title="CSE entities" text="Operational measures and finding counts across the periodic submission." />
    {entityTable}
    <section className="entity-detail section-block"><div className="section-bar"><div><span className="section-label">CAPABILITY EVIDENCE</span><h2>{entityId} · {entities.find((entity) => entity.id === entityId)?.name}</h2><small className="cell-secondary">Supervisory attention indicator: {findings.some((finding) => finding.cseId === entityId && finding.priority === 'HIGH') ? 'HIGH · manual examination recommended' : findings.some((finding) => finding.cseId === entityId) ? 'REVIEW · manual examination recommended' : 'No current finding'}. Prioritization aid only.</small></div><select value={entityId} onChange={(event) => setEntityId(event.target.value)} aria-label="Select CSE">{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.id}</option>)}</select></div><div className="capability-list">{capabilityAreas.map((area) => <div key={area}><strong>{area}</strong><span className={capabilityStatus(entityId, area).startsWith('Potential') ? 'status-warn' : ''}>{capabilityStatus(entityId, area)}</span></div>)}</div><div className="entity-findings">{findings.filter((finding) => finding.cseId === entityId).map((finding) => <button key={finding.id} onClick={() => openFinding(finding)}><span className={`priority-label ${findingTone[finding.priority]}`}>{finding.priority}</span><span>{finding.title}</span><span className="table-action">Open evidence →</span></button>)}</div></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">ENTITY TREND</span><h2>{entityId} · operational measures</h2></div></div><TrendChart cseId={entityId} /></section>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">PRIORITIZED SAMPLES</span><h2>{entityId} · manual examination</h2></div><span className="quiet-meta">{reviewQueue.filter((sample) => sample.cseId === entityId).length} selected samples</span></div><div className="entity-findings">{reviewQueue.filter((sample) => sample.cseId === entityId).map((sample) => <button key={sample.id} onClick={() => openSample(sample.id)}><span className="mono">{sample.recordId}</span><span>{sample.type} · {findings.find((finding) => finding.id === sample.findingId)?.type}</span><span className="table-action">Open evidence →</span></button>)}</div></section>
  </>

  const renderPeers = () => <>
    <PageIntro eyebrow="BENCHMARKING" title="Peer analysis" text="Entity value, peer median, observed range, and deviation for the same submission period." />
    <div className="peer-toolbar"><label>Selected entity<select value={peerEntityId} onChange={(event) => setPeerEntityId(event.target.value)}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.id}</option>)}</select></label><span>Peer comparison provides context, not a verdict. Reference set: all CSEs in this synthetic submission; sector matching is not modeled.</span></div>
    <div className="table-wrap"><table className="data-table peer-table"><thead><tr><th>CSE</th><th>Alerts</th><th>Case conversion</th><th>Investigation completion</th><th>Escalation completion</th><th>Response time</th><th>Closure time</th><th>Telemetry coverage</th></tr></thead><tbody>{entities.map((entity) => {
      const metric = metricsByCse.get(entity.id)!
      return <tr key={entity.id} className={entity.id === 'CSE-03' ? 'healthy-row' : ''}><td className="mono">{entity.id}{entity.id === 'CSE-03' && <small className="cell-secondary">High volume · healthy handling</small>}</td><td>{fmt(metric.alertCount)}<MetricCompare value={metric.alertCount} metric="alerts" /></td><td>{pct(metric.caseConversion)}<MetricCompare value={metric.caseConversion} metric="caseConversion" /></td><td>{pct(metric.investigationRate)}<MetricCompare value={metric.investigationRate} metric="investigationRate" /></td><td>{pct(metric.escalationCompletion)}<MetricCompare value={metric.escalationCompletion} metric="escalationCompletion" /></td><td>{Math.round(metric.responseMinutes)} min<MetricCompare value={metric.responseMinutes} metric="responseMinutes" /></td><td>{Math.round(metric.closureMinutes)} min<MetricCompare value={metric.closureMinutes} metric="closureMinutes" /></td><td>{pct(metric.telemetryCoverage)}<MetricCompare value={metric.telemetryCoverage} metric="telemetryCoverage" /></td></tr>
    })}</tbody></table></div>
    <section className="context-callout"><strong>{peerEntityId} · Selected peer context</strong><p>{fmt(metricsByCse.get(peerEntityId)!.alertCount)} alerts vs peer median {fmt(peerRange((metric) => metric.alertCount, metricsByCse.get(peerEntityId)!.alertCount).median)}; case conversion {pct(metricsByCse.get(peerEntityId)!.caseConversion)} vs {pct(peerRange((metric) => metric.caseConversion, metricsByCse.get(peerEntityId)!.caseConversion).median)} peer median; investigation completion {pct(metricsByCse.get(peerEntityId)!.investigationRate)}. {peerEntityId === 'CSE-03' ? 'High volume alone does not create a finding.' : 'Peer context supports examination; it does not set a target or verdict.'}</p></section>
  </>

  const renderTrends = () => <>
    <PageIntro eyebrow="PERIOD TREND" title="Operational trend analysis" text="Weekly completion patterns across the 30-day assessment period; bars derive from linked cases and workflow records." />
    <div className="trend-select"><label htmlFor="trend-entity">Entity</label><select id="trend-entity" value={entityId} onChange={(event) => setEntityId(event.target.value)}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.id} · {entity.name}</option>)}</select><span>{entityId === 'CSE-07' ? 'Persistent decline is visible across the review period.' : 'Compare week-to-week operational activity.'}</span></div>
    <TrendChart cseId={entityId} />
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Period</th><th>Cases</th><th>Investigation completion</th><th>Escalation completion</th><th>Mean acknowledgement</th><th>Mean closure time</th><th>Telemetry coverage</th><th>Review context</th></tr></thead><tbody>{entityTrend(entityId).map((week, index) => <tr key={week.label}><td>{week.label}</td><td>{week.cases}</td><td>{pct(week.investigationRate)}</td><td>{pct(week.escalationRate)}</td><td>{Math.round(week.acknowledgementMinutes)} min</td><td>{Math.round(week.closureMinutes)} min</td><td>{pct(week.telemetryCoverage)}</td><td>{index > 0 && week.investigationRate < entityTrend(entityId)[index - 1].investigationRate ? 'Below preceding period' : 'Within observed pattern'}</td></tr>)}</tbody></table></div>
  </>

  const renderEvidence = () => <>
    <div className="evidence-return"><button className="button-secondary" onClick={() => { setContextOpen(false); setView('review') }}>Return to review queue</button></div>
    <PageIntro eyebrow="TRACEABLE EVIDENCE" title="Finding and sample evidence" text="Traceability connects a finding to the source datasets and underlying alert, case, investigation, and escalation records." />
    {selectedFinding && <>
      <div className="evidence-heading"><div><span className={`priority-label ${findingTone[selectedFinding.priority]}`}>{selectedFinding.priority}</span><h2>{selectedFinding.id} · {selectedFinding.title}</h2><p>{selectedFinding.cseId} · {selectedFinding.capability} · Assessment {selectedFinding.assessmentId}</p></div><span className="pending-badge">{reviewStates[selectedSample?.id ?? ''] ?? selectedFinding.status}</span></div>
      <div className="evidence-layout"><div className="evidence-main">
        <section className="evidence-block"><h3>Finding rationale</h3><p>{selectedFinding.rationale}</p><ul>{selectedFinding.indicators.map((indicator) => <li key={indicator}>{indicator}</li>)}</ul></section>
        <section className="evidence-block"><h3>Selected sample · {selectedSample?.recordId}</h3><div className="record-facts"><Fact label="ALERT ID" value={selectedAlert?.alert_id ?? 'Not available'} mono /><Fact label="CSE" value={selectedAlert?.cse_id ?? '—'} mono /><Fact label="SEVERITY" value={selectedAlert?.severity ?? '—'} /><Fact label="SOURCE" value={selectedAlert?.source ?? '—'} /><Fact label="DISPOSITION" value={selectedAlert?.disposition ?? '—'} /><Fact label="ASSET" value={selectedAsset?.asset_id ?? '—'} mono /><Fact label="ASSET CRITICALITY" value={selectedAsset?.criticality ?? '—'} /><Fact label="TELEMETRY LAST SEEN" value={selectedAsset?.telemetry_last_seen ? new Date(selectedAsset.telemetry_last_seen).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'No telemetry observed'} mono /><Fact label="DETECTED" value={selectedAlert ? new Date(selectedAlert.detected_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'} mono /><Fact label="ACKNOWLEDGED" value={selectedAlert ? new Date(selectedAlert.acknowledged_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'} mono /><Fact label="SLA DUE" value={selectedAlert ? new Date(selectedAlert.sla_due_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'} mono /><Fact label="CASE CREATED" value={selectedCase ? new Date(selectedCase.created_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'No case'} mono /><Fact label="CLOSED" value={selectedAlert?.closed_at ? new Date(selectedAlert.closed_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'Open / none'} mono /><Fact label="CLOSURE REASON" value={selectedAlert?.closure_reason ?? 'Not closed'} /><Fact label="ESCALATION REQUIRED" value={selectedAlert?.escalation_required ? 'Yes' : 'No'} /><Fact label="ESCALATION" value={selectedEscalation ? `${selectedEscalation.escalation_id} · ${selectedEscalation.status}` : 'NONE FOUND'} mono /><Fact label="INVESTIGATION" value={selectedInvestigation ? `${selectedInvestigation.investigation_id} · ${selectedInvestigation.analyst_action_count} actions · ${selectedInvestigation.evidence_reference_count} refs` : 'NONE FOUND'} mono /><Fact label="FINDING COUNT" value={selectedInvestigation ? String(selectedInvestigation.finding_count) : 'No investigation record'} /><Fact label="ROOT CAUSE" value={selectedCase?.root_cause ?? 'Not recorded'} /><Fact label="REMEDIATION" value={selectedCase?.remediation_required ? selectedCase.remediation_status : 'Not required'} /><Fact label="REMEDIATION EVIDENCE" value={selectedInvestigation ? selectedInvestigation.remediation_evidence_present ? 'Present' : 'Not recorded' : 'No investigation record'} /></div></section>
        <section className="section-block linked-records"><div className="section-bar"><div><span className="section-label">RELATIONAL TRACE</span><h2>Alert → case → investigation → escalation</h2></div></div><div className="relationship-strip compact-rel"><RecordStep label="ALERT" value={selectedAlert?.alert_id ?? 'Not linked'} /><i>→</i><RecordStep label="CASE" value={selectedCase?.case_id ?? 'Not linked'} /><i>→</i><RecordStep label="INVESTIGATION" value={selectedInvestigation?.investigation_id ?? 'None found'} /><i>→</i><RecordStep label="ESCALATION" value={selectedEscalation?.escalation_id ?? 'None found'} /></div></section>
        <section className="evidence-block"><span className="section-label">WHY THIS SAMPLE WAS PRIORITISED</span><ul><li>{selectedSample?.reason}</li><li>{selectedFinding.method}</li><li>Peer/baseline: {selectedFinding.baseline}</li></ul><p className="caution-text">Potential supervisory indicator only. The supervisor determines relevance and next action.</p></section>
      </div><aside className="evidence-side"><div className="trace-card"><span className="section-label">TRACEABILITY</span><dl><dt>Finding ID</dt><dd className="mono">{selectedFinding.id}</dd><dt>Assessment ID</dt><dd className="mono">{selectedFinding.assessmentId}</dd><dt>Analytics version</dt><dd className="mono">SAT-SA-POC-0.2</dd><dt>Generated</dt><dd className="mono">05 Oct 2026 12:00 UTC</dd><dt>Method</dt><dd>{selectedFinding.method}</dd><dt>Source datasets</dt><dd>{selectedFinding.sourceDataset}</dd><dt>Source record IDs</dt><dd className="mono">{[...selectedFinding.sourceRecordIds, selectedSample?.recordId ?? ''].filter(Boolean).join(' · ')}</dd></dl></div><div className="review-form"><span className="section-label">SUPERVISOR REVIEW</span><strong>Status: {reviewStates[selectedSample?.id ?? ''] ?? 'Pending review'}</strong><small>Local demonstration state only</small><button className="button-primary" onClick={() => setReviewState('Queued for manual examination')}>Mark for examination</button><button className="button-secondary" onClick={() => setReviewState('Dismissed / not substantiated')}>Dismiss / not substantiated</button><label htmlFor="review-note">Review note</label><textarea id="review-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add an examiner note" rows={3} /><button className="table-action" onClick={saveNote}>Save note locally</button>{reviewNotes[selectedSample?.id ?? ''] && <small className="saved-note">Saved: {reviewNotes[selectedSample?.id ?? '']}</small>}</div></aside></div>
    </>}
  </>

  const renderAudit = () => <>
    <PageIntro eyebrow="AUDITABILITY" title="Assessment audit trail" text="Finding identifiers, rule versions, source datasets, linked record IDs, and local reviewer state." />
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Finding</th><th>Assessment</th><th>CSE / capability</th><th>Signal type</th><th>Method / version</th><th>Source records</th><th>Review status</th></tr></thead><tbody>{findings.map((finding) => { const sample = reviewQueue.find((item) => item.findingId === finding.id); return <tr key={finding.id} onClick={() => openFinding(finding)}><td className="mono">{finding.id}<small className="cell-secondary">{finding.generatedAt}</small></td><td className="mono">{finding.assessmentId}</td><td>{finding.cseId}<small className="cell-secondary">{finding.capability}</small></td><td>{finding.type}</td><td>{finding.method}<small className="cell-secondary">SAT-SA-POC-0.2</small></td><td className="mono">{finding.sourceRecordIds.join(', ') || 'No source reference'}</td><td>{sample ? reviewStates[sample.id] ?? finding.status : finding.status}</td></tr>})}</tbody></table></div>
  </>

  const renderValidation = () => <>
    <PageIntro eyebrow="ANALYTICAL VALIDATION" title="Synthetic scenario checks" text="Ground-truth patterns are used only to check whether deterministic rules rediscover seeded supervisory scenarios." />
    <div className="validation-callout">Prototype validation on synthetic demonstration scenarios. These checks do not establish production accuracy or replace expert manual review.</div>
    <div className="validation-grid"><ValidationCheck label="Seeded signal scenarios" value={String(syntheticValidation.injected)} detail="Deterministic synthetic supervisory patterns" /><ValidationCheck label="Rediscovered" value={`${syntheticValidation.rediscovered} / ${syntheticValidation.injected}`} detail="Rule output matched seeded signal families" /><ValidationCheck label="Not rediscovered" value={String(syntheticValidation.notRediscovered)} detail="Scenario comparisons not matched by current rules" /><ValidationCheck label="Execution gap · CSE-07" value={syntheticValidation.executionGap ? 'Rediscovered' : 'Not detected'} detail="Fast critical closure, escalation, investigation evidence" /><ValidationCheck label="Negative space · CSE-09" value={syntheticValidation.negativeSpace ? 'Rediscovered' : 'Not detected'} detail="Missing categories, telemetry and workflow records" /><ValidationCheck label="Anomaly · CSE-04" value={syntheticValidation.anomaly ? 'Rediscovered' : 'Not detected'} detail="Modified z-score against peer median and MAD" /><ValidationCheck label="Investigation evidence · CSE-05" value={syntheticValidation.investigationEvidenceGap ? 'Rediscovered' : 'Not detected'} detail="Evidence references trail peer distribution" /><ValidationCheck label="Operational discipline · CSE-10" value={syntheticValidation.operationalDiscipline ? 'Rediscovered' : 'Not detected'} detail="Template reuse and closure-band concentration" /><ValidationCheck label="Remediation evidence · CSE-11" value={syntheticValidation.remediationEvidenceGap ? 'Rediscovered' : 'Not detected'} detail="Remediation-required cases and linked investigation evidence" /><ValidationCheck label="Healthy high-volume control · CSE-03" value={syntheticValidation.healthyHighVolumeNotFlagged ? 'Not flagged' : 'Unexpected finding'} detail="High volume does not itself create a finding" /></div>
    <section className="section-block"><div className="section-bar"><div><span className="section-label">EXPERT COMPARISON</span><h2>Manual validation protocol</h2></div></div><ol className="protocol-list"><li>Freeze a periodic submission sample and document the expert reviewer’s expected evidence.</li><li>Run the deterministic rules without access to the expert assessment.</li><li>Compare finding rationale, selected records, and missed/over-selected samples.</li><li>Record adjudication and disagreement; do not infer production accuracy from synthetic results.</li></ol></section>
  </>

  const contextPanel = selectedFinding && <aside className="context-panel" aria-label="Selected finding evidence">
    <header className="context-head"><div><span className={`priority-label ${findingTone[selectedFinding.priority]}`}>{selectedFinding.priority} SUPERVISORY PRIORITY</span><h2>{selectedFinding.id}</h2><p>{selectedFinding.cseId} · {selectedFinding.capability}</p></div><button className="context-close" aria-label="Close evidence panel" onClick={() => setContextOpen(false)}>×</button></header>
    <div className="context-body"><strong>{selectedFinding.title}</strong><p>{selectedFinding.rationale}</p><h3>Supporting indicators</h3><ul>{selectedFinding.indicators.map((indicator) => <li key={indicator}>{indicator}</li>)}</ul><div className="context-meta"><span>Signal family</span><strong>{selectedFinding.type}</strong><span>Peer / expected baseline</span><strong>{selectedFinding.baseline}</strong><span>Detection method</span><strong>{selectedFinding.method}</strong><span>Source datasets</span><strong>{selectedFinding.sourceDataset}</strong><span>Source record IDs</span><strong className="mono">{[...selectedFinding.sourceRecordIds, selectedSample?.recordId ?? ''].filter(Boolean).join(' · ') || 'No linked sample'}</strong></div>
      {selectedSample && <section className="context-sample"><span className="section-label">SELECTED SAMPLE · {selectedSample.type.toUpperCase()}</span><strong className="mono">{selectedSample.recordId}</strong><div>{selectedSample.reason}</div><div className="sample-links">ALERT {selectedAlert?.alert_id ?? '—'}<br />CASE {selectedCase?.case_id ?? '—'}<br />INV {selectedInvestigation?.investigation_id ?? 'NONE FOUND'}<br />ESC {selectedEscalation?.escalation_id ?? 'NONE FOUND'}</div></section>}
      {selectedSample && <button className="table-action" onClick={() => setView('evidence')}>Open full evidence view →</button>}
      <div className="context-review"><span className="section-label">SUPERVISOR REVIEW · LOCAL STATE</span><strong>{selectedSample ? reviewStates[selectedSample.id] ?? 'Pending human review' : selectedFinding.status}</strong>{selectedSample && <><button className="button-primary" onClick={() => setReviewState('Queued for manual examination')}>Mark for examination</button><button className="button-secondary" onClick={() => setReviewState('Dismissed / not substantiated')}>Dismiss / not substantiated</button><label htmlFor="context-note">Add note</label><textarea id="context-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} placeholder="Examiner note" /><button className="table-action" onClick={saveNote}>Save note locally</button>{reviewNotes[selectedSample.id] && <small className="saved-note">Saved: {reviewNotes[selectedSample.id]}</small>}</>}</div>
    </div>
  </aside>

  const renderPage = () => ({ overview: renderOverview, submission: renderSubmission, quality: renderQuality, normalization: renderNormalization, findings: renderFindings, review: renderReviewQueue, entities: renderEntities, peers: renderPeers, trends: renderTrends, evidence: renderEvidence, audit: renderAudit, validation: renderValidation }[view]())

  return <div className="workstation">
    <aside className="sidebar"><div className="brand"><div className="brand-seal"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M17.4 4.2H9.1L5.2 7.9l8.7 4.2-3.5 7.7H5.1" stroke="#E8ECE9" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter"/><path d="m11.8 19.8 4.1-15.6 4.2 15.6m-6.5-6h4.7" stroke="#E8ECE9" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter"/><circle cx="5.2" cy="7.9" r="1.25" fill="#4F8A87"/></svg></div><div><strong>SAT-SA</strong><small>SUPERVISORY ANALYTICS TOOL FOR SOC</small></div></div><div className="side-section-label">ASSESSMENT</div><nav className="side-nav">{views.filter((item) => ['overview', 'findings', 'review', 'entities', 'peers', 'trends', 'evidence'].includes(item.key)).map((item) => <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}><span>{item.label}</span>{item.key === 'review' && <small>{reviewQueue.length}</small>}</button>)}</nav><div className="side-section-label submission-label">SUBMISSION</div><nav className="side-nav">{views.filter((item) => ['submission', 'quality', 'normalization'].includes(item.key)).map((item) => <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>{item.label}</button>)}</nav><div className="side-section-label system-label">SYSTEM</div><nav className="side-nav">{views.filter((item) => ['audit', 'validation'].includes(item.key)).map((item) => <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>{item.label}</button>)}</nav><div className="side-footer"><span className="prototype-label">PROTOTYPE · SYNTHETIC DATA</span><p>NCIIPC / CSE supervisory assessment<br />Local demonstration state</p></div></aside>
    <main className="main">
      <header className="topbar"><div className="crumb">SIH26157 <span>/</span> NTRO <span>/</span> SOC ASSESSMENT</div><div className="top-assessment"><span className="offline-state">AIR-GAPPED · SYNTHETIC DEMONSTRATION</span><span className="role-state">SUPERVISOR</span><span className="mono">{period.id}</span><span className="assessment-state">COMPLETE</span></div></header>
      <div className="workflow-nav">{[['submission', 'Submission'], ['quality', 'Validation'], ['normalization', 'Normalization'], ['overview', 'Assessment']].map(([key, label], index) => <button key={key} className={view === key ? 'selected' : ''} onClick={() => setView(key as View)}><b>0{index + 1}</b>{label}</button>)}</div>
      <div className="page-content">
        <div className="page-title"><div><span className="section-label">{view === 'overview' ? 'ASSESSMENT OVERVIEW' : title.toUpperCase()}</span><h1>{view === 'overview' ? 'SOC assessment' : title}</h1></div><div className="page-period">PERIOD <strong>{period.start} — {period.end}</strong></div></div>
        <div className={`assessment-workarea ${contextOpen && view !== 'evidence' ? 'has-context' : ''}`}><div className="assessment-center">{renderPage()}</div>{contextOpen && view !== 'evidence' && contextPanel}</div>
        <footer className="app-footer"><span>Prototype · Synthetic Demonstration Dataset</span><strong>SAT-SA assists supervisory assessment. The human examiner remains the final decision-maker.</strong></footer>
      </div>
    </main>
  </div>
}

function Fact({ label, value, tone, mono = false }: { label: string; value: string; tone?: string; mono?: boolean }) {
  return <div className="fact"><span>{label}</span><strong className={`${tone ?? ''} ${mono ? 'mono' : ''}`}>{value}</strong></div>
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="page-intro"><span className="section-label">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>
}

function MetricCompare({ value, metric }: { value: number; metric: keyof NonNullable<ReturnType<typeof metricsByCse.get>> }) {
  const baseline = peerRange((item) => item[metric] as number, value)
  const deviation = value - baseline.median
  const isRate = ['caseConversion', 'investigationRate', 'escalationCompletion', 'telemetryCoverage'].includes(metric)
  const isCount = metric === 'alerts'
  return <small className="comparison-note">Peer median {isCount ? fmt(baseline.median) : isRate ? pct(baseline.median) : `${Math.round(baseline.median)} min`} · range {isCount ? `${fmt(baseline.min)}–${fmt(baseline.max)}` : isRate ? `${pct(baseline.min)}–${pct(baseline.max)}` : `${Math.round(baseline.min)}–${Math.round(baseline.max)} min`} · Δ {deviation > 0 ? '+' : ''}{isCount ? fmt(Math.round(deviation)) : isRate ? `${Math.round(deviation * 100)} pp` : `${Math.round(deviation)} min`}</small>
}

function RecordStep({ label, value }: { label: string; value: string }) {
  return <div className="record-step"><span>{label}</span><strong className="mono">{value}</strong></div>
}

function ValidationCheck({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="validation-check"><span className="section-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function TrendChart({ cseId }: { cseId: string }) {
  const rows = entityTrend(cseId)
  const width = 680
  const height = 220
  const x = (index: number) => 32 + index * ((width - 64) / (rows.length - 1))
  const y = (value: number) => height - 30 - value * (height - 65)
  const investigationPoints = rows.map((row, index) => `${x(index)},${y(row.investigationRate)}`).join(' ')
  const escalationPoints = rows.map((row, index) => `${x(index)},${y(row.escalationRate)}`).join(' ')
  return <section className="trend-panel"><div className="section-bar"><div><span className="section-label">WEEKLY WORKFLOW COMPLETION</span><h2>{cseId} · investigation and escalation</h2></div><div className="chart-legend"><span><i className="legend-investigation"></i>Investigation</span><span><i className="legend-escalation"></i>Escalation</span></div></div><svg className="trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${cseId} weekly investigation and escalation completion rates`}>{[0, .25, .5, .75, 1].map((value) => <g key={value}><line x1="32" x2={width - 24} y1={y(value)} y2={y(value)} className="chart-grid" /><text x="2" y={y(value) + 4} className="chart-label">{Math.round(value * 100)}%</text></g>)}<polyline points={investigationPoints} className="chart-line investigation-line" /><polyline points={escalationPoints} className="chart-line escalation-line" />{rows.map((row, index) => <g key={row.label}><circle cx={x(index)} cy={y(row.investigationRate)} r="4" className="investigation-point" /><circle cx={x(index)} cy={y(row.escalationRate)} r="4" className="escalation-point" /><text x={x(index)} y={height - 7} textAnchor="middle" className="chart-label">{row.label}</text></g>)}</svg></section>
}

export default App
