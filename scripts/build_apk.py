#!/usr/bin/env python3
import os
import sys
import shutil
import zipfile
import subprocess

PROJECT_DIR = "/home/cluadiacapella/Projects/SLD"
BUILD_TOOLS_DIR = "/home/cluadiacapella/Android/Sdk/build-tools/36.0.0"
ZIPALIGN = os.path.join(BUILD_TOOLS_DIR, "zipalign")
APKSIGNER = os.path.join(BUILD_TOOLS_DIR, "apksigner")
KEYSTORE = "/home/cluadiacapella/.config/.android/debug.keystore"
KEYSTORE_PASS = "android"
KEY_ALIAS = "androiddebugkey"

TARGET_APK = os.path.join(PROJECT_DIR, "SLD.apk")
UNALIGNED_APK = os.path.join(PROJECT_DIR, "SLD_unaligned.apk")
ALIGNED_APK = os.path.join(PROJECT_DIR, "SLD_aligned.apk")
BACKUP_APK = os.path.join(PROJECT_DIR, ".SLD.apk.template")

def build_apk():
    print("=== SLD Android APK Automated Build Pipeline ===")
    
    if not os.path.exists(TARGET_APK) and not os.path.exists(BACKUP_APK):
        print(f"Error: Target APK {TARGET_APK} not found.")
        sys.exit(1)
        
    if not os.path.exists(BACKUP_APK):
        shutil.copy2(TARGET_APK, BACKUP_APK)
        print(f"Saved base APK template to {BACKUP_APK}")

    # Build fresh unaligned ZIP
    print("Updating web application assets inside APK container...")
    with zipfile.ZipFile(BACKUP_APK, 'r') as in_zip:
        with zipfile.ZipFile(UNALIGNED_APK, 'w', compression=zipfile.ZIP_DEFLATED) as out_zip:
            # First copy non-asset container items (AndroidManifest.xml, res/, resources.arsc, META-INF, etc.)
            for item in in_zip.infolist():
                if not item.filename.startswith("assets/") and not item.filename.startswith("META-INF/"):
                    content = in_zip.read(item.filename)
                    out_zip.writestr(item, content)

            # Map project files to assets/
            files_to_pack = []
            for root, dirs, files in os.walk(PROJECT_DIR):
                # Ignore git, scratch, temporary files
                if '.git' in root or '.gemini' in root or 'node_modules' in root or 'scratch' in root or 'scripts' in root:
                    continue
                for file in files:
                    if file in ['SLD.apk', 'SLD_unaligned.apk', 'SLD_aligned.apk', 'SLD.apk.idsig', 'SLD_aligned.apk.idsig', '.SLD.apk.template']:
                        continue
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, PROJECT_DIR)
                    asset_path = f"assets/{rel_path}".replace('\\', '/')
                    files_to_pack.append((full_path, asset_path))

            for full_path, asset_path in files_to_pack:
                out_zip.write(full_path, asset_path)

    print(f"Updated {len(files_to_pack)} asset files in unaligned APK.")

    # Run zipalign
    print("Running zipalign alignment...")
    if os.path.exists(ALIGNED_APK):
        os.remove(ALIGNED_APK)
        
    cmd_align = [ZIPALIGN, "-f", "-p", "4", UNALIGNED_APK, ALIGNED_APK]
    res_align = subprocess.run(cmd_align, capture_output=True, text=True)
    if res_align.returncode != 0:
        print(f"Error running zipalign: {res_align.stderr}")
        sys.exit(1)

    # Run apksigner
    print("Signing APK with debug keystore (v2/v3 scheme)...")
    cmd_sign = [
        APKSIGNER, "sign",
        "--ks", KEYSTORE,
        "--ks-pass", f"pass:{KEYSTORE_PASS}",
        "--ks-key-alias", KEY_ALIAS,
        "--key-pass", f"pass:{KEYSTORE_PASS}",
        "--out", TARGET_APK,
        ALIGNED_APK
    ]
    res_sign = subprocess.run(cmd_sign, capture_output=True, text=True)
    if res_sign.returncode != 0:
        print(f"Error signing APK: {res_sign.stderr}")
        sys.exit(1)

    # Clean up temporary build artifacts
    if os.path.exists(UNALIGNED_APK):
        os.remove(UNALIGNED_APK)

    # Verify APK signature
    print("Verifying APK signature...")
    cmd_verify = [APKSIGNER, "verify", "-v", TARGET_APK]
    res_verify = subprocess.run(cmd_verify, capture_output=True, text=True)
    if "Verified using v2 scheme (APK Signature Scheme v2): true" in res_verify.stdout:
        print("SUCCESS: SLD.apk successfully built, aligned, and signed!")
    else:
        print("Warning: APK verification output:")
        print(res_verify.stdout)

if __name__ == "__main__":
    build_apk()
