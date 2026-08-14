import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logistics/disputes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/logistics/disputes"!</div>
}
