
Param(
  [string]$TargetDir = "HR/assets/fonts"
)

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

Write-Host "Downloading Inter Variable (roman) ..."
Invoke-WebRequest -Uri "https://rsms.me/inter/font-files/Inter-roman.var.woff2" -OutFile "$TargetDir/Inter-Variable.woff2"

Write-Host "Downloading Inter Variable (italic) ..."
Invoke-WebRequest -Uri "https://rsms.me/inter/font-files/Inter-italic.var.woff2" -OutFile "$TargetDir/Inter-Variable-Italic.woff2"

Write-Host "Downloading license (OFL.txt) ..."
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/rsms/inter/master/OFL.txt" -OutFile "$TargetDir/OFL.txt"

Write-Host "Done. Files saved to $TargetDir"
Get-ChildItem -Path $TargetDir | Format-Table Name, Length
