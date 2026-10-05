import {
  alertById, alerts, assets, caseById, cases, entities, escalations, escalationByCase,
  investigationByCase, investigations, syntheticTruth, type CaseRecord,
} from './data'

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
export type FindingType = 'Execution gap' | 'Negative space' | 'Anomaly / outlier' | 'Operational discipline' | 'Investigation evidence gap' | 'Remediation evidence gap'
export type Capability = 'Threat Detection' | 'Investigation' | 'Escalation' | 'Incident Response' | 'Security Operations' | 'Governance & Oversight' | 'Operational Discipline' | 'Cyber Resilience'

export type EntityMetrics = {
  cseId: string; alerts: number; alertCount: number; caseCount: number; investigationCount: number; escalationCount: number
  caseConversion: number; investigationRate: number; escalationCompletion: number; responseMinutes: number
  closureMinutes: number; fastCriticalRate: number; criticalNoEscalationRate: number; evidenceGapRate: number
  repeatedInvestigationRate: number; slaClosureRate: number; telemetryCoverage: number; remediationGapRate: number; remediationInvestigationGapRate: number; missingCategories: string[]
}

export type Finding = {
  id: string; assessmentId: string; cseId: string; type: FindingType; capability: Capability; priority: Priority
  title: string; rationale: string; indicators: string[]; baseline: string; method: string; sampleCount: number
  sourceDataset: string; sourceRecordIds: string[]; generatedAt: string; status: string
}

export type ReviewSample = {
  id: string; cseId: string; recordId: string; type: 'Alert' | 'Case' | 'Investigation'; severity: string
  reason: string; findingId: string; alertId: string; caseId: string; investigationId?: string
}

export const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const minutesBetween = (start: string, end: string) => (new Date(end).getTime() - new Date(start).getTime()) / 60_000
const requiredCategories = ['Malware', 'Credential Abuse', 'Lateral Movement', 'Web Exploit']

export const metricsByCse = new Map(entities.map((entity) => {
  const ownAlerts = alerts.filter((record) => record.cse_id === entity.id)
  const ownCases = cases.filter((record) => record.cse_id === entity.id)
  const ownInvestigations = investigations.filter((record) => record.cse_id === entity.id)
  const ownEscalations = escalations.filter((record) => record.cse_id === entity.id)
  const criticalCases = ownCases.filter((record) => record.severity === 'Critical' && record.closure_time)
  const remediationCases = ownCases.filter((record) => record.remediation_required)
  const remediationInvestigations = ownInvestigations.filter((record) => caseById.get(record.case_id)?.remediation_required)
  const fastCritical = criticalCases.filter((record) => minutesBetween(record.created_at, record.closure_time!) < 10)
  const closedCases = ownCases.filter((record) => record.closure_time)
  const observedCategories = new Set(ownAlerts.map((record) => record.category))
  const ownAssets = assets.filter((record) => record.cse_id === entity.id && record.monitoring_expected)
  const response = ownAlerts.map((record) => minutesBetween(record.timestamp, record.acknowledgement_time))
  const metric: EntityMetrics = {
    cseId: entity.id,
    alerts: ownAlerts.length,
    alertCount: ownAlerts.length,
    caseCount: ownCases.length,
    investigationCount: ownInvestigations.length,
    escalationCount: ownEscalations.length,
    caseConversion: ownCases.length / Math.max(ownAlerts.length, 1),
    investigationRate: ownInvestigations.length / Math.max(ownCases.length, 1),
    escalationCompletion: ownEscalations.filter((record) => record.status === 'Completed').length / Math.max(ownEscalations.length, 1),
    responseMinutes: response.reduce((sum, value) => sum + value, 0) / Math.max(response.length, 1),
    closureMinutes: closedCases.reduce((sum, record) => sum + minutesBetween(record.created_at, record.closure_time!), 0) / Math.max(closedCases.length, 1),
    fastCriticalRate: fastCritical.length / Math.max(criticalCases.length, 1),
    criticalNoEscalationRate: criticalCases.filter((record) => !record.escalation_id).length / Math.max(criticalCases.length, 1),
    evidenceGapRate: ownInvestigations.filter((record) => record.evidence_reference_count === 0).length / Math.max(ownInvestigations.length, 1),
    repeatedInvestigationRate: ownInvestigations.filter((record) => record.investigation_type === 'TEMPLATE_REVIEW').length / Math.max(ownInvestigations.length, 1),
    slaClosureRate: closedCases.filter((record) => {
      const duration = minutesBetween(record.created_at, record.closure_time!)
      return duration >= 230 && duration <= 270
    }).length / Math.max(closedCases.length, 1),
    telemetryCoverage: ownAssets.filter((record) => record.monitoring_observed).length / Math.max(ownAssets.length, 1),
    remediationGapRate: remediationCases.filter((record) => record.remediation_status === 'Evidence missing').length / Math.max(remediationCases.length, 1),
    remediationInvestigationGapRate: remediationInvestigations.filter((record) => !record.remediation_evidence_present).length / Math.max(remediationInvestigations.length, 1),
    missingCategories: requiredCategories.filter((category) => !observedCategories.has(category)),
  }
  return [entity.id, metric] as const
}))

const allMetrics = [...metricsByCse.values()]
const peerMedian = (cseId: string, selector: (metric: EntityMetrics) => number) => median(allMetrics.filter((metric) => metric.cseId !== cseId).map(selector))
const capabilityFor: Record<FindingType, Capability> = {
  'Execution gap': 'Investigation',
  'Negative space': 'Security Operations',
  'Anomaly / outlier': 'Incident Response',
  'Operational discipline': 'Operational Discipline',
  'Investigation evidence gap': 'Investigation',
  'Remediation evidence gap': 'Cyber Resilience',
}

const findingDrafts: Omit<Finding, 'id' | 'assessmentId' | 'generatedAt' | 'status'>[] = []
for (const metric of allMetrics) {
  const ownCases = cases.filter((record) => record.cse_id === metric.cseId)
  const criticalFast = metric.fastCriticalRate > 0.15
  const criticalNoEscalation = metric.criticalNoEscalationRate > 0.55
  const weakEvidence = metric.evidenceGapRate > 0.5
  if (Number(criticalFast) + Number(criticalNoEscalation) + Number(weakEvidence) >= 2) {
    const indicators = [
      criticalFast && `${Math.round(metric.fastCriticalRate * 100)}% of critical closures completed in under 10 minutes`,
      criticalNoEscalation && `${Math.round(metric.criticalNoEscalationRate * 100)}% of critical cases have no escalation record`,
      weakEvidence && `${Math.round(metric.evidenceGapRate * 100)}% of investigations have no evidence reference`,
    ].filter((value): value is string => Boolean(value))
    const related = ownCases.find((record) => record.alert_id === 'ALT-074821') ?? ownCases.find((record) => record.severity === 'Critical')
    findingDrafts.push({ cseId: metric.cseId, type: 'Execution gap', capability: capabilityFor['Execution gap'], priority: 'HIGH', title: 'Corroborating indicators of an execution gap', rationale: 'Multiple critical-alert handling indicators differ from peer practice. This is a review lead, not a finding of failure.', indicators, baseline: `Peer median critical fast-close rate ${Math.round(peerMedian(metric.cseId, (item) => item.fastCriticalRate) * 100)}%; critical cases without escalation ${Math.round(peerMedian(metric.cseId, (item) => item.criticalNoEscalationRate) * 100)}%`, method: 'EG-03: at least two of fast critical closure (>15%), critical case without escalation (>55%), and investigation evidence gap (>50%).', sampleCount: Math.max(12, indicators.length * 4), sourceDataset: 'Alert Metadata + Investigation Workflow + Escalation / Closure Records', sourceRecordIds: related ? [related.alert_id, related.case_id, ...(related.escalation_id ? [related.escalation_id] : [])] : [] })
  }

  const invPeer = peerMedian(metric.cseId, (item) => item.investigationRate)
  const coveragePeer = peerMedian(metric.cseId, (item) => item.telemetryCoverage)
  const escalationPeer = peerMedian(metric.cseId, (item) => item.escalationCompletion)
  const negativeConditions = [metric.investigationRate < invPeer * 0.55, metric.telemetryCoverage < coveragePeer - 0.15, metric.missingCategories.length >= 2, metric.escalationCompletion < escalationPeer * 0.35]
  if (Number(negativeConditions[0]) + Number(negativeConditions[1]) + Number(negativeConditions[2]) + Number(negativeConditions[3]) >= 2 && (negativeConditions[1] || negativeConditions[2])) {
    const entityAssets = assets.filter((record) => record.cse_id === metric.cseId && record.monitoring_expected)
    const missingAssets = entityAssets.filter((record) => !record.monitoring_observed).length
    const indicators = [
      negativeConditions[0] && `Investigation completion ${Math.round(metric.investigationRate * 100)}% vs ${Math.round(invPeer * 100)}% peer median`,
      negativeConditions[1] && `Monitoring observed on ${Math.round(metric.telemetryCoverage * 100)}% of expected assets`,
      negativeConditions[2] && `Expected categories absent: ${metric.missingCategories.join(', ')}`,
      negativeConditions[3] && `Escalation completion ${Math.round(metric.escalationCompletion * 100)}% vs ${Math.round(escalationPeer * 100)}% peers`,
    ].filter((value): value is string => Boolean(value))
    const missingCase = ownCases.find((record) => !investigationByCase.has(record.case_id))
    findingDrafts.push({ cseId: metric.cseId, type: 'Negative space', capability: capabilityFor['Negative space'], priority: 'HIGH', title: 'Expected operational evidence is materially absent', rationale: 'Several expected monitoring or workflow signals are below the peer baseline; absence may indicate a coverage or submission gap.', indicators: [...indicators, `${missingAssets} of ${entityAssets.length} expected monitored assets have no observed telemetry`], baseline: `Expected investigation rate ${Math.round(invPeer * 100)}%; expected asset monitoring ${Math.round(coveragePeer * 100)}%`, method: 'NS-02: require at least two material peer deviations, including direct asset-coverage or expected-category absence.', sampleCount: Math.max(8, indicators.length * 2), sourceDataset: 'Alert Metadata + Case Management + Investigation Workflow + Asset Inventory', sourceRecordIds: missingCase ? [missingCase.alert_id, missingCase.case_id] : [] })
  }

  const responseValues = allMetrics.filter((item) => item.cseId !== metric.cseId).map((item) => item.responseMinutes)
  const responseMedian = median(responseValues)
  const mad = median(responseValues.map((value) => Math.abs(value - responseMedian)))
  const modifiedZ = mad ? 0.6745 * (metric.responseMinutes - responseMedian) / mad : 0
  if (modifiedZ > 3.5 && metric.responseMinutes > responseMedian * 2) {
    const sample = alerts.filter((record) => record.cse_id === metric.cseId).sort((a, b) => minutesBetween(b.timestamp, b.acknowledgement_time) - minutesBetween(a.timestamp, a.acknowledgement_time))[0]
    findingDrafts.push({ cseId: metric.cseId, type: 'Anomaly / outlier', capability: capabilityFor['Anomaly / outlier'], priority: 'HIGH', title: 'Acknowledgement time is a peer outlier', rationale: 'Mean acknowledgement time is substantially above comparable entities in the same submission period.', indicators: [`Observed mean ${Math.round(metric.responseMinutes)} min`, `Peer median ${Math.round(responseMedian)} min`, `Modified z-score ${modifiedZ.toFixed(1)} (threshold 3.5)`], baseline: `${Math.round(responseMedian)} min peer median; MAD ${Math.round(mad)} min`, method: 'AN-01: modified z-score = 0.6745 × (entity mean − peer median) / MAD; require z > 3.5 and mean > 2× peer median to guard near-zero MAD.', sampleCount: 6, sourceDataset: 'Alert Metadata', sourceRecordIds: sample ? [sample.alert_id] : [] })
  }

  if (metric.repeatedInvestigationRate > 0.65 && metric.slaClosureRate > 0.7) {
    const sample = investigations.find((record) => record.cse_id === metric.cseId && record.investigation_type === 'TEMPLATE_REVIEW')
    findingDrafts.push({ cseId: metric.cseId, type: 'Operational discipline', capability: capabilityFor['Operational discipline'], priority: 'MEDIUM', title: 'Repetitive investigation and closure pattern', rationale: 'Investigations reuse a template type and closures cluster around a narrow duration band. Examine whether the records reflect substantive work.', indicators: [`${Math.round(metric.repeatedInvestigationRate * 100)}% template investigation type`, `${Math.round(metric.slaClosureRate * 100)}% closed in a 40-minute band around four hours`, `${metric.investigationCount} investigation records in the period`], baseline: `Peer median template use ${Math.round(peerMedian(metric.cseId, (item) => item.repeatedInvestigationRate) * 100)}%`, method: 'OD-04: template investigation share >65% and 4-hour closure-band concentration >70%.', sampleCount: 5, sourceDataset: 'Investigation Workflow + Case Management', sourceRecordIds: sample ? [sample.investigation_id, sample.case_id] : [] })
  }

  if (metric.remediationGapRate > 0.55 && metric.remediationInvestigationGapRate > 0.45) {
    const sampleCase = ownCases.find((record) => record.remediation_status === 'Evidence missing' && investigationByCase.has(record.case_id))
    const sampleInvestigation = sampleCase ? investigationByCase.get(sampleCase.case_id) : undefined
    findingDrafts.push({ cseId: metric.cseId, type: 'Remediation evidence gap', capability: 'Cyber Resilience', priority: 'MEDIUM', title: 'Required remediation lacks supporting evidence', rationale: 'Multiple cases marked remediation-required lack evidence that remediation was completed; linked investigation records also lack remediation references.', indicators: [`${Math.round(metric.remediationGapRate * 100)}% of remediation-required cases have no remediation evidence`, `${Math.round(metric.remediationInvestigationGapRate * 100)}% of linked investigations lack remediation evidence`, `${metric.caseCount} cases assessed in the submission`], baseline: `Remediation-evidence expectation: evidence present when remediation is required`, method: 'CR-02: flag when >55% of remediation-required cases lack evidence and >45% of their investigations also lack a remediation reference.', sampleCount: 6, sourceDataset: 'Case Management + Investigation Workflow', sourceRecordIds: sampleCase ? [sampleCase.case_id, ...(sampleInvestigation ? [sampleInvestigation.investigation_id] : [])] : [] })
  }

  const evidencePeer = peerMedian(metric.cseId, (item) => item.evidenceGapRate)
  if (metric.evidenceGapRate > Math.max(0.25, evidencePeer + 0.18) && metric.investigationRate > invPeer * 0.75 && !findingDrafts.some((finding) => finding.cseId === metric.cseId && finding.type === 'Execution gap')) {
    const sample = investigations.find((record) => record.cse_id === metric.cseId && record.evidence_reference_count === 0)
    findingDrafts.push({ cseId: metric.cseId, type: 'Investigation evidence gap', capability: 'Investigation', priority: 'MEDIUM', title: 'Investigation evidence references below peers', rationale: 'Investigation activity is present, but a higher-than-peer share of records has no evidence reference.', indicators: [`${Math.round(metric.evidenceGapRate * 100)}% of investigations have no evidence reference`, `${Math.round(metric.investigationRate * 100)}% investigation completion`, `${metric.investigationCount} investigations sampled in the submission`], baseline: `Peer median evidence gap ${Math.round(evidencePeer * 100)}%`, method: 'IV-05: evidence gap exceeds peer median by 18 percentage points while investigation activity remains present.', sampleCount: 5, sourceDataset: 'Investigation Workflow', sourceRecordIds: sample ? [sample.investigation_id, sample.case_id] : [] })
  }
}

const priorityOrder: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
export const findings: Finding[] = findingDrafts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).map((finding, index) => ({ ...finding, id: `FND-2026-${String(47 + index).padStart(4, '0')}`, assessmentId: 'SAT-SA-2026-10-001', generatedAt: '2026-10-05T12:00:00.000Z', status: 'Pending human review' }))

const queue: ReviewSample[] = []
const addSample = (record: CaseRecord | undefined, finding: Finding | undefined, reason: string, forcedAlertId?: string, requestedType?: ReviewSample['type']) => {
  if (!record || !finding || queue.some((item) => item.caseId === record.case_id)) return
  const alertId = forcedAlertId ?? record.alert_id
  const alert = alertById.get(alertId) ?? alertById.get(record.alert_id)
  const investigation = investigationByCase.get(record.case_id)
  const type = forcedAlertId ? 'Alert' : requestedType ?? (investigation ? 'Investigation' : 'Alert')
  const recordId = type === 'Case' ? record.case_id : type === 'Alert' ? alert?.alert_id ?? record.alert_id : investigation?.investigation_id ?? record.case_id
  queue.push({ id: `RQ-${String(queue.length + 1).padStart(3, '0')}`, cseId: record.cse_id, recordId, type, severity: record.severity, reason, findingId: finding.id, alertId: alert?.alert_id ?? record.alert_id, caseId: record.case_id, investigationId: investigation?.investigation_id })
}

const executionFinding = findings.find((finding) => finding.type === 'Execution gap')
if (executionFinding) {
  const selectedAlert = alertById.get('ALT-074821')
  const selectedCase = selectedAlert?.case_id ? caseById.get(selectedAlert.case_id) : undefined
  addSample(selectedCase, executionFinding, 'Critical alert; closed four minutes after acknowledgement; no escalation; one action and no evidence references.', selectedAlert?.alert_id)
  const repeated = cases.find((record) => record.cse_id === executionFinding.cseId && record.alert_id !== selectedAlert?.alert_id && alertById.get(record.alert_id)?.asset_id === selectedAlert?.asset_id)
  addSample(repeated, executionFinding, 'Repeated alert on the same asset; inspect closure and remediation evidence.')
  cases.filter((record) => record.cse_id === executionFinding.cseId && record.severity === 'Critical').slice(0, 3).forEach((record) => addSample(record, executionFinding, 'Critical case with a fast closure and limited investigation evidence.'))
}
const negativeFinding = findings.find((finding) => finding.type === 'Negative space')
if (negativeFinding) cases.filter((record) => record.cse_id === negativeFinding.cseId && !investigationByCase.has(record.case_id)).slice(0, 3).forEach((record) => addSample(record, negativeFinding, 'Case present; expected investigation record is absent.', undefined, 'Case'))
const anomalyFinding = findings.find((finding) => finding.type === 'Anomaly / outlier')
if (anomalyFinding) {
  const sample = cases.filter((record) => record.cse_id === anomalyFinding.cseId).sort((a, b) => minutesBetween(alertById.get(b.alert_id)!.timestamp, alertById.get(b.alert_id)!.acknowledgement_time) - minutesBetween(alertById.get(a.alert_id)!.timestamp, alertById.get(a.alert_id)!.acknowledgement_time))[0]
  addSample(sample, anomalyFinding, 'Alert acknowledgement time is materially above the peer distribution.')
}
const disciplineFinding = findings.find((finding) => finding.type === 'Operational discipline')
if (disciplineFinding) investigations.filter((record) => record.cse_id === disciplineFinding.cseId).slice(0, 3).forEach((investigation) => addSample(caseById.get(investigation.case_id), disciplineFinding, 'Template-style investigation; compare actions and evidence references.'))
const evidenceFinding = findings.find((finding) => finding.type === 'Investigation evidence gap')
if (evidenceFinding) investigations.filter((record) => record.cse_id === evidenceFinding.cseId && record.evidence_reference_count === 0).slice(0, 3).forEach((investigation) => addSample(caseById.get(investigation.case_id), evidenceFinding, 'Investigation has no evidence references; inspect source record.'))
const remediationFinding = findings.find((finding) => finding.type === 'Remediation evidence gap')
if (remediationFinding) investigations.filter((record) => record.cse_id === remediationFinding.cseId && !record.remediation_evidence_present).slice(0, 3).forEach((investigation) => addSample(caseById.get(investigation.case_id), remediationFinding, 'Remediation is required for this case; the linked investigation has no remediation evidence.'))
export const reviewQueue = queue

export const entityTrend = (cseId: string) => Array.from({ length: 5 }, (_, week) => {
  const weekCases = cases.filter((record) => record.cse_id === cseId && Math.min(4, Math.floor((new Date(record.created_at).getUTCDate() - 1) / 7)) === week)
  const weekAlerts = alerts.filter((record) => record.cse_id === cseId && Math.min(4, Math.floor((new Date(record.timestamp).getUTCDate() - 1) / 7)) === week)
  const closed = weekCases.filter((record) => record.closure_time)
  const completed = weekCases.filter((record) => investigationByCase.has(record.case_id)).length
  const weekEscalations = weekCases.filter((record) => record.escalation_id)
  const escalated = weekEscalations.filter((record) => escalationByCase.get(record.case_id)?.status === 'Completed').length
  const endDay = [7, 14, 21, 28, 30][week]
  const assetsForCse = assets.filter((record) => record.cse_id === cseId && record.monitoring_expected)
  const observedByEnd = assetsForCse.filter((record) => record.telemetry_last_seen && new Date(record.telemetry_last_seen).getUTCDate() <= endDay).length
  return {
    label: week < 4 ? `Week ${week + 1}` : 'Final 2 days',
    investigationRate: completed / Math.max(weekCases.length, 1),
    escalationRate: escalated / Math.max(weekEscalations.length, 1),
    acknowledgementMinutes: weekAlerts.reduce((sum, record) => sum + minutesBetween(record.timestamp, record.acknowledgement_time), 0) / Math.max(weekAlerts.length, 1),
    closureMinutes: closed.reduce((sum, record) => sum + minutesBetween(record.created_at, record.closure_time!), 0) / Math.max(closed.length, 1),
    telemetryCoverage: observedByEnd / Math.max(assetsForCse.length, 1),
    cases: weekCases.length,
  }
})

export const capabilityAreas: Capability[] = ['Threat Detection', 'Investigation', 'Escalation', 'Incident Response', 'Security Operations', 'Governance & Oversight', 'Operational Discipline', 'Cyber Resilience']

export const capabilityStatus = (cseId: string, capability: Capability) => {
  const linked = findings.filter((finding) => finding.cseId === cseId && (finding.capability === capability || (finding.type === 'Execution gap' && ['Escalation', 'Operational Discipline'].includes(capability)) || (finding.type === 'Negative space' && ['Threat Detection', 'Cyber Resilience'].includes(capability))))
  if (linked.length) return 'Potential weakness detected'
  if (capability === 'Governance & Oversight') return 'Insufficient evidence in submission'
  const metric = metricsByCse.get(cseId)
  const hasEvidence = metric && ({
    'Threat Detection': metric.alertCount > 0,
    Investigation: metric.investigationCount > 0,
    Escalation: metric.escalationCount > 0,
    'Incident Response': metric.caseCount > 0,
    'Security Operations': metric.alertCount > 0 && metric.caseCount > 0,
    'Operational Discipline': metric.investigationCount > 0,
    'Cyber Resilience': assets.some((asset) => asset.cse_id === cseId),
    'Governance & Oversight': false,
  }[capability])
  return hasEvidence ? 'Evidence present; no material signal' : 'Insufficient evidence in submission'
}

export const peerRange = (selector: (metric: EntityMetrics) => number, excludedValue?: number) => {
  const values = allMetrics.map(selector)
  if (excludedValue !== undefined) {
    const index = values.indexOf(excludedValue)
    if (index >= 0) values.splice(index, 1)
  }
  return { median: median(values), min: Math.min(...values), max: Math.max(...values) }
}

const scenarioChecks = [
  findings.some((finding) => finding.type === 'Execution gap'),
  findings.some((finding) => finding.type === 'Negative space'),
  findings.some((finding) => finding.type === 'Anomaly / outlier'),
  findings.some((finding) => finding.type === 'Investigation evidence gap'),
  findings.some((finding) => finding.type === 'Operational discipline'),
  findings.some((finding) => finding.type === 'Remediation evidence gap'),
]
export const syntheticValidation = {
  injected: syntheticTruth.injectedPatterns,
  rediscovered: scenarioChecks.filter(Boolean).length,
  notRediscovered: syntheticTruth.injectedPatterns - scenarioChecks.filter(Boolean).length,
  executionGap: scenarioChecks[0],
  negativeSpace: scenarioChecks[1],
  anomaly: scenarioChecks[2],
  investigationEvidenceGap: scenarioChecks[3],
  operationalDiscipline: scenarioChecks[4],
  remediationEvidenceGap: scenarioChecks[5],
  healthyHighVolumeNotFlagged: !findings.some((finding) => finding.cseId === 'CSE-03'),
}

export const detailForFinding = (finding: Finding) => finding.sourceRecordIds.map((recordId) => alertById.get(recordId) ?? caseById.get(recordId) ?? investigations.find((record) => record.investigation_id === recordId)).filter(Boolean)