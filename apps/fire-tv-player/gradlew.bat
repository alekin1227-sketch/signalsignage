@echo off
setlocal
set "GRADLE_VERSION=8.9"
set "GRADLE_DIR=%USERPROFILE%\.gradle\corporate-signage\gradle-%GRADLE_VERSION%"
set "GRADLE_ZIP=%TEMP%\corporate-signage-gradle-%GRADLE_VERSION%.zip"

if not exist "%GRADLE_DIR%\bin\gradle.bat" (
  echo Baixando Gradle %GRADLE_VERSION% pela primeira vez...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest 'https://services.gradle.org/distributions/gradle-8.9-bin.zip' -OutFile '%GRADLE_ZIP%'; New-Item -ItemType Directory -Force -Path '%USERPROFILE%\.gradle\corporate-signage' | Out-Null; Expand-Archive -Force '%GRADLE_ZIP%' '%USERPROFILE%\.gradle\corporate-signage'; Remove-Item -Force '%GRADLE_ZIP%'"
  if errorlevel 1 exit /b 1
)

call "%GRADLE_DIR%\bin\gradle.bat" %*
exit /b %ERRORLEVEL%
