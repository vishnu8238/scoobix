import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logistics/drivers/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/logistics/drivers/"!</div>
}
