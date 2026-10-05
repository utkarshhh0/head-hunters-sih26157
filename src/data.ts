export type Cse = { id: string; name: string; profile: string; alertCount: number; caseCount: number; investigationCount: number; escalationCount: number; responseBase: number }

export type AlertRecord = {
  alert_id: string; cse_id: string; timestamp: string; detected_at: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; category: string; source: string; asset_id: string; status: string; acknowledgement_time: string; acknowledged_at: string; sla_due_at: string; case_id: string | null; linked_case_id: string | null; disposition: string; closed_at: string | null; closure_reason: string | null; escalation_required: boolean; escalated: boolean
}

export type CaseRecord = {
  case_id: string; cse_id: string; alert_id: string; created_at: string; assigned_at: string; investigation_started_at: string | null; severity: AlertRecord['severity']; status: string; closure_time: string | null; closure_reason: string; root_cause: string | null; remediation_required: boolean; remediation_status: string; escalation_required: boolean; escalation_id: string | null
}

export type InvestigationRecord = {
  investigation_id: string; case_id: string; cse_id: string; started_at: string; completed_at: string; analyst_action_count: number; evidence_reference_count: number; finding_count: number; root_cause_identified: boolean; remediation_evidence_present: boolean; investigation_type: string; outcome: string
}

export type EscalationRecord = {
  escalation_id: string; case_id: string; cse_id: string; escalation_type: string; reason: string; required: boolean; created_at: string; acknowledged_at: string | null; completed_at: string | null; destination: string; status: string
}

export type AssetRecord = { asset_id: string; cse_id: string; asset_class: string | null; criticality: string; environment: string; monitoring_expected: boolean; monitoring_observed: boolean; telemetry_last_seen: string | null; monitored: boolean }

const cseSeeds: Cse[] = [
  { id: 'CSE-01', name: 'North Sector Utilities', profile: 'baseline', alertCount: 1500, caseCount: 400, investigationCount: 395, escalationCount: 80, responseBase: 35 },
  { id: 'CSE-02', name: 'Eastern Finance Group', profile: 'high-volume-healthy', alertCount: 2500, caseCount: 675, investigationCount: 660, escalationCount: 125, responseBase: 42 },
  { id: 'CSE-03', name: 'Central Transport Grid', profile: 'high-volume-healthy', alertCount: 2200, caseCount: 650, investigationCount: 635, escalationCount: 130, responseBase: 39 },
  { id: 'CSE-04', name: 'Western Telecom Network', profile: 'response-outlier', alertCount: 1500, caseCount: 377, investigationCount: 362, escalationCount: 95, responseBase: 186 },
  { id: 'CSE-05', name: 'Coastal Health Systems', profile: 'evidence-inconsistency', alertCount: 1200, caseCount: 300, investigationCount: 285, escalationCount: 65, responseBase: 47 },
  { id: 'CSE-06', name: 'National Logistics Exchange', profile: 'baseline', alertCount: 1600, caseCount: 416, investigationCount: 405, escalationCount: 95, responseBase: 33 },
  { id: 'CSE-07', name: 'Southern Power Operator', profile: 'execution-gap', alertCount: 5120, caseCount: 728, investigationCount: 500, escalationCount: 120, responseBase: 51 },
  { id: 'CSE-08', name: 'Western Water Services', profile: 'slow-steady', alertCount: 1500, caseCount: 390, investigationCount: 370, escalationCount: 80, responseBase: 96 },
  { id: 'CSE-09', name: 'Regional Data Exchange', profile: 'negative-space', alertCount: 1300, caseCount: 416, investigationCount: 48, escalationCount: 12, responseBase: 44 },
  { id: 'CSE-10', name: 'National Digital Services', profile: 'repetitive-workflow', alertCount: 2006, caseCount: 460, investigationCount: 446, escalationCount: 285, responseBase: 41 },
  { id: 'CSE-11', name: 'Eastern Grid Coordination', profile: 'remediation-gap', alertCount: 1450, caseCount: 360, investigationCount: 330, escalationCount: 70, responseBase: 40 },
  { id: 'CSE-12', name: 'Northern Settlement Network', profile: 'baseline', alertCount: 1050, caseCount: 275, investigationCount: 265, escalationCount: 60, responseBase: 32 },
]

const four = (value: number) => String(value).padStart(4, '0')
const idPart = (cseId: string) => cseId.slice(-2)
const atMinute = (day: number, minute: number) => new Date(Date.UTC(2026, 8, day, 0, minute)).toISOString()
const plusMinutes = (value: string, minutes: number) => new Date(new Date(value).getTime() + minutes * 60_000).toISOString()
const inRange = (value: number, limit: number) => ((value % limit) + limit) % limit

const categories = ['Malware', 'Credential Abuse', 'Lateral Movement', 'Web Exploit', 'Policy Violation', 'Data Exposure', 'Suspicious Access', 'Service Disruption']
const assetsByCse = new Map<string, AssetRecord[]>()

export const entities = cseSeeds

export const assets: AssetRecord[] = cseSeeds.flatMap((cse, entityIndex) => {
  const entityAssets = Array.from({ length: 12 }, (_, index) => ({
    asset_id: `ASSET-${idPart(cse.id)}-${String(index + 1).padStart(3, '0')}`,
    cse_id: cse.id,
    asset_class: (cse.id === 'CSE-09' && index >= 6) || (cse.id === 'CSE-08' && index >= 9) ? null : index < 3 ? 'Critical service' : index < 7 ? 'Business system' : 'Infrastructure',
    criticality: index < 3 ? 'Critical' : index < 7 ? 'High' : 'Standard',
    monitoring_expected: true,
    environment: index < 3 ? 'Production' : index < 7 ? 'Business production' : 'Recovery / infrastructure',
    monitoring_observed: !(cse.profile === 'negative-space' && index < 6),
    telemetry_last_seen: cse.profile === 'negative-space' && index < 6 ? null : `2026-09-${String(1 + (index * 7 + entityIndex * 3) % 30).padStart(2, '0')}T23:55:00.000Z`,
    monitored: !(cse.profile === 'negative-space' && index < 6),
  }))
  assetsByCse.set(cse.id, entityAssets)
  return entityAssets
})

const alertBases = new Map<string, Array<Omit<AlertRecord, 'case_id' | 'linked_case_id' | 'disposition' | 'status' | 'detected_at' | 'source' | 'acknowledged_at' | 'sla_due_at' | 'closed_at' | 'closure_reason' | 'escalation_required' | 'escalated'>>>()
const caseIndexes = new Map<string, Map<number, number>>()

for (const cse of cseSeeds) {
  const entityAssets = assetsByCse.get(cse.id) ?? []
  const caseAtAlert = new Map<number, number>()
  for (let caseIndex = 1; caseIndex <= cse.caseCount; caseIndex++) {
    caseAtAlert.set(cse.id === 'CSE-07' && caseIndex === 686 ? 4821 : Math.floor((caseIndex - 0.5) * cse.alertCount / cse.caseCount) + 1, caseIndex)
  }
  caseIndexes.set(cse.id, caseAtAlert)
  const bases = Array.from({ length: cse.alertCount }, (_, offset) => {
    const index = offset + 1
    const sample = cse.id === 'CSE-07' && index === 4821
    const minute = inRange(index * 37 + cseSeeds.indexOf(cse) * 113, 30 * 24 * 60)
    const timestamp = sample ? '2026-09-22T14:21:03.000Z' : atMinute(1 + Math.floor(minute / 1440), minute % 1440)
    const severity: AlertRecord['severity'] = sample || (cse.profile === 'execution-gap' ? index % 13 === 0 : index % 19 === 0)
      ? 'Critical' : index % 5 === 0 ? 'High' : index % 3 === 0 ? 'Medium' : 'Low'
    const categoryIndex = cse.profile === 'negative-space' ? 2 + index % (categories.length - 2) : index % categories.length
    const repeatedAsset = cse.profile === 'execution-gap' && index >= 4800 && index <= 4850
    const asset = repeatedAsset ? entityAssets[2] : entityAssets[inRange(index * 17 + cseSeeds.indexOf(cse), entityAssets.length)]
    const ackMinutes = cse.profile === 'response-outlier' ? 155 + index % 61 : cse.profile === 'slow-steady' ? 48 + index % 23 : cse.responseBase + index % 11 - 5
    const acknowledgement = sample ? '2026-09-22T14:21:17.000Z' : plusMinutes(timestamp, ackMinutes)
    return { alert_id: `ALT-${idPart(cse.id)}${four(index)}`, cse_id: cse.id, timestamp, severity, category: categories[categoryIndex], asset_id: asset.asset_id, status: 'Received', acknowledgement_time: acknowledgement }
  })
  alertBases.set(cse.id, bases)
}

export const cases: CaseRecord[] = cseSeeds.flatMap((cse) => {
  const bases = alertBases.get(cse.id) ?? []
  const alertAtCase = [...(caseIndexes.get(cse.id) ?? new Map<number, number>())].map(([alertIndex, caseIndex]) => ({ alertIndex, caseIndex }))
  return alertAtCase.map(({ alertIndex, caseIndex }) => {
    const alert = bases[alertIndex - 1]
    const specialSample = cse.id === 'CSE-07' && alertIndex === 4821
    const caseId = `CASE-${idPart(cse.id)}${String(caseIndex).padStart(3, '0')}`
    const createdAt = specialSample ? '2026-09-22T14:22:01.000Z' : plusMinutes(alert.timestamp, 1 + caseIndex % 18)
    const fastClose = specialSample || (cse.profile === 'execution-gap' && alert.severity === 'Critical' && caseIndex % 4 === 0)
    const closureMinutes = specialSample ? 4 : fastClose ? 4 + caseIndex % 5 : cse.profile === 'repetitive-workflow' ? 240 + caseIndex % 5 : cse.profile === 'slow-steady' ? 480 + caseIndex % 180 : 90 + caseIndex % 310
    const open = !specialSample && caseIndex % 17 === 0
    const remediationRequired = alert.severity === 'Critical' || alert.severity === 'High'
    const remediationMissing = cse.profile === 'remediation-gap' && remediationRequired && caseIndex % 5 !== 0
    return { case_id: caseId, cse_id: cse.id, alert_id: alert.alert_id, created_at: createdAt, assigned_at: plusMinutes(createdAt, 7 + caseIndex % 21), investigation_started_at: null, severity: alert.severity, status: open ? 'In progress' : 'Closed', closure_time: open ? null : specialSample ? '2026-09-22T14:25:17.000Z' : plusMinutes(createdAt, closureMinutes), closure_reason: cse.profile === 'repetitive-workflow' ? 'SLA-aligned closure' : open ? 'Pending review' : 'Analyst disposition recorded', root_cause: alert.severity === 'Critical' && caseIndex % 3 === 0 ? 'Cause recorded in case submission' : null, remediation_required: remediationRequired, remediation_status: remediationMissing ? 'Evidence missing' : remediationRequired ? 'Evidence recorded' : 'Not required', escalation_required: alert.severity === 'Critical', escalation_id: null }
  })
})

const casesFor = (cseId: string) => cases.filter((record) => record.cse_id === cseId)
const chooseIndexes = (length: number, count: number) => Array.from({ length: count }, (_, index) => Math.floor((index + 0.5) * length / count))

export const investigations: InvestigationRecord[] = cseSeeds.flatMap((cse) => {
  const rows = casesFor(cse.id)
  const selected = new Set<number>()
  if (cse.profile === 'execution-gap') {
    const weeklyRates = [0.61, 0.52, 0.38, 0.20, 0.14]
    const buckets = Array.from({ length: 5 }, () => [] as number[])
    rows.forEach((record, index) => buckets[Math.min(4, Math.floor((new Date(record.created_at).getUTCDate() - 1) / 7))].push(index))
    buckets.forEach((bucket, week) => chooseIndexes(bucket.length, Math.round(bucket.length * weeklyRates[week])).forEach((offset) => selected.add(bucket[offset])))
  } else {
    chooseIndexes(rows.length, cse.investigationCount).forEach((index) => selected.add(index))
  }
  const specialCase = rows.findIndex((record) => record.alert_id === 'ALT-074821')
  if (specialCase >= 0) { selected.delete([...selected].at(-1) ?? 0); selected.add(specialCase) }
  return [...selected].sort((a, b) => a - b).map((caseIndex, index) => {
    const record = rows[caseIndex]
    const sample = record.alert_id === 'ALT-074821'
    const template = cse.profile === 'repetitive-workflow'
    const evidence = sample ? 0 : template ? 2 : cse.profile === 'execution-gap' && caseIndex % 3 !== 0 ? 0 : cse.profile === 'evidence-inconsistency' && caseIndex % 3 === 0 ? 0 : 1 + caseIndex % 5
    const startedAt = plusMinutes(record.created_at, 20 + caseIndex % 70)
    record.investigation_started_at = startedAt
    return { investigation_id: `INV-${idPart(cse.id)}${String(index + 1).padStart(4, '0')}`, case_id: record.case_id, cse_id: cse.id, started_at: startedAt, completed_at: plusMinutes(record.created_at, 75 + caseIndex % 240), analyst_action_count: sample ? 1 : template ? 3 : cse.profile === 'execution-gap' ? 1 + caseIndex % 3 : 4 + caseIndex % 8, evidence_reference_count: evidence, finding_count: evidence > 0 ? 1 + caseIndex % 2 : 0, root_cause_identified: record.root_cause !== null && evidence > 0, remediation_evidence_present: record.remediation_required && record.remediation_status === 'Evidence recorded' && evidence > 0, investigation_type: template ? 'TEMPLATE_REVIEW' : 'Alert investigation', outcome: evidence === 0 ? 'Insufficient evidence recorded' : 'Disposition supported' }
  })
})

export const escalations: EscalationRecord[] = cseSeeds.flatMap((cse) => {
  const rows = casesFor(cse.id).filter((record) => record.alert_id !== 'ALT-074821')
  const selected = chooseIndexes(rows.length, cse.escalationCount)
  const weeklyTotals = Array.from({ length: 5 }, () => 0)
  selected.forEach((caseIndex) => {
    const week = Math.min(4, Math.floor((new Date(rows[caseIndex].created_at).getUTCDate() - 1) / 7))
    weeklyTotals[week]++
  })
  const weeklyCompleted = Array.from({ length: 5 }, () => 0)
  const completionTargets = [0.31, 0.24, 0.16, 0.1, 0.08]
  return selected.map((caseIndex, index) => {
    const record = rows[caseIndex]
    const week = Math.min(4, Math.floor((new Date(record.created_at).getUTCDate() - 1) / 7))
    const pending = cse.profile === 'execution-gap'
      ? weeklyCompleted[week]++ >= Math.round(weeklyTotals[week] * completionTargets[week])
      : false
    const escalationId = `ESC-${idPart(cse.id)}${String(index + 1).padStart(4, '0')}`
    record.escalation_id = escalationId
    const createdAt = plusMinutes(record.created_at, 35 + index % 120)
    return { escalation_id: escalationId, case_id: record.case_id, cse_id: cse.id, escalation_type: record.severity === 'Critical' ? 'Critical incident' : 'Operational escalation', reason: record.severity === 'Critical' ? 'Critical-severity case' : 'Case threshold met', required: record.escalation_required, created_at: createdAt, acknowledged_at: pending ? null : plusMinutes(createdAt, 20), completed_at: pending ? null : plusMinutes(record.created_at, 180 + index % 360), destination: record.severity === 'Critical' ? 'CSE incident lead' : 'CSE security function', status: pending ? 'Pending response' : 'Completed' }
  })
})

const caseByAlert = new Map(cases.map((record) => [record.alert_id, record]))
export const alerts: AlertRecord[] = cseSeeds.flatMap((cse) => (alertBases.get(cse.id) ?? []).map((record) => {
  const relatedCase = caseByAlert.get(record.alert_id)
  const closedAt = relatedCase?.closure_time ?? null
  const escalationRequired = relatedCase?.escalation_required ?? record.severity === 'Critical'
  return { ...record, detected_at: record.timestamp, source: 'Synthetic rule correlation', acknowledged_at: record.acknowledgement_time, sla_due_at: plusMinutes(record.timestamp, record.severity === 'Critical' ? 60 : record.severity === 'High' ? 180 : 480), case_id: relatedCase?.case_id ?? null, linked_case_id: relatedCase?.case_id ?? null, status: relatedCase ? 'Case created' : 'Acknowledged', disposition: relatedCase?.status === 'Closed' ? 'Closed' : relatedCase ? 'Under investigation' : 'No case created', closed_at: closedAt, closure_reason: relatedCase?.closure_time ? relatedCase.closure_reason : null, escalation_required: escalationRequired, escalated: Boolean(relatedCase?.escalation_id) }
}))

export const period = { start: '01 Sep 2026', end: '30 Sep 2026', id: 'SAT-SA-2026-10-001' }
export const sourceCounts = [
  { name: 'Alert Metadata', accepted: alerts.length, quarantined: 29, sourceField: 'src_alert_timestamp', canonicalField: 'event_time' },
  { name: 'Case Management', accepted: cases.length, quarantined: 0, sourceField: 'src_case_ref', canonicalField: 'case_id' },
  { name: 'Investigation Workflow', accepted: investigations.length, quarantined: 8, sourceField: 'src_action_total', canonicalField: 'analyst_action_count' },
  { name: 'Escalation / Closure Records', accepted: escalations.length, quarantined: 0, sourceField: 'src_entity', canonicalField: 'cse_id' },
]
export const acceptedRecordCount = sourceCounts.reduce((total, source) => total + source.accepted, 0)
export const quarantinedRecordCount = sourceCounts.reduce((total, source) => total + source.quarantined, 0)
export const submissions = entities.map((entity, index) => {
  const recordCounts = {
    alerts: alerts.filter((record) => record.cse_id === entity.id).length,
    cases: cases.filter((record) => record.cse_id === entity.id).length,
    investigations: investigations.filter((record) => record.cse_id === entity.id).length,
    escalations: escalations.filter((record) => record.cse_id === entity.id).length,
    assets: assets.filter((record) => record.cse_id === entity.id).length,
  }
  return {
    submission_id: `SUB-${idPart(entity.id)}-20261001`,
    cse_id: entity.id,
    assessment_period: `${period.start} — ${period.end}`,
    received_at: `2026-10-01T09:${String(14 + index).padStart(2, '0')}:00.000Z`,
    schema_version: 'SOC-SUBMISSION-1.2',
    source_files: ['alert_metadata.csv', 'case_management.csv', 'investigation_workflow.csv', 'escalation_closure.csv', 'asset_inventory.csv'],
    record_counts: recordCounts,
    accepted_records: recordCounts.alerts + recordCounts.cases + recordCounts.investigations + recordCounts.escalations,
    quarantined_records: index === 6 ? 37 : 0,
    validation_status: index === 6 || index === 8 ? 'Passed with warnings' : 'Passed',
    data_quality_flags: index === 6 ? ['Duplicate IDs', 'Timestamp format', 'Orphan references'] : index === 8 ? ['Missing optional classification'] : [],
  }
})
export const quarantinedRecords = [
  { code: 'WARN-014', issue: 'Missing optional asset classification', records: 9, disposition: 'Non-blocking' },
  { code: 'ERR-002', issue: 'Malformed alert timestamps', records: 6, disposition: 'Quarantined' },
  { code: 'DUP-005', issue: 'Duplicate alert identifiers', records: 23, disposition: 'Quarantined' },
  { code: 'ERR-003', issue: 'Unknown case_id reference', records: 8, disposition: 'Quarantined' },
]
export const syntheticTruth = { injectedPatterns: 6, executionGapCases: 1, negativeSpaceCases: 1, otherCases: 4 }
export const alertById = new Map(alerts.map((record) => [record.alert_id, record]))
export const caseById = new Map(cases.map((record) => [record.case_id, record]))
export const investigationByCase = new Map(investigations.map((record) => [record.case_id, record]))
export const escalationByCase = new Map(escalations.map((record) => [record.case_id, record]))
export const assetById = new Map(assets.map((record) => [record.asset_id, record]))