import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logistics/orders/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/logistics/orders/"!</div>
}
