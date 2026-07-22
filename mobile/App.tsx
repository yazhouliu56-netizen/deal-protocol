import "./global.css";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { DiagnosisResult, GeoLocation } from "./src/types";

import HomeScreen from "./src/screens/HomeScreen";
import DiagnosisScreen from "./src/screens/DiagnosisScreen";
import MatchScreen from "./src/screens/MatchScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ProviderHomeScreen from "./src/screens/ProviderHomeScreen";
import GrabScreen from "./src/screens/GrabScreen";
import MyOrdersScreen from "./src/screens/MyOrdersScreen";
import OrderDetailScreen from "./src/screens/OrderDetailScreen";
import SOSScreen from "./src/screens/SOSScreen";

export type RootStackParamList = {
  Home: undefined;
  Diagnosis: { text: string; diagnosis: DiagnosisResult; location?: GeoLocation };
  Match: { orderId: string };
  Chat: { orderId: string };
  Profile: undefined;
  ProviderHome: undefined;
  Grab: { orderId: string };
  MyOrders: undefined;
  OrderDetail: { orderId: string };
  SOS: { orderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView className="flex-1">
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: "#fff" },
            headerTintColor: "#0f172a",
            headerTitleStyle: { fontWeight: "600", fontSize: 17 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: "#f8fafc" },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Diagnosis" component={DiagnosisScreen} options={{ title: "AI 诊断" }} />
          <Stack.Screen name="Match" component={MatchScreen} options={{ title: "匹配中" }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "聊天" }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "个人中心" }} />
          <Stack.Screen name="ProviderHome" component={ProviderHomeScreen} options={{ title: "服务者首页" }} />
          <Stack.Screen name="Grab" component={GrabScreen} options={{ title: "订单详情" }} />
          <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: "我的订单" }} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "订单详情" }} />
          <Stack.Screen
            name="SOS"
            component={SOSScreen}
            options={{
              title: "紧急求助",
              headerStyle: { backgroundColor: "#7f1d1d" },
              headerTintColor: "#fff",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
