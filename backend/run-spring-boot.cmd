@echo off
setlocal

REM Run Spring Boot from an ASCII-only subst drive to avoid Unicode path issues with @argfile on Windows.
set "TARGET_DIR=%~dp0"
set "DRIVE=M"

REM Pick a free drive letter (M, then N, then O)
for %%D in (M N O) do (
  if not exist %%D:\NUL (
    set "DRIVE=%%D"
    goto :driveChosen
  )
)

:driveChosen

REM Create the subst drive
cmd /c subst %DRIVE%: "%TARGET_DIR%"

REM Run from the subst drive so all resolved paths are ASCII-only (e.g. M:\...)
pushd %DRIVE%:\
call .\mvnw.cmd -DskipTests spring-boot:run
set "EXIT_CODE=%ERRORLEVEL%"
popd

REM Best-effort cleanup (won't work while the app is still running)
cmd /c subst %DRIVE%: /d >NUL 2>&1

exit /b %EXIT_CODE%
