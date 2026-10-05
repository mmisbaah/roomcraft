param([int]$N = 3)
Set-Location 'D:\OpenChat\apps\roomcraft_new'
for ($i = 1; $i -le $N; $i++) {
  $out = (& npm run test:coverage 2>&1 | Out-String)
  $lines = ($out -split "`r?`n") | Where-Object { $_ -match 'entryway|BAD|PASSED' }
  Write-Output "=== run $i ==="
  $lines | ForEach-Object { Write-Output $_ }
}
