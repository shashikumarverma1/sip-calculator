import { useContext } from "react";
// import { GlobalInfo } from "../context/provider";
import "react-native-gesture-handler";
import * as React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import CustomSidebarMenu from "@/component/customSideBarMenu";
import Dashboard from "@/screen/Dashboard";

const Drawer = createDrawerNavigator();

function DraweNavigation() {
  return (
    <Drawer.Navigator
      screenOptions={{
        activeTintColor: "#e91e63",
        itemStyle: { marginVertical: 5 },
        headerShown: false,
        drawerType: "front", // Set drawer type to front
        swipeEnabled: false, // Disable swipe gesture
      }}
      drawerContent={(props) => <CustomSidebarMenu {...props} />}
    >
      <Drawer.Screen name="Dashboard" component={Dashboard} />
    </Drawer.Navigator>
  );
}

export default DraweNavigation;
