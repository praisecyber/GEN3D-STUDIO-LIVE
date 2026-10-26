Unicode true
RequestExecutionLevel user
Name "GEN3D Studio Live"
InstallDir "$LOCALAPPDATA\Programs\GEN3DStudioLive"
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Section "Install"
  SetOutPath "$INSTDIR"
!ifdef NSIS_WIN32_MAKENSIS
  File /r "${PROJECT_DIR}\release\win-unpacked\*"
!else
  File /r "${PROJECT_DIR}/release/win-unpacked/*"
!endif
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\GEN3D Studio Live.lnk" "$INSTDIR\GEN3D Studio Live.exe"
  CreateShortcut "$SMPROGRAMS\GEN3D Studio Live.lnk" "$INSTDIR\GEN3D Studio Live.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GEN3DStudioLive" "DisplayName" "GEN3D Studio Live"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GEN3DStudioLive" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GEN3DStudioLive" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GEN3DStudioLive" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GEN3DStudioLive" "NoRepair" 1
SectionEnd
Section "Uninstall"
  Delete "$DESKTOP\GEN3D Studio Live.lnk"
  Delete "$SMPROGRAMS\GEN3D Studio Live.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GEN3DStudioLive"
SectionEnd
