import { router } from "expo-router";
import ThemedView from "Components/ThemedView";
import ThemedText from "Components/ThemedText";
import ThemedButton from "Components/ThemedButton";
import Spacer from "Components/Spacer";

export default function App() {

  return (
    <ThemedView>
      <ThemedText variant="title">Log In</ThemedText>
      <ThemedText variant="subheader">Page.</ThemedText>
      <ThemedText variant="subheader">Maybe this will be moved and a generic landing page instead?</ThemedText>
      <Spacer />
      <ThemedText> ciao.</ThemedText>
      <Spacer />

      <ThemedButton
        title="Go to a Page"
        onPress={() => router.push('/(positions)/Positions')}
        style={{ width: "100%" }}
      />

      <Spacer />
      <ThemedButton
        title="Go to Your Workspace"
        onPress={() => router.push('/inprogress')}
        style={{ width: "100%" }}
      />
    </ThemedView>
  );
}
