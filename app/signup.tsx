import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  // Google Auth request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId:
      "251220864547-nl5afre9cfa1lko18a51vbun8jhkv4mh.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      signInWithCredential(auth, credential)
        .then(() => {
          router.push("/(driver)/my-qwests" as any);
        })
        .catch((error) => {
          alert("Google Sign-In failed: " + error.message);
        });
    }
  }, [response]);

  const handleAuth = async () => {
    try {
      if (mode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        const userDocRef = doc(db, "users_driver", user.uid);
        await setDoc(userDocRef, {
          email: user.email,
          name: name,
          rank: "Recruit",
          completedMissionsCount: 0,
          uncompletedMissionsCount: 0,
          failedMissionsCount: 0,
          milesRadius: 10,
          status: "pending",
          activationPopupShown: false,
        });

        // После регистрации отправляем на профиль
        router.push("/(driver)/profile");
      } else {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // Получаем документ из коллекции users_driver
        const userDocRef = doc(db, "users_driver", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();

          if (userData.activationPopupShown) {
            router.push("/(driver)/profile");
          } else if (userData.status === "active") {
            router.push("/(driver)/my-qwests");
          } else {
            router.push("/(driver)/profile");
          }
        } else {
          alert("User data not found in users_driver collection.");
        }
      }
    } catch (error: any) {
      alert(
        `${mode === "signup" ? "Sign up" : "Sign in"} failed: ${error.message}`
      );
    }
  };

  const handleQuickLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, "alex@mail.com", "123321");
      router.push("/(driver)/profile" as any);
    } catch (error: any) {
      alert(`Quick login failed: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {mode === "signup" ? "Sign Up" : "Login"}
      </Text>

      {mode === "signup" && (
        <TextInput
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
      )}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
        <Text style={styles.buttonText}>
          {mode === "signup" ? "Create Account" : "Login"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.switchText}>
        {mode === "signup"
          ? "Already have an account?"
          : "Don't have an account?"}{" "}
        <Text
          style={styles.switchLink}
          onPress={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Login" : "Sign Up"}
        </Text>
      </Text>

      <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>

      {/* Кнопка быстрого логина */}
      <TouchableOpacity style={styles.quickButton} onPress={handleQuickLogin}>
        <Text style={styles.buttonText}>Quick Login (alex@mail.com)</Text>
      </TouchableOpacity>

      {/* Кнопка Google авторизации */}
      <TouchableOpacity
        style={[
          styles.authButton,
          { backgroundColor: "#4285F4", marginTop: 10 },
        ]}
        disabled={!request}
        onPress={() => promptAsync()}
      >
        <Text style={styles.buttonText}>Sign In with Google</Text>
      </TouchableOpacity>
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
  authButton: {
    backgroundColor: "#FF9800",
    padding: 12,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
    marginVertical: 5,
  },
  quickButton: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  switchText: {
    marginTop: 15,
    fontSize: 16,
  },
  switchLink: {
    fontWeight: "bold",
    color: "#007AFF",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
    width: "100%",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#777",
  },
});
