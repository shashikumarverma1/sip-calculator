import { useNavigation } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView } from "react-native-gesture-handler";
export default function Dashboard() {
  const navigation = useNavigation();
  const windowWidth = Dimensions.get("window").width;
  const [formData, setFormData] = useState({
    periodInYear: "",
    periodInMonth: "",
    RateOfReturn: "",
    monthlyInvestment: "",
    AnnualIncrement: "",
  });

  calculateSIP(
    Number(formData.monthlyInvestment),
    Number(formData.AnnualIncrement),
    Number(formData.RateOfReturn),
    Number(formData.periodInYear),
    Number(formData.periodInMonth)
  );
  function calculateSIP(
    initialSIP,
    annualIncrease,
    rateOfReturn,
    totalYears,
    additionalMonths
  ) {
    let totalAmount = 0;
    let investedAmount = 0;
    const monthlyRate = rateOfReturn / 12 / 100;

    // Calculate for full years
    for (let year = 1; year <= totalYears; year++) {
      const yearlySIP = initialSIP + (year - 1) * annualIncrease;

      for (let month = 1; month <= 12; month++) {
        totalAmount = (totalAmount + yearlySIP) * (1 + monthlyRate);
        investedAmount += yearlySIP;
      }
    }

    // Calculate for additional months

    const yearlySIP = initialSIP + totalYears * annualIncrease;
    for (let month = 1; month <= additionalMonths; month++) {
      totalAmount = (totalAmount + yearlySIP) * (1 + monthlyRate);
      investedAmount += yearlySIP;
    }

    return {
      totalAmount: totalAmount.toFixed(2),
      investedAmount: investedAmount.toFixed(2),
      wealthGain: (totalAmount - investedAmount).toFixed(2),
    };
  }
  let result = calculateSIP(
    Number(formData.monthlyInvestment),
    Number(formData.AnnualIncrement),
    Number(formData.RateOfReturn),
    Number(formData.periodInYear),
    Number(formData.periodInMonth)
  );
  function formatPriceInLacsCrores(price) {
    // Check if the input is a valid number
    if (isNaN(price)) {
      return "Invalid Price";
    }

    // Convert the price to absolute value (handle negative numbers)
    const absPrice = Math.abs(price);

    // Define the conversion thresholds
    const croreThreshold = 10000000; // 1 Crore
    const lakhThreshold = 100000; // 1 Lakh

    // Determine the appropriate unit
    let unit;
    let formattedPrice;
    if (absPrice >= croreThreshold) {
      formattedPrice = (absPrice / croreThreshold).toFixed(2);
      unit = "Cr";
    } else if (absPrice >= lakhThreshold) {
      formattedPrice = (absPrice / lakhThreshold).toFixed(2);
      unit = "Lakhs";
    } else {
      formattedPrice = absPrice.toFixed(2);
      unit = ""; // No unit for smaller values
    }

    // Combine formatted price and unit
    return `${formattedPrice} ${unit}`;
  }

  return (
    <View style={{ marginHorizontal: 20 }}>
      <View style={{display:"flex", flexDirection:"row"}}>
      <Pressable
          onPress={() => {
            navigation.openDrawer();
            // navigation.closeDrawer();
          }}
          style={{
           
            paddingTop: 20,
            // backgroundColor: "aqua",
            width: 40,
            display: "flex",
            flexDirection:"row",
            justifyContent:"center"
            ,
            
          }}
        >
          <Text>
            {" "}
            <Ionicons name="menu-outline" size={25} color="black" />
          </Text>
        </Pressable>
        <View style={{ marginTop: 20, marginBottom: 20 ,  marginLeft:30 }}>
          <Text
            style={{ textAlign: "center", fontSize: 20, fontWeight: "600" }}
          >
            Expected Amount{" "}
          </Text>
          <Text style={[styles.gain]}>
            {formatPriceInLacsCrores(result.totalAmount)}
          </Text>
        </View>
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
            <Text style={styles.gain}>
              {formatPriceInLacsCrores(result.investedAmount)}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "600" }}>
              Wealth Gained
            </Text>
            <Text style={styles.gain}>
              {formatPriceInLacsCrores(result.wealthGain)}
            </Text>
          </View>
        </View>
        {/* first section */}

        {/* second section  */}

        <View>
          <View>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 20,
                lineHeight: 20,
                marginBottom: 10,
                color: "#666666",
              }}
            >
              Investment period (year)
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              onChangeText={(e) =>
                setFormData({ ...formData, periodInYear: e.trim() })
              }
              value={formData.periodInYear}
              placeholder="Enter period in year"
            />
          </View>
          <View>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 20,
                lineHeight: 20,
                marginBottom: 10,
                color: "#666666",
              }}
            >
              Investment period (month)
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              onChangeText={(e) =>
                setFormData({ ...formData, periodInMonth: e.trim() })
              }
              value={formData.periodInMonth}
              placeholder="Enter period in month"
            />
          </View>

          <View>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 20,
                lineHeight: 20,
                marginBottom: 10,
                color: "#666666",
              }}
            >
              Expected Annual returns
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              onChangeText={(e) =>
                setFormData({ ...formData, RateOfReturn: e.trim() })
              }
              value={formData.RateOfReturn}
              placeholder="Enter Expected Annual returns"
            />
          </View>

          <View>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 20,
                lineHeight: 20,
                marginBottom: 10,
                color: "#666666",
              }}
            >
              Monthly Investment
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              onChangeText={(e) =>
                setFormData({ ...formData, monthlyInvestment: e.trim() })
              }
              value={formData.monthlyInvestment}
              placeholder="Enter monthly Investment"
            />
          </View>

          <View>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 20,
                lineHeight: 20,
                marginBottom: 10,
                color: "#666666",
              }}
            >
              Annual Increment
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              onChangeText={(e) =>
                setFormData({ ...formData, AnnualIncrement: e.trim() })
              }
              value={formData.AnnualIncrement}
              placeholder="Enter Annual Increment"
            />
          </View>

          <View
            style={{
              display: "flex",
              justifyContent: "center",
              flexDirection: "row",
              marginHorizontal: 20,
            }}
          >
            <Pressable
              style={{
                backgroundColor: "#0D88C3",
                height: 45,
                width: windowWidth / 1.15,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 15,
                borderWidth: 1,
                borderColor: "grey",
              }}
              onPress={() =>
                calculateSIP(
                  Number(formData.monthlyInvestment),
                  Number(formData.AnnualIncrement),
                  Number(formData.RateOfReturn),
                  Number(formData.periodInYear),
                  Number(formData.periodInMonth)
                )
              }
            >
              <Text style={{ color: "#ffff", fontWeight: "800" }}>
                Check Gain
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  gain: { fontSize: 20, fontWeight: "800", textAlign: "center" },
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
  input: {
    width: "100%",
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
    color: "#666666",
  },
});
