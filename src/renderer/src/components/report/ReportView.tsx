import { Check } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui'
import { cn } from '../../lib/cn'
import { SCORE_DIMENSION_LABELS } from '@shared/constants'
import type { DesignReport, ScoreDimensionId } from '@shared/schemas'

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-3 text-sm text-ink">{children}</div>
    </Card>
  )
}

function Chips({ values }: { values: string[] }): React.JSX.Element {
  if (values.length === 0) return <p className="text-xs text-ink-faint">Non renseigné par le modèle.</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className="rounded-md bg-panel-2 px-2 py-1 text-xs text-ink-dim">
          {value}
        </span>
      ))}
    </div>
  )
}

function Bullets({ values }: { values: string[] }): React.JSX.Element | null {
  if (values.length === 0) return null
  return (
    <ul className="space-y-1">
      {values.map((value) => (
        <li key={value} className="flex gap-2 text-xs text-ink-dim">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
          {value}
        </li>
      ))}
    </ul>
  )
}

function Kv({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <div className="mt-0.5 text-xs text-ink-dim">{children}</div>
    </div>
  )
}

export function ReportView({
  report,
  selectedIds,
  onToggleRecommendation
}: {
  report: DesignReport
  selectedIds: string[]
  onToggleRecommendation: (id: string) => void
}): React.JSX.Element {
  const { felicityIndex } = report
  return (
    <div className="space-y-5">
      <Section title="Synthèse" subtitle="Ce que le modèle a compris (sans jamais promettre de vente)">
        <p className="text-sm text-ink">{report.productSummary}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">
            Catégorie : {report.productCategory.label} · confiance {Math.round(report.productCategory.confidence * 100)} %
          </Badge>
          <Badge tone="neutral">Confiance globale : {Math.round(report.confidence * 100)} %</Badge>
        </div>
        <Kv label="Éléments visibles">
          <Chips values={report.detectedFeatures.visible} />
        </Kv>
        <Kv label="Éléments inférés">
          <Chips values={report.detectedFeatures.inferred} />
        </Kv>
        <Kv label="Style"> {report.detectedFeatures.style ? <p>{report.detectedFeatures.style}</p> : null}</Kv>
        <Kv label="Couleurs">
          <Chips values={report.detectedFeatures.colors} />
        </Kv>
        <Kv label="Matériaux">
          <Chips values={report.detectedFeatures.materials} />
        </Kv>
        <Kv label="Complexité perçue"> {report.detectedFeatures.complexity}</Kv>
        {report.assumptions.length > 0 ? (
          <Kv label="Hypothèses du modèle">
            <Bullets values={report.assumptions} />
          </Kv>
        ) : null}
        {report.limitations.length > 0 ? (
          <Kv label="Limites de l’analyse">
            <Bullets values={report.limitations} />
          </Kv>
        ) : null}
      </Section>

      <Section
        title="Indice Félicité"
        subtitle={
          felicityIndex.value === null
            ? 'Non calculable automatiquement.'
            : `Pondération : ${felicityIndex.weightProfile}`
        }
      >
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-accent bg-accent/10 text-3xl font-bold text-accent">
            {felicityIndex.value === null ? '—' : felicityIndex.value}
          </div>
          <div className="text-xs text-ink-dim">
            <p>Heuristique interne pondérant 10 dimensions de conception.</p>
            <p className="mt-1">
              Elle n’est ni une mesure psychologique, ni une promesse de vente, ni un test A/B : c’est un indicateur de cohérence
              visuelle à interpréter avec prudence.
            </p>
            {felicityIndex.notEvaluableDimensions.length > 0 ? (
              <p className="mt-1 text-warn">
                Dimensions non évaluables : {felicityIndex.notEvaluableDimensions.join(', ')}.
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Scores par dimension" subtitle="Chaque score est justifié ; un score à 0 % n’est pas un verdict définitif.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {report.scores.map((score) => {
            const id = score.dimension as ScoreDimensionId
            return (
              <div key={score.dimension} className="rounded-lg border border-line bg-panel-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{SCORE_DIMENSION_LABELS[id] ?? score.dimension}</span>
                  <span className={cn('text-lg font-bold', score.value === null ? 'text-ink-faint' : score.value >= 60 ? 'text-ok' : score.value >= 35 ? 'text-warn' : 'text-danger')}>
                    {score.value === null ? '—' : `${score.value} / 100`}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className={cn('h-full rounded-full', score.value === null ? 'bg-line' : score.value >= 60 ? 'bg-ok' : score.value >= 35 ? 'bg-warn' : 'bg-danger')}
                      style={{ width: `${score.value ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-ink-faint">confiance {Math.round(score.confidence * 100)} %</span>
                </div>
                <p className="mt-2 text-xs text-ink-dim">{score.justification}</p>
                {score.heuristicNote ? <p className="mt-1 text-[11px] text-accent">Contrôle heuristique : {score.heuristicNote}</p> : null}
                {score.evidence.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Observations</p>
                    <Bullets values={score.evidence} />
                  </div>
                ) : null}
                {score.improvements.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Pistes d’amélioration</p>
                    <Bullets values={score.improvements} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Point de félicité" subtitle="L’équilibre visuel à viser (pas un « gagnant garanti »)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Kv label="Élément focal recommandé">{report.felicityPoint.recommendedFocalElement}</Kv>
          <Kv label="Placement">{report.felicityPoint.placement}</Kv>
          <Kv label="Taille relative">{report.felicityPoint.relativeSize}</Kv>
          <Kv label="Couleur / finition / matière">{report.felicityPoint.colorFinishTexture}</Kv>
        </div>
        <Kv label="Éléments à conserver">
          <Chips values={report.felicityPoint.elementsToKeep} />
        </Kv>
        <Kv label="Éléments à réduire ou retirer">
          <Chips values={report.felicityPoint.elementsToReduceOrRemove} />
        </Kv>
        <Kv label="Contraste à renforcer">{report.felicityPoint.contrastToStrengthen}</Kv>
        <Kv label="Guidance sur la complexité">{report.felicityPoint.complexityGuidance}</Kv>
        <Kv label="Émotion / valeur visée">{report.felicityPoint.primaryEmotionOrValue}</Kv>
        <Kv label="Compromis expliqués">{report.felicityPoint.compromiseExplanation}</Kv>
      </Section>

      <Section title="Attention & émotions" subtitle="Hypothèses non mesurées, à confirmer sur le terrain">
        <Kv label="Points focaux">
          <Chips values={report.attentionAnalysis.focalPoints} />
        </Kv>
        <Kv label="Parcours visuel hypothétique">{report.attentionAnalysis.visualPathHypothesis}</Kv>
        <Kv label="Éléments concurrents">
          <Chips values={report.attentionAnalysis.competingElements} />
        </Kv>
        <Kv label="Zones de confusion">
          <Chips values={report.attentionAnalysis.confusionZones} />
        </Kv>
        <Kv label="Constats">
          <Bullets values={report.attentionAnalysis.findings} />
        </Kv>
        {report.emotionalHypotheses.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Hypothèses émotionnelles</p>
            {report.emotionalHypotheses.map((h, i) => (
              <p key={i} className="mb-1 text-xs text-ink-dim">
                <strong className="text-ink">{h.emotion}</strong> : {h.hypothesis}
              </p>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="Valeur perçue & frictions commerciales" subtitle="Sans garantie de résultat">
        <Kv label="Valeur perçue">{report.perceivedValueAnalysis.summary}</Kv>
        <Kv label="Éléments qui valorisent">
          <Bullets values={report.perceivedValueAnalysis.valueIncreasers} />
        </Kv>
        <Kv label="Éléments qui dévalorisent">
          <Bullets values={report.perceivedValueAnalysis.valueReducers} />
        </Kv>
        <Kv label="Informations manquantes">
          <Bullets values={report.perceivedValueAnalysis.unknownInformation} />
        </Kv>
        <Kv label="Frictions commerciales">{report.commercialFriction.summary}</Kv>
        <Kv label="Visibilité du bénéfice">{report.commercialFriction.benefitVisibility}</Kv>
        <Kv label="Clarté des raisons d’achat">{report.commercialFriction.purchaseReasonsClarity}</Kv>
        <Kv label="Différenciation">{report.commercialFriction.differentiation}</Kv>
        <Kv label="Rassurance">
          <Bullets values={report.commercialFriction.reassuranceElements} />
        </Kv>
        <Kv label="Points de friction">
          <Bullets values={report.commercialFriction.frictionPoints} />
        </Kv>
      </Section>

      <Section title="Brief de redesign" subtitle="Directives pour rester fidèle à l’esprit du produit">
        <Kv label="Direction artistique">{report.redesignBrief.artDirection}</Kv>
        <Kv label="Formes à modifier">
          <Chips values={report.redesignBrief.shapesToChange} />
        </Kv>
        <Kv label="Position du point focal">{report.redesignBrief.focalPointPosition}</Kv>
        <Kv label="Proportions relatives">{report.redesignBrief.relativeProportions}</Kv>
        <Kv label="Palette de couleurs">
          <Chips values={report.redesignBrief.colorPalette} />
        </Kv>
        <Kv label="Matériaux et finitions">{report.redesignBrief.materialsAndFinishes}</Kv>
        <Kv label="Réalisme attendu">{report.redesignBrief.expectedRealism}</Kv>
        <Kv label="Contraintes de fabrication">{report.redesignBrief.manufacturingConstraints}</Kv>
        <Kv label="Objectif commercial principal">{report.redesignBrief.primaryCommercialObjective}</Kv>
      </Section>

      <Section title="Plan de test" subtitle="Comment valider sur le terrain, sans conclure trop vite">
        <ol className="space-y-2">
          {report.testingPlan.map((step, i) => (
            <li key={i} className="rounded-lg bg-panel-2 p-3 text-xs text-ink-dim">
              <span className="font-semibold text-ink">{i + 1}. {step.step}</span>
              {step.metric ? <span className="ml-2">· métrique : {step.metric}</span> : null}
              {step.note ? <span className="block mt-1 text-[11px] text-ink-faint">{step.note}</span> : null}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Décision finale" subtitle="Diagnostic + priorités pour l’équipe">
        <p>{report.finalDecision.diagnosis}</p>
        <Kv label="Trois priorités">
          <Bullets values={report.finalDecision.threePriorities} />
        </Kv>
        <Kv label="À conserver">
          <Chips values={report.finalDecision.preserve} />
        </Kv>
        <Kv label="À éviter">
          <Chips values={report.finalDecision.avoid} />
        </Kv>
        <Kv label="Direction artistique">{report.finalDecision.artDirection}</Kv>
        <Kv label="Plan de validation">{report.finalDecision.validationPlan}</Kv>
      </Section>

      <Section title="Recommandations prioritaires" subtitle="Sélectionnez celles à intégrer au redesign">
        {report.priorityRecommendations.length === 0 ? (
          <p className="text-xs text-ink-faint">Aucune recommandation prioritaire fournie par le modèle.</p>
        ) : (
          <ul className="space-y-3">
            {[...report.priorityRecommendations]
              .sort((a, b) => a.priority - b.priority)
              .map((rec) => {
                const selected = selectedIds.includes(rec.id)
                return (
                  <li key={rec.id}>
                    <button
                      onClick={() => onToggleRecommendation(rec.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                        selected ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel-2 hover:border-accent/40'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                          selected ? 'border-accent bg-accent text-white' : 'border-line text-transparent'
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{rec.title}</span>
                          <Badge tone="accent">
                            Priorité {rec.priority} · impact {rec.expectedImpact}
                          </Badge>
                          <Badge tone="neutral">confiance {Math.round(rec.confidence * 100)} %</Badge>
                        </span>
                        <span className="mt-1.5 block text-xs text-ink-dim">{rec.description}</span>
                        {rec.proposedChange ? (
                          <span className="mt-1.5 block text-xs text-accent">
                            <strong>Changement :</strong> {rec.proposedChange}
                          </span>
                        ) : null}
                        {rec.estimatedCost ? (
                          <span className="mt-1 block text-[11px] text-ink-faint">Coût estimé : {rec.estimatedCost}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </Section>

      <Section title="Détails techniques">
        <div className="grid grid-cols-1 gap-2 text-xs text-ink-faint sm:grid-cols-2">
          <Kv label="Modèle">{report.modelMetadata.model}</Kv>
          <Kv label="Protocole">{report.protocolVersion}</Kv>
          <Kv label="Durée">{Math.round(report.modelMetadata.durationMs / 1000)} s</Kv>
          <Kv label="Jetons">
            {report.modelMetadata.usage?.totalTokens != null
              ? `${report.modelMetadata.usage.totalTokens} (in ${report.modelMetadata.usage.promptTokens ?? '?'}/out ${report.modelMetadata.usage.outputTokens ?? '?'})`
              : 'non communiqué'}
          </Kv>
          <Kv label="Coût estimé">
            {report.modelMetadata.usage?.estimatedCostUsd != null
              ? `$ ${report.modelMetadata.usage.estimatedCostUsd.toFixed(5)}`
              : 'non communiqué'}
          </Kv>
        </div>
      </Section>
    </div>
  )
}