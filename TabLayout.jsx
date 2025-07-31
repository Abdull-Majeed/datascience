import React, { useState, useEffect, useRef } from "react";
import {
  View, StyleSheet, BackHandler, Pressable, Image,
  ActivityIndicator, Text, Modal
} from "react-native";
import { Tabs, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth, database } from '../../configuration/firebaseConfig';
import { ref as dbRef, set } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Sizes, CommonStyles } from "../../constants/styles";

export default function TabLayout() {
  const [backClickCount, setBackClickCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [cloudinaryUrl, setCloudinaryUrl] = useState(null);
  const webViewRef = useRef(null);
  const router = useRouter();

  const CLOUDINARY_CLOUD_NAME = "dp3yktx6o";
  const CLOUDINARY_UPLOAD_PRESET = "my_upload_preset";
  const CLOUDINARY_API_KEY = "667625573425965";

  // Simplified MediaPipe HTML that works more reliably
  const mediapipeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MediaPipe PoseLandmarker</title>
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.27"></script>
    </head>
    <body>
      <script>
        console.log("Starting simplified MediaPipe initialization...");
        
        let poseLandmarker = null;
        let isInitialized = false;
        
        // Simple initialization function
        async function initializePoseLandmarker() {
          try {
            console.log("Waiting for MediaPipe to load...");
            
            // Wait for MediaPipe to be available
            while (!window.FilesetResolver || !window.PoseLandmarker) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log("MediaPipe loaded, creating vision tasks...");
            const vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.27/wasm"
            );
            
            console.log("Creating PoseLandmarker...");
            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              },
              runningMode: "IMAGE",
              numPoses: 1
            });
            
            isInitialized = true;
            console.log("MediaPipe initialized successfully!");
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "initialized" 
            }));
            
          } catch (error) {
            console.error("MediaPipe initialization error:", error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "error", 
              message: "Failed to initialize: " + error.message 
            }));
          }
        }
        
        // Calculate distance between two points
        function calculateDistance(point1, point2) {
          const dx = point1.x - point2.x;
          const dy = point1.y - point2.y;
          return Math.sqrt(dx * dx + dy * dy);
        }
        
        // Enhanced muscle measurements
        function calculateEnhancedMeasurements(landmarks) {
          const keypoints = landmarks[0];
          
          // Key landmarks
          const leftShoulder = keypoints[11];
          const rightShoulder = keypoints[12];
          const leftElbow = keypoints[13];
          const rightElbow = keypoints[14];
          const leftWrist = keypoints[15];
          const rightWrist = keypoints[16];
          const leftHip = keypoints[23];
          const rightHip = keypoints[24];
          const leftKnee = keypoints[25];
          const rightKnee = keypoints[26];
          const leftAnkle = keypoints[27];
          const rightAnkle = keypoints[28];
          
          // Upper body measurements
          const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);
          const leftArmLength = calculateDistance(leftShoulder, leftElbow) + calculateDistance(leftElbow, leftWrist);
          const rightArmLength = calculateDistance(rightShoulder, rightElbow) + calculateDistance(rightElbow, rightWrist);
          const avgArmLength = (leftArmLength + rightArmLength) / 2;
          
          // Core measurements
          const hipWidth = calculateDistance(leftHip, rightHip);
          const torsoLength = calculateDistance(
            { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 },
            { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
          );
          
          // Six-pack area (abdomen)
          const waistWidth = hipWidth * 0.85; // Estimate waist as 85% of hip width
          const abdominalLength = torsoLength * 0.6; // Lower 60% of torso
          
          // Leg measurements
          const leftLegLength = calculateDistance(leftHip, leftKnee) + calculateDistance(leftKnee, leftAnkle);
          const rightLegLength = calculateDistance(rightHip, rightKnee) + calculateDistance(rightKnee, rightAnkle);
          const avgLegLength = (leftLegLength + rightLegLength) / 2;
          
          // Thigh measurements
          const leftThighLength = calculateDistance(leftHip, leftKnee);
          const rightThighLength = calculateDistance(rightHip, rightKnee);
          const avgThighLength = (leftThighLength + rightThighLength) / 2;
          
          return {
            // Muscle measurements (multiplied by 1000 for readability)
            shoulderWidth: (shoulderWidth * 1000).toFixed(1),
            armLength: (avgArmLength * 1000).toFixed(1),
            chestWidth: (shoulderWidth * 0.95 * 1000).toFixed(1),
            
            // Six-pack/Core area
            waistWidth: (waistWidth * 1000).toFixed(1),
            abdominalWidth: (waistWidth * 1000).toFixed(1),
            abdominalLength: (abdominalLength * 1000).toFixed(1),
            torsoLength: (torsoLength * 1000).toFixed(1),
            
            // Lower body muscles
            hipWidth: (hipWidth * 1000).toFixed(1),
            thighLength: (avgThighLength * 1000).toFixed(1),
            legLength: (avgLegLength * 1000).toFixed(1)
          };
        }
        
        // Process image function
        async function processImage(base64Image) {
          try {
            console.log("Processing image...");
            
            if (!isInitialized || !poseLandmarker) {
              throw new Error("PoseLandmarker not ready");
            }
            
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = () => reject(new Error("Failed to load image"));
              img.src = base64Image;
            });
            
            console.log("Detecting poses...");
            const results = poseLandmarker.detect(img);
            
            if (!results.landmarks || results.landmarks.length === 0) {
              throw new Error("No pose detected in the image");
            }
            
            const measurements = calculateEnhancedMeasurements(results.landmarks);
            console.log("Measurements calculated:", measurements);
            
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "success", 
              measurements: measurements
            }));
            
          } catch (error) {
            console.error("Processing error:", error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "error", 
              message: error.message 
            }));
          }
        }
        
        // Message handler
        window.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("Received:", data.action);
            
            if (data.action === "initialize") {
              if (isInitialized) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ status: "initialized" }));
              } else {
                initializePoseLandmarker();
              }
            } else if (data.action === "processImage") {
              processImage(data.base64Image);
            }
          } catch (error) {
            console.error("Message error:", error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "error", 
              message: "Message handling failed" 
            }));
          }
        });
        
        // Auto-start initialization
        setTimeout(initializePoseLandmarker, 1000);
        
      </script>
    </body>
    </html>
  `;

  // Check email verification
  useEffect(() => {
    console.log("Checking email verification...");
    const checkVerification = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (!auth.currentUser.emailVerified) {
            console.log("User not verified, redirecting to VerificationScreen");
            await AsyncStorage.setItem('emailVerified', 'false');
            router.replace('/VerificationScreen');
          } else {
            console.log("User verified, access granted to TabLayout");
            await AsyncStorage.setItem('emailVerified', 'true');
          }
        } else {
          console.log("No user logged in, redirecting to LoginScreen");
          router.replace('/LoginScreen');
        }
      } catch (error) {
        console.error("Verification error:", error);
        setErrorMessage(`Verification: ${error.message}`);
        router.replace('/LoginScreen');
      }
    };
    checkVerification();
  }, [router]);

  // Initialize WebView
  useEffect(() => {
    const timer = setTimeout(() => {
      if (webViewRef.current) {
        console.log("Initializing WebView...");
        webViewRef.current.postMessage(JSON.stringify({ action: "initialize" }));
      }
    }, 2000);

    const timeout = setTimeout(() => {
      if (isModelLoading) {
        setIsModelLoading(false);
        setErrorMessage("Model loading timeout - you can still try taking a photo");
      }
    }, 20000);

    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, []);

  // Handle WebView messages
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("WebView message:", data);

      if (data.status === "initialized") {
        setIsModelLoading(false);
        setErrorMessage(null);
        console.log("MediaPipe ready!");
      } else if (data.status === "success") {
        setAnalysisResult(prev => ({ 
          ...prev, 
          measurements: data.measurements 
        }));
        setIsProcessing(false);
        setIsModalVisible(true);
      } else if (data.status === "error") {
        setErrorMessage(`MediaPipe: ${data.message}`);
        setIsProcessing(false);
        setIsModalVisible(true);
      }
    } catch (error) {
      console.error("Message handling error:", error);
      setErrorMessage(`WebView communication error`);
      setIsProcessing(false);
      setIsModalVisible(true);
    }
  };

  // Process image for measurements
  const measureBodyParts = async (imageUri) => {
    try {
      console.log("Processing image for measurements...");
      
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 480 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const base64Image = `data:image/jpeg;base64,${manipResult.base64}`;

      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          action: "processImage",
          base64Image
        }));
      } else {
        throw new Error("WebView not ready");
      }
    } catch (error) {
      console.error("Measurement error:", error);
      setErrorMessage(`Measurement failed: ${error.message}`);
      setIsProcessing(false);
      setIsModalVisible(true);
    }
  };

  // Upload to Cloudinary
  const uploadImageToCloudinary = async (uri) => {
    try {
      console.log("Uploading to Cloudinary...");
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: 'image/jpeg' });
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
      formData.append('api_key', CLOUDINARY_API_KEY);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!data.secure_url) {
        throw new Error("Upload failed");
      }

      console.log("Upload successful:", data.secure_url);
      setCloudinaryUrl(data.secure_url);

      // Save to Firebase if available
      if (database && auth.currentUser) {
        const dbReference = dbRef(database, `users/${auth.currentUser.uid}/images/${Date.now()}_${filename}`);
        await set(dbReference, {
          url: data.secure_url,
          uploadedAt: new Date().toISOString(),
        });
      }

      return data.secure_url;
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage(`Upload failed: ${error.message}`);
      return null;
    }
  };

  // Send to YOLO backend
  const sendToBackend = async (imageUrl) => {
    try {
      console.log("Sending to YOLO backend...");
      const response = await fetch('http://192.168.100.18:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      
      const data = await response.json();
      console.log("YOLO response:", data);

      if (data.success) {
        setAnalysisResult(prev => ({
          ...prev,
          height: data.height_ft || "N/A",
          weight: data.weight_kg || "N/A"
        }));
      } else {
        console.warn("YOLO analysis failed:", data.error);
      }
    } catch (error) {
      console.error("YOLO error:", error);
      // Don't set error for YOLO failure, just log it
    }
  };

  // Handle photo capture
  const handleTakePhoto = async () => {
    console.log("Taking photo...");
    setIsProcessing(true);
    setErrorMessage(null);
    setCloudinaryUrl(null);
    setAnalysisResult(null);

    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error("Camera permission required");
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [3, 4],
      });

      if (result.canceled) {
        setIsProcessing(false);
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        throw new Error("No image captured");
      }

      console.log("Image captured, processing...");

      // Process in parallel
      const uploadPromise = uploadImageToCloudinary(uri);
      const measurePromise = measureBodyParts(uri);

      const [cloudinaryUrl] = await Promise.allSettled([uploadPromise, measurePromise]);

      // If upload succeeded, send to YOLO
      if (cloudinaryUrl.status === 'fulfilled' && cloudinaryUrl.value) {
        await sendToBackend(cloudinaryUrl.value);
      }

    } catch (error) {
      console.error("Photo error:", error);
      setErrorMessage(`Photo processing failed: ${error.message}`);
      setIsProcessing(false);
      setIsModalVisible(true);
    }
  };

  // Back button handler
  const backAction = () => {
    if (backClickCount === 1) BackHandler.exitApp();
    else {
      setBackClickCount(1);
      setTimeout(() => setBackClickCount(0), 1000);
    }
    return true;
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [backClickCount]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.whiteColor }}>
      {/* Hidden WebView for MediaPipe */}
      <WebView
        ref={webViewRef}
        source={{ html: mediapipeHtml }}
        style={{ flex: 0, height: 0, width: 0 }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        onError={(error) => {
          console.error("WebView error:", error.nativeEvent.description);
          setIsModelLoading(false);
        }}
      />

      {/* Results Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Body Analysis Results</Text>

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {cloudinaryUrl && (
              <View style={styles.resultRow}>
                <Text style={styles.modalLabel}>Image Uploaded:</Text>
                <Text style={styles.modalText}>✅ Success</Text>
              </View>
            )}

            {analysisResult && (
              <View style={styles.resultsContainer}>
                {/* YOLO Results */}
                <Text style={styles.modalSubtitle}>📏 Physical Measurements</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.modalLabel}>Height:</Text>
                  <Text style={styles.modalText}>
                    {analysisResult.height !== "N/A" ? `${analysisResult.height} ft` : "Not detected"}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.modalLabel}>Weight:</Text>
                  <Text style={styles.modalText}>
                    {analysisResult.weight !== "N/A" ? `${analysisResult.weight} kg` : "Not detected"}
                  </Text>
                </View>

                {/* Muscle Measurements */}
                {analysisResult.measurements && (
                  <>
                    <Text style={styles.modalSubtitle}>💪 Muscle & Body Measurements</Text>
                    
                    {/* Upper Body */}
                    <Text style={styles.sectionTitle}>Upper Body</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💪 Shoulder Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.shoulderWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🏋️ Arm Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.armLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💪 Chest Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.chestWidth}</Text>
                    </View>

                    {/* Six-Pack Area */}
                    <Text style={styles.sectionTitle}>🔥 Six-Pack & Core Area</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🔥 Waist Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.waistWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💥 Abdominal Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.abdominalWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>📏 Abdominal Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.abdominalLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>📐 Torso Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.torsoLength}</Text>
                    </View>

                    {/* Lower Body */}
                    <Text style={styles.sectionTitle}>🦵 Lower Body</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🦵 Hip Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.hipWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💪 Thigh Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.thighLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🏃 Leg Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.legLength}</Text>
                    </View>

                    <Text style={styles.noteText}>
                      💡 Note: Measurements are in relative units. Higher values indicate larger proportions.
                    </Text>
                  </>
                )}
              </View>
            )}

            <Pressable
              style={styles.modalButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Tab Navigation */}
      <Tabs
        screenOptions={{
          tabBarStyle: styles.tabBarStyle,
          headerShown: false,
          tabBarShowLabel: false,
          tabBarButton: (props) => (<Pressable {...props} android_ripple={{ color: Colors.primaryColor, borderless: true }} />),
        }}
      >
        <Tabs.Screen
          name="workout/workoutScreen"
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={focused ? require('../../assets/images/icon/1_active.png') : require('../../assets/images/icon/1.png')}
                style={{ height: 30, width: 30 }}
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
                source={focused ? require('../../assets/images/icon/5_active.png') : require('../../assets/images/icon/5.png')}
                style={{ height: 30, width: 30 }}
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
                source={focused ? require('../../assets/images/icon/2_active.png') : require('../../assets/images/icon/2.png')}
                style={{ height: 30, width: 30 }}
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
                source={focused ? require('../../assets/images/icon/3_active.png') : require('../../assets/images/icon/3.png')}
                style={{ height: 30, width: 30 }}
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
                source={focused ? require('../../assets/images/icon/4_active.png') : require('../../assets/images/icon/4.png')}
                style={{ height: 30, width: 30 }}
                resizeMode="contain"
              />
            ),
          }}
        />
      </Tabs>

      {/* Loading Overlay */}
      {(isProcessing || isModelLoading) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primaryColor} />
            <Text style={styles.loaderText}>
              {isModelLoading ? "🧠 Loading AI Model..." : "📊 Analyzing Body..."}
            </Text>
          </View>
        </View>
      )}

      {/* Camera Button */}
      <Pressable
        style={[styles.cameraButton, isProcessing && styles.cameraButtonDisabled]}
        onPress={handleTakePhoto}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.whiteColor} />
        ) : (
          <Image
            source={require('../../assets/images/icon/camera.png')}
            style={styles.cameraIcon}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarStyle: {
    ...CommonStyles.shadow,
    height: 60,
    backgroundColor: Colors.whiteColor,
    borderTopWidth: 0,
    elevation: 10,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 70,
    right: 20,
    backgroundColor: Colors.primaryColor,
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 1,
  },
  cameraButtonDisabled: {
    backgroundColor: Colors.lightGray,
    opacity: 0.7,
  },
  cameraIcon: {
    height: 35,
    width: 35,
    tintColor: Colors.whiteColor,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingContainer: {
    backgroundColor: Colors.whiteColor,
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    minWidth: 250,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalView: {
    backgroundColor: Colors.whiteColor,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    width: '95%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: Sizes.xLarge,
    fontWeight: 'bold',
    marginBottom: 15,
    color: Colors.blackColor,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: Sizes.large,
    fontWeight: '600',
    marginVertical: 12,
    color: Colors.primaryColor,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    width: '100%',
  },
  sectionTitle: {
    fontSize: Sizes.medium + 1,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    color: Colors.darkGray,
    textAlign: 'center',
    width: '100%',
  },
  modalText: {
    fontSize: Sizes.medium,
    color: Colors.darkGray,
    textAlign: 'right',
    flex: 1,
    fontWeight: '500',
  },
  modalLabel: {
    fontWeight: 'bold',
    color: Colors.blackColor,
    textAlign: 'left',
    flex: 1,
    fontSize: Sizes.medium,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    width: '100%',
  },
  errorText: {
    fontSize: Sizes.medium,
    color: '#c62828',
    textAlign: 'center',
    fontWeight: '500',
  },
  noteText: {
    fontSize: Sizes.small,
    color: Colors.lightGray,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resultsContainer: {
    width: '100%',
    paddingVertical: 5,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
    paddingHorizontal: 5,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    backgroundColor: Colors.primaryColor,
    marginTop: 20,
    elevation: 3,
  },
  modalButtonText: {
    color: Colors.whiteColor,
    fontWeight: 'bold',
    fontSize: Sizes.medium,
    textAlign: 'center',
  },
  loaderText: {
    fontSize: Sizes.medium,
    color: Colors.primaryColor,
    textAlign: 'center',
    marginTop: 15,
    fontWeight: '600',
  },
});