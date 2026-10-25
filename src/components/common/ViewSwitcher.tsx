import { List, Columns3 } from 'lucide-react'
export function ViewSwitcher({ board, onChange }: { board: boolean; onChange: (board: boolean) => void }) {
  return <div role="group" aria-label="Issue view" className="view-switcher">{[{ value: false, label: 'List', Icon: List }, { value: true, label: 'Board', Icon: Columns3 }].map(({value,label,Icon}) => <button key={label} type="button" aria-label={label + ' view'} aria-pressed={board === value} onClick={() => onChange(value)}><Icon size={15} aria-hidden="true" />{label}</button>)}</div>
}
