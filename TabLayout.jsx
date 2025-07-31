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
  const maxRetries = 3;
  let retryCount = 0;

  const CLOUDINARY_CLOUD_NAME = "dp3yktx6o";
  const CLOUDINARY_UPLOAD_PRESET = "my_upload_preset";
  const CLOUDINARY_API_KEY = "667625573425965";

  // Enhanced MediaPipe PoseLandmarker HTML with better initialization and muscle measurements
  const mediapipeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MediaPipe PoseLandmarker</title>
    </head>
    <body>
      <script type="module">
        console.log("Starting enhanced MediaPipe initialization...");
        
        let poseLandmarker = null;
        let isInitialized = false;
        
        // Import MediaPipe modules
        async function loadMediaPipe() {
          try {
            // Load from CDN with fallback
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.27/vision_bundle.js';
            script.onload = initializePoseLandmarker;
            script.onerror = () => {
              console.error("Failed to load MediaPipe script");
              window.ReactNativeWebView?.postMessage(JSON.stringify({ 
                status: "error", 
                message: "Failed to load MediaPipe library" 
              }));
            };
            document.head.appendChild(script);
          } catch (error) {
            console.error("Error loading MediaPipe:", error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "error", 
              message: "MediaPipe loading error: " + error.message 
            }));
          }
        }
        
        async function initializePoseLandmarker() {
          try {
            console.log("Initializing MediaPipe PoseLandmarker...");
            
            // Wait for MediaPipe to be available
            let attempts = 0;
            while (!window.MediaPipeTasksVision && attempts < 50) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
            
            if (!window.MediaPipeTasksVision) {
              throw new Error("MediaPipe not available after waiting");
            }
            
            const { PoseLandmarker, FilesetResolver } = window.MediaPipeTasksVision;
            
            console.log("Creating vision fileset...");
            const vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.27/wasm"
            );
            
            console.log("Creating PoseLandmarker...");
            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
              },
              runningMode: "IMAGE",
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5
            });
            
            isInitialized = true;
            console.log("MediaPipe PoseLandmarker initialized successfully!");
            window.ReactNativeWebView?.postMessage(JSON.stringify({ status: "initialized" }));
            
          } catch (error) {
            console.error("MediaPipe initialization failed:", error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "error", 
              message: "Initialization failed: " + error.message 
            }));
          }
        }
        
        // Calculate distance between two points
        function calculateDistance(point1, point2) {
          const dx = point1.x - point2.x;
          const dy = point1.y - point2.y;
          return Math.sqrt(dx * dx + dy * dy);
        }
        
        // Calculate muscle mass indicator based on pose landmarks
        function calculateMuscleMetrics(landmarks) {
          const keypoints = landmarks[0];
          
          // Key pose landmarks for muscle measurements
          const leftShoulder = keypoints[11];   // Left shoulder
          const rightShoulder = keypoints[12];  // Right shoulder
          const leftElbow = keypoints[13];      // Left elbow
          const rightElbow = keypoints[14];     // Right elbow
          const leftWrist = keypoints[15];      // Left wrist
          const rightWrist = keypoints[16];     // Right wrist
          const leftHip = keypoints[23];        // Left hip
          const rightHip = keypoints[24];       // Right hip
          const leftKnee = keypoints[25];       // Left knee
          const rightKnee = keypoints[26];      // Right knee
          const leftAnkle = keypoints[27];      // Left ankle
          const rightAnkle = keypoints[28];     // Right ankle
          
          // Chest/Pectoral measurements (shoulder to center chest estimation)
          const chestCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2 + 0.1 // Slightly below shoulders
          };
          
          // Upper arm measurements (shoulder to elbow distance as muscle indicator)
          const leftUpperArmLength = calculateDistance(leftShoulder, leftElbow);
          const rightUpperArmLength = calculateDistance(rightShoulder, rightElbow);
          const avgUpperArmLength = (leftUpperArmLength + rightUpperArmLength) / 2;
          
          // Forearm measurements (elbow to wrist)
          const leftForearmLength = calculateDistance(leftElbow, leftWrist);
          const rightForearmLength = calculateDistance(rightElbow, rightWrist);
          const avgForearmLength = (leftForearmLength + rightForearmLength) / 2;
          
          // Shoulder width (muscle breadth indicator)
          const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);
          
          // Torso measurements for core/six-pack area
          const hipWidth = calculateDistance(leftHip, rightHip);
          const torsoLength = calculateDistance(
            { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 },
            { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
          );
          
          // Six-pack/abdominal area calculations
          const abdominalCenter = {
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2 - (torsoLength * 0.3) // 30% up from hips
          };
          
          // Waist estimation (narrower than hips, between chest and hips)
          const waistWidth = hipWidth * 0.85; // Estimate waist as 85% of hip width
          
          // Leg muscle measurements
          const leftThighLength = calculateDistance(leftHip, leftKnee);
          const rightThighLength = calculateDistance(rightHip, rightKnee);
          const avgThighLength = (leftThighLength + rightThighLength) / 2;
          
          const leftCalfLength = calculateDistance(leftKnee, leftAnkle);
          const rightCalfLength = calculateDistance(rightKnee, rightAnkle);
          const avgCalfLength = (leftCalfLength + rightCalfLength) / 2;
          
          // Convert to relative measurements (multiply by 1000 for better readability)
          return {
            // Upper body muscle measurements
            shoulderWidth: (shoulderWidth * 1000).toFixed(1),
            upperArmLength: (avgUpperArmLength * 1000).toFixed(1),
            forearmLength: (avgForearmLength * 1000).toFixed(1),
            chestWidth: (shoulderWidth * 0.9 * 1000).toFixed(1), // Estimate chest as 90% of shoulder width
            
            // Core/Six-pack measurements
            waistWidth: (waistWidth * 1000).toFixed(1),
            abdominalWidth: (waistWidth * 1000).toFixed(1),
            torsoLength: (torsoLength * 1000).toFixed(1),
            
            // Lower body muscle measurements
            hipWidth: (hipWidth * 1000).toFixed(1),
            thighLength: (avgThighLength * 1000).toFixed(1),
            calfLength: (avgCalfLength * 1000).toFixed(1),
            
            // Overall body proportions
            legLength: ((avgThighLength + avgCalfLength) * 1000).toFixed(1),
            totalHeight: ((torsoLength + avgThighLength + avgCalfLength) * 1000).toFixed(1)
          };
        }
        
        async function processImage(base64Image) {
          try {
            console.log("Processing image for pose detection...");
            
            if (!isInitialized || !poseLandmarker) {
              throw new Error("PoseLandmarker not initialized");
            }
            
            // Create image element
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            await new Promise((resolve, reject) => {
              img.onload = () => {
                console.log("Image loaded successfully, dimensions:", img.width, "x", img.height);
                resolve();
              };
              img.onerror = (error) => {
                console.error("Failed to load image:", error);
                reject(new Error("Failed to load image"));
              };
              img.src = base64Image;
            });
            
            console.log("Detecting pose landmarks...");
            const results = poseLandmarker.detect(img);
            
            console.log("Pose detection results:", results);
            
            if (!results.landmarks || results.landmarks.length === 0) {
              throw new Error("No pose detected in the image");
            }
            
            const landmarks = results.landmarks;
            console.log("Number of poses detected:", landmarks.length);
            
            // Calculate enhanced muscle measurements
            const muscleMetrics = calculateMuscleMetrics(landmarks);
            console.log("Calculated muscle metrics:", muscleMetrics);
            
            // Check if key landmarks are visible with good confidence
            const keypoints = landmarks[0];
            const requiredPoints = [11, 12, 23, 24, 25, 26]; // shoulders, hips, knees
            const minConfidence = 0.5;
            
            const visiblePoints = requiredPoints.filter(index => 
              keypoints[index] && keypoints[index].visibility > minConfidence
            );
            
            if (visiblePoints.length < 4) {
              throw new Error(`Insufficient pose landmarks detected. Only ${visiblePoints.length}/6 key points visible.`);
            }
            
            console.log("Pose analysis completed successfully");
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "success", 
              measurements: muscleMetrics,
              confidence: visiblePoints.length / requiredPoints.length
            }));
            
          } catch (error) {
            console.error("Image processing error:", error);
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
            console.log("Received message:", data.action);
            
            if (data.action === "initialize") {
              if (isInitialized) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ status: "initialized" }));
              } else {
                loadMediaPipe();
              }
            } else if (data.action === "processImage") {
              processImage(data.base64Image);
            }
          } catch (error) {
            console.error("Message handling error:", error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              status: "error", 
              message: "Message handling failed: " + error.message 
            }));
          }
        });
        
        // Auto-initialize when ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', loadMediaPipe);
        } else {
          loadMediaPipe();
        }
        
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
        console.error("Verification error:", error.code, error.message, error.stack);
        setErrorMessage(`Verification: ${error.message}`);
        router.replace('/LoginScreen');
      }
    };
    checkVerification();
  }, [router]);

  // Initialize WebView with improved retry logic
  useEffect(() => {
    console.log("Initializing WebView...");
    const initializeWithRetry = () => {
      if (webViewRef.current) {
        console.log("Posting initialize message to WebView");
        webViewRef.current.postMessage(JSON.stringify({ action: "initialize" }));
      } else {
        console.error("WebView ref not ready");
        if (retryCount < maxRetries) {
          retryCount += 1;
          console.log(`Retrying WebView initialization (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(initializeWithRetry, 2000);
        } else {
          setErrorMessage("WebView initialization failed");
          setIsModelLoading(false);
          setIsModalVisible(true);
        }
      }
    };

    // Give WebView time to load
    const timer = setTimeout(initializeWithRetry, 1000);
    
    // Timeout for initialization
    const timeout = setTimeout(() => {
      if (isModelLoading && retryCount < maxRetries) {
        retryCount += 1;
        console.log(`Retrying MediaPipe initialization (attempt ${retryCount}/${maxRetries})...`);
        initializeWithRetry();
      } else if (isModelLoading) {
        setIsModelLoading(false);
        setErrorMessage("MediaPipe initialization timeout");
        console.error("MediaPipe initialization failed after retries");
        setIsModalVisible(true);
      }
    }, 15000); // Increased timeout to 15s
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, []);

  // Handle WebView messages with better error handling
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("WebView message received:", data);
      
      if (data.status === "initialized") {
        setIsModelLoading(false);
        retryCount = 0;
        setErrorMessage(null);
        console.log("MediaPipe PoseLandmarker initialized successfully");
      } else if (data.status === "success") {
        setAnalysisResult(prev => ({ 
          ...prev, 
          measurements: data.measurements,
          confidence: data.confidence 
        }));
        setIsProcessing(false);
        console.log("Enhanced measurements received:", data.measurements);
        setIsModalVisible(true);
      } else if (data.status === "error") {
        const errorMsg = `MediaPipe: ${data.message}`;
        setErrorMessage(prev => prev ? `${prev}, ${errorMsg}` : errorMsg);
        setIsProcessing(false);
        setIsModelLoading(false);
        console.error("WebView error:", data.message);
        setIsModalVisible(true);
      }
    } catch (error) {
      console.error("WebView message handling error:", error.message, error.stack);
      const errorMsg = `WebView: ${error.message}`;
      setErrorMessage(prev => prev ? `${prev}, ${errorMsg}` : errorMsg);
      setIsProcessing(false);
      setIsModelLoading(false);
      setIsModalVisible(true);
    }
  };

  // Process image for measurements
  const measureBodyParts = async (imageUri) => {
    console.log("Starting enhanced image processing...");
    try {
      if (isModelLoading) {
        throw new Error("MediaPipe model is still loading. Please wait.");
      }

      console.log("Resizing image for processing...");
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 640 } }], // Increased resolution for better accuracy
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      console.log("Image resized, base64 length:", manipResult.base64?.length);
      const base64Image = `data:image/jpeg;base64,${manipResult.base64}`;
      
      if (webViewRef.current && !isModelLoading) {
        console.log("Sending enhanced image to WebView for muscle analysis...");
        webViewRef.current.postMessage(JSON.stringify({
          action: "processImage",
          base64Image
        }));
      } else {
        throw new Error("WebView not ready or model still loading");
      }
    } catch (error) {
      console.error("Enhanced image processing error:", error.message, error.stack);
      const errorMsg = `Image processing: ${error.message}`;
      setErrorMessage(prev => prev ? `${prev}, ${errorMsg}` : errorMsg);
      setIsProcessing(false);
      setIsModalVisible(true);
    }
  };

  // Upload image to Cloudinary and save URL to Firebase Realtime Database
  const uploadImageToCloudinary = async (uri) => {
    console.log("Starting Cloudinary upload...");
    try {
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      console.log("Preparing FormData, filename:", filename);
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: 'image/jpeg' });
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
      formData.append('api_key', CLOUDINARY_API_KEY);

      console.log("Uploading to Cloudinary...");
      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
        timeout: 15000,
      });
      const cloudinaryData = await cloudinaryResponse.json();
      if (!cloudinaryData.secure_url) {
        throw new Error("Cloudinary upload failed: " + (cloudinaryData.error?.message || "Unknown error"));
      }

      console.log("SUCCESS: Cloudinary upload complete, URL:", cloudinaryData.secure_url);
      setCloudinaryUrl(cloudinaryData.secure_url);

      if (database && auth.currentUser) {
        console.log("Saving URL to Firebase Realtime Database...");
        const dbReference = dbRef(database, `users/${auth.currentUser.uid}/images/${Date.now()}_${filename}`);
        await set(dbReference, {
          url: cloudinaryData.secure_url,
          uploadedAt: new Date().toISOString(),
        });
        console.log("SUCCESS: Firebase Realtime Database updated");
      } else {
        console.warn("Firebase Realtime Database not initialized, skipping URL storage");
        setErrorMessage(prev => prev ? `${prev}, Firebase: Realtime Database not initialized` : "Firebase: Realtime Database not initialized");
      }

      return cloudinaryData.secure_url;
    } catch (error) {
      console.error("Cloudinary upload error:", error.message, error.stack);
      setErrorMessage(prev => prev ? `${prev}, Cloudinary: ${error.message}` : `Cloudinary: ${error.message}`);
      setIsProcessing(false);
      setIsModalVisible(true);
      return null;
    }
  };

  // Send to YOLO backend
  const sendToBackend = async (imageUrl) => {
    console.log("Sending to YOLO backend:", imageUrl);
    try {
      console.log("Making POST request to YOLO...");
      const response = await fetch('http://192.168.100.18:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
        timeout: 15000,
      });
      const data = await response.json();
      console.log("YOLO backend response:", data);

      if (data.success) {
        setAnalysisResult(prev => ({
          ...prev,
          height: data.height_ft || "N/A",
          weight: data.weight_kg || "N/A"
        }));
        console.log("YOLO results stored:", { height: data.height_ft, weight: data.weight_kg });
      } else {
        throw new Error(data.error || "Backend analysis failed");
      }
    } catch (err) {
      console.error("YOLO backend error:", err.message, err.stack);
      setErrorMessage(prev => prev ? `${prev}, YOLO: ${err.message}` : `YOLO: ${err.message}`);
      setIsProcessing(false);
      setIsModalVisible(true);
    }
  };

  // Handle photo capture with improved flow
  const handleTakePhoto = async () => {
    console.log("Camera button pressed");
    setIsProcessing(true);
    setErrorMessage(null);
    setCloudinaryUrl(null);
    setAnalysisResult(null);
    
    try {
      if (isModelLoading) {
        throw new Error("Please wait for the analysis model to finish loading before taking a photo.");
      }

      console.log("Requesting camera permissions...");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error("Camera permission is required to analyze your body measurements.");
      }
      console.log("Camera permissions granted");

      console.log("Launching camera...");
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8, // Higher quality for better analysis
        aspect: [3, 4], // Portrait aspect ratio for full body shots
      });

      console.log("Camera result:", result.canceled ? "canceled" : "image captured");
      if (result.canceled) {
        setIsProcessing(false);
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        throw new Error("Could not capture the image. Please try again.");
      }
      console.log("Image captured successfully, URI:", uri);

      // Process both Cloudinary upload and MediaPipe analysis
      console.log("Starting parallel processing: Cloudinary upload + MediaPipe analysis...");
      const [cloudinaryUrl] = await Promise.allSettled([
        uploadImageToCloudinary(uri),
        measureBodyParts(uri)
      ]);

      // Process YOLO if Cloudinary upload succeeded
      if (cloudinaryUrl.status === 'fulfilled' && cloudinaryUrl.value) {
        console.log("Starting YOLO analysis...");
        await sendToBackend(cloudinaryUrl.value);
      }

    } catch (err) {
      console.error("Photo handling error:", err.message, err.stack);
      setErrorMessage(`Photo processing failed: ${err.message}`);
      setIsProcessing(false);
      setIsModalVisible(true);
    }
  };

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
      <WebView
        ref={webViewRef}
        source={{ html: mediapipeHtml }}
        style={{ flex: 0, height: 0, width: 0 }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={false} // Disable cache for development
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("WebView error:", nativeEvent.description, nativeEvent);
          setErrorMessage(prev => prev ? `${prev}, WebView: ${nativeEvent.description}` : `WebView: ${nativeEvent.description}`);
          setIsModelLoading(false);
          setIsProcessing(false);
          setIsModalVisible(true);
        }}
        onLoadEnd={() => {
          console.log("WebView loaded successfully");
        }}
        onLoadStart={() => {
          console.log("WebView started loading");
        }}
      />
      
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Enhanced Body Analysis Results</Text>
            
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
                <Text style={styles.modalSubtitle}>🏋️ Physical Measurements</Text>
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

                {/* Enhanced Muscle Measurements */}
                {analysisResult.measurements && (
                  <>
                    <Text style={styles.modalSubtitle}>💪 Muscle & Body Measurements</Text>
                    <Text style={styles.confidenceText}>
                      Analysis Confidence: {((analysisResult.confidence || 0.8) * 100).toFixed(0)}%
                    </Text>
                    
                    {/* Upper Body Muscles */}
                    <Text style={styles.sectionTitle}>Upper Body</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💪 Shoulder Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.shoulderWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🏋️ Upper Arm Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.upperArmLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💪 Forearm Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.forearmLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🏋️ Chest Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.chestWidth}</Text>
                    </View>

                    {/* Core/Six-Pack Area */}
                    <Text style={styles.sectionTitle}>Core & Six-Pack Area</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🔥 Waist Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.waistWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💥 Abdominal Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.abdominalWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>📏 Torso Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.torsoLength}</Text>
                    </View>

                    {/* Lower Body Muscles */}
                    <Text style={styles.sectionTitle}>Lower Body</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🦵 Hip Width:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.hipWidth}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>💪 Thigh Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.thighLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>🏃 Calf Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.calfLength}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.modalLabel}>📐 Total Leg Length:</Text>
                      <Text style={styles.modalText}>{analysisResult.measurements.legLength}</Text>
                    </View>

                    <Text style={styles.noteText}>
                      💡 Note: Measurements are in relative units based on pose landmarks. 
                      Higher values indicate larger muscle proportions.
                    </Text>
                  </>
                )}
              </View>
            )}
            
            <Pressable
              style={styles.modalButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close Analysis</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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

      {(isProcessing || isModelLoading) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primaryColor} />
            <Text style={styles.loaderText}>
              {isModelLoading ? "🧠 Loading AI Analysis Model..." : "📊 Analyzing Your Body Measurements..."}
            </Text>
            {isModelLoading && (
              <Text style={styles.loaderSubText}>
                This may take a few moments on first load
              </Text>
            )}
          </View>
        </View>
      )}

      <Pressable
        style={[styles.cameraButton, (isProcessing || isModelLoading) && styles.cameraButtonDisabled]}
        onPress={handleTakePhoto}
        disabled={isProcessing || isModelLoading}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.whiteColor} />
        ) : (
          <Image
            source={require('../../assets/images/icon/camera.png')}
            style={[styles.cameraIcon, (isProcessing || isModelLoading) && { opacity: 0.5 }]}
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
  confidenceText: {
    fontSize: Sizes.small,
    color: Colors.primaryColor,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
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
  loaderSubText: {
    fontSize: Sizes.small,
    color: Colors.lightGray,
    textAlign: 'center',
    marginTop: 8,
  },
});