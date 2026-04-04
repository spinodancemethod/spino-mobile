import { Redirect } from 'expo-router'

export default function DashboardIndexRedirect() {
    // Ensure dashboard root always lands on roadmap, regardless of tab ordering.
    return <Redirect href="/your-roadmap" />
}
