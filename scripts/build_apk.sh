#!/bin/bash
# SLD Android APK Build & Packaging Script

echo "📱 Packaging SLD Android APK..."

PROJECT_DIR="/home/cluadia/Projects/SLD"
APK_OUTPUT="$PROJECT_DIR/SLD.apk"

cd "$PROJECT_DIR" || exit 1

# Ensure version.json contains current build timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "main")

cat <<EOF > version.json
{
  "version": "1.2.0",
  "buildTime": "$BUILD_TIME",
  "commit": "$COMMIT_HASH"
}
EOF

# Create temporary staging directory for APK structure
STAGING_DIR="/tmp/sld_apk_staging"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/assets"
mkdir -p "$STAGING_DIR/META-INF"

# Copy WebApp bundle into assets
cp -r index.html js css media manifest.json sw.js version.json "$STAGING_DIR/assets/" 2>/dev/null || true

# Copy basic Android Manifest XML
cat <<EOF > "$STAGING_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.sld.app"
    android:versionCode="120"
    android:versionName="1.2.0">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <application
        android:allowBackup="true"
        android:icon="@assets/media/title-icon.png"
        android:label="SLD"
        android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen">
        <activity
            android:name="com.sld.app.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# Package into SLD.apk zip archive
cd "$STAGING_DIR"
zip -r9 "$APK_OUTPUT" AndroidManifest.xml assets/ META-INF/ > /dev/null

echo "✅ Generated $APK_OUTPUT successfully!"
ls -lh "$APK_OUTPUT"
