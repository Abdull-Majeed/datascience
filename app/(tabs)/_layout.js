import { Tabs } from 'expo-router';
import React, { useState, useCallback } from "react";
import { View, StyleSheet, BackHandler, Image, Text, Pressable, Alert, TouchableOpacity } from "react-native";
import { Colors, Fonts, Sizes, CommonStyles } from "../../constants/styles";
import { useFocusEffect } from "@react-navigation/native";
import MyStatusBar from "../../components/myStatusBar";
import { Camera } from 'expo-camera';
import { useRouter } from 'expo-router'; // Use expo-router instead of @react-navigation/native
import { Ionicons } from '@expo/vector-icons';

// Camera Button Component (moved outside of TabLayout)
function CameraButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.cameraButton} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cameraButtonInner}>
        <Ionicons name="camera" size={24} color={Colors.whiteColor} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const router = useRouter(); // Use expo-router's useRouter
  const [backClickCount, setBackClickCount] = useState(0);

  const backAction = () => {
    backClickCount === 1 ? BackHandler.exitApp() : _spring();
    return true;
  };

  useFocusEffect(
    useCallback(() => {
      BackHandler.addEventListener("hardwareBackPress", backAction);
      return () => {
        BackHandler.removeEventListener("hardwareBackPress", backAction);
      };
    }, [backAction])
  );

  function _spring() {
    setBackClickCount(1);
    setTimeout(() => {
      setBackClickCount(0);
    }, 1000);
  }

  const handleCameraPress = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status === 'granted') {
        console.log("Camera permission granted");
        // Use router.push for expo-router navigation
        router.push('/camera/CameraAccessPage');
      } else {
        Alert.alert(
          'Permission Denied',
          'Camera access is required to use this feature.',
          [{ text: 'OK', onPress: () => console.log('Permission denied') }]
        );
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      Alert.alert('Error', 'Failed to request camera permission');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MyStatusBar />
      <Tabs
        screenOptions={{
          tabBarStyle: { ...styles.tabBarStyle },
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarButton: (props) => (
            <Pressable
              {...props}
              android_ripple={{
                color: Colors.whiteColor,
              }}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="workout/workoutScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require('../../assets/images/icon/1_active.png')
                    : require('../../assets/images/icon/1.png')
                }
                style={styles.tabIcon}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search/searchScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require('../../assets/images/icon/5_active.png')
                    : require('../../assets/images/icon/5.png')
                }
                style={styles.tabIcon}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="healthTips/healthTipsScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require('../../assets/images/icon/2_active.png')
                    : require('../../assets/images/icon/2.png')
                }
                style={styles.tabIcon}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="chats/chatsScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require('../../assets/images/icon/3_active.png')
                    : require('../../assets/images/icon/3.png')
                }
                style={styles.tabIcon}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile/profileScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require('../../assets/images/icon/4_active.png')
                    : require('../../assets/images/icon/4.png')
                }
                style={styles.tabIcon}
                resizeMode="contain"
              />
            ),
          }}
        />
      </Tabs>
      
      <CameraButton onPress={handleCameraPress} />
      {exitInfo()}
    </View>
  );

  function exitInfo() {
    return (
      backClickCount === 1 ? (
        <View style={styles.animatedView}>
          <Text style={{ ...Fonts.whiteColor13Medium }}>
            Press Back Once Again to Exit
          </Text>
        </View>
      ) : null
    );
  }
}

const styles = StyleSheet.create({
  cameraButton: {
    position: 'absolute',
    bottom: 75, // Position above the tab bar
    right: 20, // Align above the profile icon
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryColor || '#007AFF',
    ...CommonStyles.shadow,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  animatedView: {
    backgroundColor: "#333333",
    position: "absolute",
    bottom: 20,
    alignSelf: 'center',
    borderRadius: Sizes.fixPadding * 2.0,
    paddingHorizontal: Sizes.fixPadding + 5.0,
    paddingVertical: Sizes.fixPadding,
  },
  tabBarStyle: {
    ...CommonStyles.shadow,
    height: 60.0,
    backgroundColor: Colors.whiteColor,
    paddingTop: Sizes.fixPadding,
  },
  tabIcon: {
    height: 30.0,
    width: 30.0,
  },
});