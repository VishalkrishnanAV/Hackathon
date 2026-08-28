import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AlertTriangle, Bot, BrainCircuit, Check, ChevronRight, Circle, FileText, Gavel, LoaderCircle, MessageSquareText, Play, ShieldCheck, Sparkles, Upload, Users } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
type AgentKey = 'technical' | 'hr_culture' | 'hiring_manager' | 'skeptic'
type RunStatus = 'idle' | 'uploading' | 'running' | 'completed' | 'failed'
type Opinion = { agent: AgentKey; recommendation: string; confidence: number; headline: string; strengths: string[]; concerns: string[]; evidence_ids: string[] }
type Profile = { candidate_name: string; summary: string; skills: string[]; contradictions: string[] }
type DebateExchange = { speaker: AgentKey; responding_to_agent: AgentKey; response: string; changed: boolean; previous_recommendation: string; revised_recommendation: string; change_reason: string; evidence_ids: string[] }
type Decision = { recommendation: string; confidence: number; rationale: string; strengths: string[]; concerns: string[]; unresolved_disagreements: string[]; evidence_ids: string[] }

const agents: { key: AgentKey; name: string; role: string; icon: typeof Bot }[] = [
  { key: 'technical', name: 'Nova', role: 'Technical depth', icon: BrainCircuit },
  { key: 'hr_culture', name: 'Maya', role: 'People & culture', icon: Users },
  { key: 'hiring_manager', name: 'Atlas', role: 'Role & business fit', icon: Gavel },
  { key: 'skeptic', name: 'Cipher', role: 'Claims & red flags', icon: ShieldCheck },
]
const labels: Record<string, string> = { strong_hire: 'Strong hire', hire: 'Hire', mixed: 'Mixed', no_hire: 'No hire', insufficient_information: 'Not enough evidence' }
const readable = (value?: string) => value ? labels[value] ?? value.replaceAll('_', ' ') : 'Pending'

function FilePicker({ label, value, onChange }: { label: string; value?: File; onChange: (file?: File) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-')
  return <label htmlFor={id} className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 transition hover:border-cyan-400/30 hover:bg-white/[0.06]">
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-400 group-hover:text-cyan-300">{value ? <FileText size={19} /> : <Upload size={19} />}</span>
    <span className="min-w-0 flex-1"><span className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</span><span className="mt-0.5 block truncate text-sm text-slate-200">{value?.name ?? 'Choose PDF'}</span></span>
    {value && <Check size={17} className="text-emerald-400" />}
    <input id={id} type="file" accept="application/pdf" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0])} />
  </label>
}

function AgentCard({ agent, state, opinion }: { agent: (typeof agents)[number]; state: string; opinion?: Opinion }) {
  const Icon = agent.icon
  const active = state === 'working'
  return <article className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 ${active ? 'border-cyan-400/40 bg-cyan-400/[0.06] shadow-[0_0_35px_rgba(34,211,238,.08)]' : opinion ? 'border-emerald-400/20 bg-emerald-400/[0.035]' : 'border-white/10 bg-white/[0.025]'}`}>
    {active && <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />}
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className={`grid size-10 place-items-center rounded-xl ${active ? 'bg-cyan-400/15 text-cyan-300' : opinion ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-slate-400'}`}><Icon size={19} /></div><div><h3 className="font-semibold text-white">{agent.name}</h3><p className="text-xs text-slate-500">{agent.role}</p></div></div>{active ? <LoaderCircle className="animate-spin text-cyan-300" size={18} /> : opinion ? <Check className="text-emerald-400" size={18} /> : <Circle className="text-slate-700" size={16} />}</div>
    <div className="mt-4 min-h-16">{active && <p className="text-sm leading-6 text-cyan-100/70">Reviewing the profile and tracing claims to source evidence…</p>}{!active && !opinion && <p className="text-sm leading-6 text-slate-600">Waiting for the shared profile.</p>}{opinion && <><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-200">{readable(opinion.recommendation)}</span><span className="font-mono text-xs text-slate-500">{Math.round(opinion.confidence * 100)}%</span></div><p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{opinion.headline}</p></>}</div>
  </article>
}

function App() {
  const [files, setFiles] = useState<{ job?: File; resume?: File; transcript?: File }>({})
  const [status, setStatus] = useState<RunStatus>('idle')
  const [stage, setStage] = useState('Upload the interview documents')
  const [agentStates, setAgentStates] = useState<Record<AgentKey, string>>({ technical: 'waiting', hr_culture: 'waiting', hiring_manager: 'waiting', skeptic: 'waiting' })
  const [opinions, setOpinions] = useState<Partial<Record<AgentKey, Opinion>>>({})
  const [profile, setProfile] = useState<Profile>()
  const [debate, setDebate] = useState<DebateExchange[]>([])
  const [decision, setDecision] = useState<Decision>()
  const [error, setError] = useState('')
  const [modelReady, setModelReady] = useState<boolean | null>(null)
  const ready = Boolean(files.job && files.resume && files.transcript)
  const completedAgents = Object.keys(opinions).length
  const progress = useMemo(() => status === 'completed' ? 100 : decision ? 95 : debate.length ? 78 : completedAgents ? 25 + completedAgents * 11 : profile ? 25 : status === 'running' ? 10 : 0, [status, decision, debate.length, completedAgents, profile])

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((health) => setModelReady(Boolean(health.model_available)))
      .catch(() => setModelReady(false))
  }, [])

  function resetRun() { setProfile(undefined); setOpinions({}); setDebate([]); setDecision(undefined); setError(''); setAgentStates({ technical: 'waiting', hr_culture: 'waiting', hiring_manager: 'waiting', skeptic: 'waiting' }) }
  function applyEvent(event: any) {
    if (event.type === 'profile_complete') setProfile(event.profile)
    if (event.type === 'agent_started') setAgentStates((old) => ({ ...old, [event.agent]: 'working' }))
    if (event.type === 'agent_complete') { setAgentStates((old) => ({ ...old, [event.agent]: 'complete' })); setOpinions((old) => ({ ...old, [event.agent]: event.opinion })) }
    if (event.type === 'debate_complete') setDebate(event.debate.exchanges)
    if (event.type === 'decision_complete') setDecision(event.decision)
    if (event.type === 'stage') setStage(event.message)
    if (event.type === 'complete') { setStatus('completed'); setStage('Panel report complete') }
    if (event.type === 'error') { setStatus('failed'); setError(event.message); setStage('Evaluation failed') }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!files.job || !files.resume || !files.transcript) return
    resetRun(); setStatus('uploading'); setStage('Extracting traceable PDF evidence')
    const body = new FormData(); body.append('job_description', files.job); body.append('resume', files.resume); body.append('transcript', files.transcript)
    try {
      const response = await fetch(`${API_URL}/api/evaluations`, { method: 'POST', body })
      if (!response.ok) throw new Error((await response.json()).detail ?? 'Could not start evaluation')
      const { id } = await response.json(); setStatus('running')
      const stream = new EventSource(`${API_URL}/api/evaluations/${id}/events`)
      stream.onmessage = (message) => { const data = JSON.parse(message.data); applyEvent(data); if (data.type === 'complete' || data.type === 'error') stream.close() }
      stream.onerror = () => { stream.close(); setStatus((old) => old === 'completed' ? old : 'failed'); setError('Live progress connection closed.') }
    } catch (cause) { setStatus('failed'); setError(cause instanceof Error ? cause.message : 'Unexpected error') }
  }

  return <div className="min-h-screen bg-[#071019] text-slate-100 selection:bg-cyan-400/20">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,.08),transparent_28%),radial-gradient(circle_at_85%_5%,rgba(139,92,246,.08),transparent_24%)]" />
    <header className="relative border-b border-white/[0.07] bg-[#071019]/80 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950"><Sparkles size={18} /></div><div><div className="font-semibold tracking-tight">PanelAI</div><div className="text-[10px] uppercase tracking-[.22em] text-slate-500">Evidence-led hiring</div></div></div><div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${modelReady ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300' : 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300'}`}><span className={`size-1.5 rounded-full ${modelReady ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} /> {modelReady === null ? 'Checking local model…' : modelReady ? 'Local · Llama 3.1 8B ready' : 'Llama 3.1 8B not downloaded'}</div></div></header>
    <main className="relative mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[340px_1fr] lg:px-8">
      <aside><div className="sticky top-6 rounded-3xl border border-white/10 bg-[#0b1621]/90 p-5 shadow-2xl shadow-black/20"><div className="mb-6"><p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-400">New evaluation</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Build your interview panel</h1><p className="mt-2 text-sm leading-6 text-slate-500">Three documents become one traceable, debated recommendation.</p></div><form onSubmit={submit} className="space-y-3"><FilePicker label="Job description" value={files.job} onChange={(job) => setFiles((old) => ({ ...old, job }))} /><FilePicker label="Candidate résumé" value={files.resume} onChange={(resume) => setFiles((old) => ({ ...old, resume }))} /><FilePicker label="Interview transcript" value={files.transcript} onChange={(transcript) => setFiles((old) => ({ ...old, transcript }))} /><button disabled={!ready || status === 'running' || status === 'uploading'} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-blue-500 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">{status === 'running' || status === 'uploading' ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={16} fill="currentColor" />} Run panel evaluation</button></form><div className="mt-6 border-t border-white/[0.07] pt-5"><div className="flex items-center justify-between text-xs"><span className="text-slate-500">Pipeline progress</span><span className="font-mono text-cyan-300">{progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500 transition-all duration-700" style={{ width: `${progress}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">{stage}</p></div></div></aside>
      <section className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-[#0b1621]/75 p-5 lg:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-[.2em] text-slate-500">Independent review</p><h2 className="mt-1 text-xl font-semibold text-white">Four perspectives, zero groupthink</h2></div><div className="font-mono text-xs text-slate-500">{completedAgents}/4 complete</div></div><div className="grid gap-3 sm:grid-cols-2">{agents.map((agent) => <AgentCard key={agent.key} agent={agent} state={agentStates[agent.key]} opinion={opinions[agent.key]} />)}</div></div>
        {profile && <section className="rounded-3xl border border-white/10 bg-[#0b1621]/75 p-6"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-400/10 text-blue-300"><FileText size={19} /></div><div><p className="text-xs uppercase tracking-[.18em] text-slate-500">Shared profile</p><h2 className="mt-1 text-xl font-semibold text-white">{profile.candidate_name}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{profile.summary}</p><div className="mt-4 flex flex-wrap gap-2">{profile.skills.slice(0, 8).map((skill) => <span key={skill} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">{skill}</span>)}</div></div></div></section>}
        {debate.length > 0 && <section className="rounded-3xl border border-violet-400/15 bg-violet-400/[0.035] p-6"><div className="mb-5 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><MessageSquareText size={19} /></div><div><p className="text-xs uppercase tracking-[.18em] text-violet-300/70">Live debate</p><h2 className="text-xl font-semibold text-white">Agents challenge the evidence</h2></div></div><div className="space-y-3">{debate.map((item, index) => <article key={index} className="rounded-2xl border border-white/[0.08] bg-[#09131d]/80 p-4"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-violet-300">{agents.find((a) => a.key === item.speaker)?.name}</span><ChevronRight size={13} className="text-slate-600" /><span className="text-slate-400">{agents.find((a) => a.key === item.responding_to_agent)?.name}</span>{item.changed && <span className="ml-auto rounded-full bg-amber-400/10 px-2 py-1 text-amber-300">Opinion changed</span>}</div><p className="mt-3 text-sm leading-6 text-slate-300">{item.response}</p>{item.changed && <p className="mt-3 border-l-2 border-amber-400/30 pl-3 text-xs leading-5 text-slate-500">{readable(item.previous_recommendation)} → {readable(item.revised_recommendation)} · {item.change_reason}</p>}</article>)}</div></section>}
        {decision && <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.07] to-blue-500/[0.03]"><div className="p-6 lg:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-300">Final adjudication</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{readable(decision.recommendation)}</h2></div><div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-[.16em] text-slate-500">Confidence</p><p className="mt-1 font-mono text-2xl text-cyan-300">{Math.round(decision.confidence * 100)}%</p></div></div><p className="mt-6 max-w-4xl text-sm leading-7 text-slate-300">{decision.rationale}</p><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-emerald-400/[0.05] p-4"><h3 className="flex items-center gap-2 text-sm font-medium text-emerald-300"><Check size={16} /> Decisive strengths</h3><ul className="mt-3 space-y-2 text-sm text-slate-400">{decision.strengths.map((x) => <li key={x}>• {x}</li>)}</ul></div><div className="rounded-2xl bg-rose-400/[0.05] p-4"><h3 className="flex items-center gap-2 text-sm font-medium text-rose-300"><AlertTriangle size={16} /> Material concerns</h3><ul className="mt-3 space-y-2 text-sm text-slate-400">{decision.concerns.map((x) => <li key={x}>• {x}</li>)}</ul></div></div></div></section>}
        {status === 'idle' && <div className="grid min-h-48 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center"><div><Bot size={28} className="mx-auto text-slate-700"/><p className="mt-3 text-sm text-slate-500">Upload three PDFs to wake the panel.</p></div></div>}
        {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">{error}</div>}
      </section>
    </main>
  </div>
}

export default App
