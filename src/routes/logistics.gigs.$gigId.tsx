import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logistics/gigs/$gigId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/logistics/gigs/"!</div>
}
