# Camera App - React Native Expo CLI

A simple React Native app built with Expo CLI that demonstrates camera functionality with proper permission handling.

## Features

- **Camera Icon Button**: Tap the camera icon to access the camera
- **Permission Handling**: App requests camera permissions when needed
- **Permission Denied Handling**: If user denies permission, app shows an alert and returns to main screen
- **Take Photos**: Capture photos using the camera interface
- **Camera Controls**: 
  - Back button to return to main screen
  - Flip camera button to switch between front and rear cameras
  - Large capture button to take photos
- **Photo Preview**: View the last captured photo on the main screen

## App Flow

1. **Main Screen**: Shows the app title and a blue camera icon button
2. **Camera Icon Tap**: When tapped, app checks for camera permissions
3. **Permission Request**: If not granted, app requests permission from user
4. **Permission Granted**: Camera interface opens with controls
5. **Permission Denied**: Alert is shown and user stays on main screen
6. **Take Photo**: Use the white capture button to take a photo
7. **Photo Taken**: Returns to main screen and displays the captured image

## How to Run

1. Make sure you have Expo CLI installed:
   ```bash
   npm install -g @expo/cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   # or
   expo start
   ```

4. Run on device/simulator:
   ```bash
   npm run android    # For Android
   npm run ios        # For iOS (requires macOS)
   npm run web        # For web browser
   ```

## Dependencies

- `expo-camera`: For camera functionality and permissions
- `@expo/vector-icons`: For camera and UI icons
- React Native core components

## Permissions

The app automatically handles the following permissions:
- **Camera Access**: Required to take photos
- **Microphone Access**: Required for video recording (if needed in future)

## SDK Version

Built with Expo SDK 53 (compatible with SDK 52+ features)

## Platform Support

- ✅ iOS
- ✅ Android
- ✅ Web (with webcam support)

## Notes

- The app uses the new `CameraView` component from expo-camera
- All permissions are handled gracefully with user-friendly alerts
- The UI is designed to be intuitive and modern
- Photos are stored temporarily and displayed on the main screen