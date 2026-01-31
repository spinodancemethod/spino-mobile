import { router } from "expo-router";
import ThemedView from "Components/ThemedView";
import ThemedText from "Components/ThemedText";
import ThemedButton from "Components/ThemedButton";
import Spacer from "Components/Spacer";

export default function App() {

  return (
    <ThemedView>
      <ThemedText variant="title">Hello</ThemedText>
      <ThemedText variant="subheader">World.</ThemedText>
      <Spacer />
      <ThemedText> ciao.</ThemedText>
      <Spacer />

      <ThemedButton
        title="Go to Positions"
        onPress={() => {
          router.push('/(positions)/Positions');
          console.log("Navigate to /(positions)/Positions");
        }}
        style={{ width: "100%" }}
      />
    </ThemedView>
  );
}
