import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logistics/operations')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/logistics/operations"!</div>
}
