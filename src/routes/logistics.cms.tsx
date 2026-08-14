import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logistics/cms')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/logistics/cms"!</div>
}
