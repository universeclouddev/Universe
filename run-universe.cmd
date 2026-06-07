@echo off
REM Run Universe master from the repository root (Windows).
cd /d "%~dp0"

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

"%JAVA_HOME%\bin\java.exe" ^
  --add-modules=java.se ^
  --add-exports=java.base/jdk.internal.ref=ALL-UNNAMED ^
  --add-opens=java.base/java.time=ALL-UNNAMED ^
  --add-opens=java.base/java.net=ALL-UNNAMED ^
  --add-opens=java.base/java.io=ALL-UNNAMED ^
  --add-opens=java.base/java.lang=ALL-UNNAMED ^
  --add-opens=java.base/java.nio=ALL-UNNAMED ^
  --add-opens=java.base/sun.nio.ch=ALL-UNNAMED ^
  --add-opens=java.management/sun.management=ALL-UNNAMED ^
  --add-opens=jdk.management/com.sun.management.internal=ALL-UNNAMED ^
  --enable-native-access=ALL-UNNAMED ^
  -jar loader\build\libs\universe.jar