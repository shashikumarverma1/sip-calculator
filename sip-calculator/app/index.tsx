import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

export default function Page() {
  const windowWidth = Dimensions.get("window").width;
  return (
    <View>
      <View style={{ marginTop: 20, marginBottom: 20 }}>
        <Text style={{ textAlign: "center", fontSize: 15, fontWeight: "600" }}>
          Expected Amount{" "}
        </Text>
        <Text style={{ textAlign: "center", fontSize: 15, fontWeight: "600" }}>
          700cr
        </Text>
      </View>
      <View
        style={{
          marginTop: 5,
          marginBottom: 30,
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
        }}
      >
        <View>
          <Text style={{ fontSize: 15, fontWeight: "600" }}>
            Amount Invested
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "600" }}>200cr</Text>
        </View>
        <View>
          <Text style={{ fontSize: 15, fontWeight: "600" }}>Wealth Gained</Text>
          <Text style={{ fontSize: 15, fontWeight: "600" }}>500cr</Text>
        </View>
      </View>
{/* first section */}
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          backgroundColor: "aqua",
          padding:10, margin:5
        }}
      >
        <View>
          <View>
            <View style={styles.flex}>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>Year</Text>
              </Pressable>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>Month</Text>
              </Pressable>
            </View>
            <View style={styles.flex}>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>4 y</Text>
              </Pressable>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>5m</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View>
          <View style={styles.flex}>
            <Pressable
              style={styles.button}
              // onPress={() => signUpHandle()}
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>- month</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              // onPress={() => signUpHandle()}
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>+ month</Text>
            </Pressable>
          </View>
          <View style={styles.flex}>
            <Pressable
              style={styles.button}
              // onPress={() => signUpHandle()}
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>- year</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              // onPress={() => signUpHandle()}
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>+ year</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {/* second section  */}
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          backgroundColor: "aqua",
          padding:10, margin:5
        }}
      >
        <View>
          <View>
            <View style={styles.flex}>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>Year</Text>
              </Pressable>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>Month</Text>
              </Pressable>
            </View>
            <View style={styles.flex}>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>4 y</Text>
              </Pressable>
              <Pressable
                style={styles.year}
                // onPress={() => signUpHandle()}
              >
                <Text style={{ fontWeight: "800" }}>5m</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View>
          <View style={styles.flex}>
            <Pressable
              style={styles.button}
              // onPress={() => signUpHandle()}
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>- month</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              // onPress={() => signUpHandle()}
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>+ %</Text>
            </Pressable>
          </View>
          
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    // alignItems: "center",
    // padding: 24,
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
    color: "#38434D",
  },
  button: {
    backgroundColor: "#0D88C3",
    height: 45,
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    // borderWidth: 1,
    margin: 2,
  },
  flex: {
    display: "flex",
    // justifyContent: "space-between",
    flexDirection: "row",
    marginHorizontal: 5,
    // marginVertical:15,
  },
  year: {
    // backgroundColor: "#0D88C3",
    height: 45,
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    // borderWidth: 1,
    margin: 2,
  },
});
