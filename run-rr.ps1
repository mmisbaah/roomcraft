param([int]$N = 6)
Set-Location 'D:\OpenChat\apps\roomcraft_new'
$fail = 0
for ($i = 1; $i -le $N; $i++) {
  $out = (& npm run test:roomrules 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    $fail++
    $lines = ($out -split "`r?`n") | Where-Object { $_ -match 'BAD' }
    Write-Output "FAIL run $i :: $($lines -join ' | ')"
  } else {
    Write-Output "PASS run $i"
  }
}
Write-Output "failures: $fail of $N"
