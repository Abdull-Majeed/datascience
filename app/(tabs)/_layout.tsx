import { Tabs } from 'expo-router';
import React, { useState, useCallback } from "react";
import { View, StyleSheet, BackHandler, Image, Text, Pressable, TouchableOpacity, Alert } from "react-native";
import { Colors, Fonts, Sizes, CommonStyles } from "../../constants/styles";
import { useFocusEffect } from "@react-navigation/native";
import MyStatusBar from "../../components/myStatusBar";
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {

  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);

  // Handle camera button press
  const handleCameraPress = async () => {
    if (!permission) {
      // Permission state is loading
      return;
    }

    if (!permission.granted) {
      // We don't have permission yet
      const permissionResult = await requestPermission();
      if (permissionResult.granted) {
        // Navigate to camera screen or open camera modal
        console.log('Camera permission granted - open camera');
        // You can navigate to a camera screen here
        // For now, just show an alert
        Alert.alert('Camera Ready', 'Camera permission granted! You can now implement camera navigation.');
      } else {
        Alert.alert(
          'Permission Denied',
          'Camera access was denied. You can enable it in your device settings.',
          [{ text: 'OK' }]
        );
      }
    } else {
      // We already have permission
      console.log('Camera permission already granted - open camera');
      // Navigate to camera screen or open camera modal
      Alert.alert('Camera Ready', 'Opening camera... You can implement camera navigation here.');
    }
  };

  const backAction = () => {
    backClickCount == 1 ? BackHandler.exitApp() : _spring();
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
    setbackClickCount(1);
    setTimeout(() => {
      setbackClickCount(0)
    }, 1000)
  }

  const [backClickCount, setbackClickCount] = useState(0);

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
                  focused ?
                    require('../../assets/images/icon/1_active.png')
                    :
                    require('../../assets/images/icon/1.png')
                }
                style={{ height: 30.0, width: 30.0, }}
                resizeMode="contain"
              />
            )
          }}
        />
        <Tabs.Screen
          name="search/searchScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused ?
                    require('../../assets/images/icon/5_active.png')
                    :
                    require('../../assets/images/icon/5.png')
                }
                style={{ height: 30.0, width: 30.0, }}
                resizeMode="contain"
              />
            )
          }}
        />
        <Tabs.Screen
          name="healthTips/healthTipsScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused ?
                    require('../../assets/images/icon/2_active.png')
                    :
                    require('../../assets/images/icon/2.png')
                }
                style={{ height: 30.0, width: 30.0, }}
                resizeMode="contain"
              />
            )
          }} />
        <Tabs.Screen
          name="chats/chatsScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused ?
                    require('../../assets/images/icon/3_active.png')
                    :
                    require('../../assets/images/icon/3.png')
                }
                style={{ height: 30.0, width: 30.0, }}
                resizeMode="contain"
              />
            )
          }}
        />
        <Tabs.Screen
          name="profile/profileScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused ?
                    require('../../assets/images/icon/4_active.png')
                    :
                    require('../../assets/images/icon/4.png')
                }
                style={{ height: 30.0, width: 30.0, }}
                resizeMode="contain"
              />
            )
          }}
        />
      </Tabs>
      
      {/* Camera Button */}
      <TouchableOpacity 
        style={styles.cameraButton} 
        onPress={handleCameraPress}
        activeOpacity={0.8}
      >
        <View style={styles.cameraButtonInner}>
          <Ionicons name="camera" size={24} color={Colors.whiteColor} />
        </View>
      </TouchableOpacity>

      {exitInfo()}
    </View>
  );

  function exitInfo() {
    return (
      backClickCount == 1
        ?
        <View style={styles.animatedView}>
          <Text style={{ ...Fonts.whiteColor13Medium }}>
            Press Back Once Again to Exit
          </Text>
        </View>
        :
        null
    )
  }
}

const styles = StyleSheet.create({
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
    paddingTop: Sizes.fixPadding
  },
  cameraButton: {
    position: 'absolute',
    bottom: 75, // Position above the tab bar (60px height + 15px margin)
    right: 20, // Align above the profile icon (rightmost tab)
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
  }
})