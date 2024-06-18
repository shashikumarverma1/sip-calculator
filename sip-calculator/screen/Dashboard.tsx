import { useNavigation } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

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
    if (isNaN(price)) {
      return "Invalid Price";
    }

    const absPrice = Math.abs(price);
    const croreThreshold = 10000000; // 1 Crore
    const lakhThreshold = 100000; // 1 Lakh

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
      unit = "";
    }

    return `${formattedPrice} ${unit}`;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Expected Amount{" "}</Text>
            <Text style={styles.gain}>{formatPriceInLacsCrores(result.totalAmount)}</Text>
          </View>
        </View>
        <View style={styles.resultContainer}>
          <View>
            <Text style={styles.subTitle}>Amount Invested</Text>
            <Text style={styles.gain}>{formatPriceInLacsCrores(result.investedAmount)}</Text>
          </View>
          <View>
            <Text style={styles.subTitle}>Wealth Gained</Text>
            <Text style={styles.gain}>{formatPriceInLacsCrores(result.wealthGain)}</Text>
          </View>
        </View>
        <View>
          <View>
            <Text style={styles.label}>Investment period (year)</Text>
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
            <Text style={styles.label}>Investment period (month)</Text>
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
            <Text style={styles.label}>Expected Annual returns</Text>
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
            <Text style={styles.label}>Monthly Investment</Text>
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
            <Text style={styles.label}>Annual Increment</Text>
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
         
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
  },
  menuButton: {
    paddingTop: 20,
    width: 40,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
  },
  titleContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
  },
  gain: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  resultContainer: {
    marginTop: 5,
    marginBottom: 30,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  subTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  label: {
    fontWeight: "600",
    fontSize: 20,
    lineHeight: 20,
    marginBottom: 10,
    color: "#666666",
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
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    flexDirection: "row",
    marginHorizontal: 20,
  },
  button: {
    backgroundColor: "#0D88C3",
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "grey",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
