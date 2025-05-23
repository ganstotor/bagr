import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";
import MapView, { Polygon, Marker } from "react-native-maps";
import Icon from "react-native-vector-icons/Ionicons";
import stateAbbrMap from "../../../utils/stateAbbreviations";
import { haversineDistance, getStateFromCoords, findNearbyStates } from "../../../utils/geo";

type GeoFeature = {
  type: string;
  properties: {
    ZCTA5CE10: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
};

type ZipListItem = {
  key: string;
  state: string;
};

export default function ZipMapScreen() {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [savedZips, setSavedZips] = useState<ZipListItem[]>([]);
  const [zipInput, setZipInput] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [newRadius, setNewRadius] = useState<string>("");
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const getBoundingRegion = () => {
    if (features.length === 0) return null;

    let minLat = 90,
      maxLat = -90,
      minLng = 180,
      maxLng = -180;

    features.forEach((feature) => {
      const polygons =
        feature.geometry.type === "Polygon"
          ? (feature.geometry.coordinates as number[][][])
          : (feature.geometry.coordinates as number[][][][]).flat();

      polygons.forEach((polygon) => {
        polygon.forEach(([lng, lat]) => {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        });
      });
    });

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // небольшой отступ
    const lngDelta = (maxLng - minLng) * 1.5;

    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(latDelta, 0.05), // чтобы не слишком приближаться
      longitudeDelta: Math.max(lngDelta, 0.05),
    };
  };

  const boundingRegion = useMemo(() => getBoundingRegion(), [features]);

  const fetchGeoJSON = async (customRadiusParam?: number | null) => {
    const radiusToUse = customRadiusParam ?? radius;
    if (!currentLocation || !radiusToUse) return;
    try {
      setLoading(true);

      const nearbyStates = await findNearbyStates(
        currentLocation,
        radiusToUse,
        currentState
      );

      const allFeatures: GeoFeature[] = [];

      for (const state of nearbyStates) {
        const abbr = stateAbbrMap[state];
        if (!abbr) continue;

        const url = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${abbr}_${state
          .toLowerCase()
          .replace(/ /g, "_")}_zip_codes_geo.min.json`;
        const res = await fetch(url);
        const geo = await res.json();

        const filtered = geo.features.filter((f: GeoFeature) => {
          const polygons =
            f.geometry.type === "Polygon"
              ? (f.geometry.coordinates as number[][][])
              : (f.geometry.coordinates as number[][][][]).flat();

          return polygons.some((polygon) =>
            polygon.some(
              ([lng, lat]) =>
                haversineDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  lat,
                  lng
                ) <= radiusToUse
            )
          );
        });

        allFeatures.push(...filtered);
      }

      setFeatures(allFeatures);
    } catch (err) {
      console.error("GeoJSON error:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveRadiusToFirestore = async () => {
    if (user) {
      const parsedRadius = Math.min(Number(newRadius), 50); // защита на 50
      const ref = doc(db, "users_driver", user.uid);
      await setDoc(ref, { milesRadius: parsedRadius }, { merge: true });
      setRadius(parsedRadius);
      fetchGeoJSON(parsedRadius); // передаем явный радиус
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users_driver", user.uid);

    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      // Проверка изменения координат
      const newLat = data.location?.latitude;
      const newLon = data.location?.longitude;
      const locationChanged =
        newLat !== undefined &&
        newLon !== undefined &&
        (newLat !== currentLocation?.latitude ||
          newLon !== currentLocation?.longitude);

      if (locationChanged) {
        setCurrentLocation({ latitude: newLat, longitude: newLon });

        const region = await getStateFromCoords(newLat, newLon);
        setCurrentState(region || null);
      }

      if (Array.isArray(data.zipCodes)) {
        setSavedZips(data.zipCodes);
      }

      if (data.milesRadius) {
        setRadius(data.milesRadius);
        setNewRadius(String(data.milesRadius));
      }

      setUserDataLoaded(true);
    });

    return unsubscribe;
  }, [user, currentLocation]);

  useEffect(() => {
    if (currentLocation && currentState && userDataLoaded) {
      fetchGeoJSON(); // теперь только когда radius точно загружен из базы
    }
  }, [currentLocation, currentState, userDataLoaded]);

  const updateFirestoreZips = async (updated: ZipListItem[]) => {
    if (user) {
      const ref = doc(db, "users_driver", user.uid);
      await setDoc(ref, { zipCodes: updated }, { merge: true });
    }
  };

  const getStateFromZip = async (zip: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.places?.[0]?.state || null;
    } catch {
      return null;
    }
  };

  const handleAddZip = async () => {
    const zip = zipInput.trim();
    if (!zip || zip.length < 3 || savedZips.some((z) => z.key === zip)) return;

    const zipState = await getStateFromZip(zip);
    if (!zipState) return;
    console.log("zipState", zipState);
    const abbr = stateAbbrMap[zipState.trim()];
    if (!abbr) return;

    const updated = [...savedZips, { key: zip, state: abbr.toUpperCase() }];
    setSavedZips(updated);
    setZipInput("");
    updateFirestoreZips(updated);
  };

  const handleRemoveZip = async (zip: string) => {
    const updated = savedZips.filter((z) => z.key !== zip);
    setSavedZips(updated);
    updateFirestoreZips(updated);
  };

  const toggleZipFromMap = async (zip: string) => {
    if (!currentState) return;

    const abbr = stateAbbrMap[currentState.trim()];
    if (!abbr) return;

    const stateCode = abbr.toUpperCase();
    const exists = savedZips.some((z) => z.key === zip);
    const updated = exists
      ? savedZips.filter((z) => z.key !== zip)
      : [...savedZips, { key: zip, state: stateCode }];

    setSavedZips(updated);
    updateFirestoreZips(updated);
  };

  return (
    <View style={styles.container}>
      {showPopup && (
        <View style={styles.popup}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ marginRight: 8 }}>Radius (miles):</Text>
            <TextInput
              style={[styles.input, { width: 80 }]}
              value={newRadius}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                if (isNaN(num)) {
                  setNewRadius(""); // если пусто
                } else if (num <= 50) {
                  setNewRadius(String(num)); // разрешаем только до 50
                } else {
                  setNewRadius("50"); // если больше 50, ставим 50
                }
              }}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={{
                backgroundColor: "#007BFF",
                padding: 8,
                marginLeft: 10,
                borderRadius: 5,
              }}
              onPress={saveRadiusToFirestore}
            >
              <Text style={{ color: "white" }}>Apply</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter ZIP"
              value={zipInput}
              onChangeText={setZipInput}
              keyboardType="numeric"
            />
            <Button title="Add" onPress={handleAddZip} />
          </View>
          <View style={styles.zipScrollList}>
            <ScrollView
              style={{ maxHeight: "90%", marginTop: 10, marginBottom: 10 }}
              horizontal={false}
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {savedZips.map((item) => (
                <View key={item.key} style={styles.zipItem}>
                  <Text style={styles.zipText}>{item.key}</Text>
                  <TouchableOpacity onPress={() => handleRemoveZip(item.key)}>
                    <Icon name="close-circle" size={18} color="red" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          style={styles.smallButton}
          onPress={() => {
            if (!currentState) return;

            const abbr = stateAbbrMap[currentState.trim()];
            if (!abbr) return;

            const stateCode = abbr.toUpperCase();
            const allZips = features.map((f) => f.properties.ZCTA5CE10);
            const uniqueZips = Array.from(
              new Set([...savedZips.map((z) => z.key), ...allZips])
            );

            const updated = uniqueZips.map((zip) => ({
              key: zip,
              state: stateCode,
            }));

            setSavedZips(updated);
            updateFirestoreZips(updated);
          }}
        >
          <Text style={styles.smallButtonText}>Select All ZIPs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallButton}
          onPress={() => {
            setSavedZips([]);
            updateFirestoreZips([]);
          }}
        >
          <Text style={styles.smallButtonText}>Deselect All ZIPs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowPopup(!showPopup)}
        >
          <Icon
            name={showPopup ? "close" : "options"}
            size={30}
            color="#007BFF"
          />
        </TouchableOpacity>
      </View>

      {loading || !currentLocation ? (
        <ActivityIndicator size="large" />
      ) : (
        <MapView
          style={styles.map}
          region={
            boundingRegion ?? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.2,
              longitudeDelta: 0.2,
            }
          }
          showsUserLocation={true}
        >
          {features.map((feature) => {
            const { geometry, properties } = feature;
            const zipCode = properties.ZCTA5CE10;
            const isSelected = savedZips.some((z) => z.key === zipCode);
            let polygons =
              geometry.type === "Polygon"
                ? (geometry.coordinates as number[][][])
                : (geometry.coordinates as number[][][][]).flat();

            return polygons.map((polygon, i) => {
              const coords = polygon.map(([lng, lat]) => ({
                latitude: lat,
                longitude: lng,
              }));

              return (
                <Polygon
                  key={`${zipCode}-${i}`}
                  coordinates={coords}
                  strokeColor="#000"
                  fillColor={
                    isSelected ? "rgba(0,200,0,0.4)" : "rgba(0,150,255,0.3)"
                  }
                  strokeWidth={1}
                  tappable
                  onPress={() => toggleZipFromMap(zipCode)}
                />
              );
            });
          })}

          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              pinColor="red"
              title="Текущее местоположение"
            />
          )}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: "#ccc",
    padding: 6,
  },
  zipItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  zipText: {
    marginRight: 6,
    fontSize: 14,
  },
  map: {
    flex: 1,
    borderRadius: 12,
  },
  iconButton: {
    right: 20,
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    elevation: 5,
  },

  popup: {
    position: "absolute",
    top: 70,
    height: "90%",
    right: 10,
    left: 10,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    elevation: 5,
    zIndex: 9,
  },

  zipScrollList: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  smallButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
});
