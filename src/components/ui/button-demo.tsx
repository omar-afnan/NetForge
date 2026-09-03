import { ChevronLeft, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ButtonDemo() {
  return (
    <div className="flex flex-col items-start gap-4 bg-black p-10">
      <div className="flex items-center gap-4">
        <Button size="sm">Primary</Button>
        <Button size="lg">Primary</Button>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="accent" size="sm">Accent</Button>
        <Button variant="accent" size="lg">Accent</Button>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm">Secondary</Button>
        <Button variant="secondary" size="lg">Secondary</Button>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="destructive" size="sm">Destructive</Button>
        <Button variant="destructive" size="lg">Destructive</Button>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="minimal" size="sm">Minimal</Button>
        <Button variant="minimal" size="lg">Minimal</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="icon" size="sm" aria-label="Back"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="icon" size="sm" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
        <Button variant="icon" size="sm" aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}
