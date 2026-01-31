import { Button, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function App() {

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <Text style={styles.title}>Hello</Text>
        <Text style={styles.subtitle}>World.</Text>
        <Text style={styles.subtitle}></Text>

        <Button
          title="Go to Positions"
          onPress={() => {
            router.push('/(positions)/Positions');
            console.log("Navigate to /(positions)/Positions");
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 24,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 960,
    marginHorizontal: "auto",
  },
  title: {
    fontSize: 64,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 36,
  },
});
