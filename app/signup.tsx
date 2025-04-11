import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";

export default function SignUpScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: "YOUR_GOOGLE_CLIENT_ID", // Замените на свой
  });

  const signUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential) router.replace("/(driver)/home");
    } catch (error: any) {
      console.log(error);
      alert("Sign up failed: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Sign Up</Text>

      <TextInput
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder="Create Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.signupButton} onPress={signUp}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>

      <Text style={styles.orText}>or</Text>

      <TouchableOpacity style={styles.googleButton} onPress={() => promptAsync()}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>

      <Text style={styles.loginText}>
        If you have an account,
        <Text style={styles.loginLink} onPress={() => router.push("/login")}>
          {" "}Login
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  signupButton: {
    backgroundColor: "#FF9800",
    padding: 12,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
    marginVertical: 5,
  },
  googleButton: {
    backgroundColor: "#DB4437",
    padding: 12,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
    marginVertical: 5,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  orText: {
    marginVertical: 10,
  },
  loginText: {
    marginTop: 15,
    fontSize: 16,
  },
  loginLink: {
    fontWeight: "bold",
    color: "#007AFF",
  },
});
