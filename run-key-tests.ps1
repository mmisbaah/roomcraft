Set-Location 'D:\OpenChat\apps\roomcraft_new'
$tests = @('test:coverage', 'test:roomrules')
$iters = 4
$fail = 0
foreach ($t in $tests) {
  for ($i = 1; $i -le $iters; $i++) {
    $out = (& npm run $t 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
      $fail++
      Write-Output "FAIL $t (run $i)"
      $lines = ($out -split "`r?`n") | Where-Object { $_ -match 'BAD|!' }
      Write-Output ($lines | Select-Object -First 25)
    } else {
      $lines = ($out -split "`r?`n") | Where-Object { $_.Trim() -ne '' }
      Write-Output "PASS $t run $i :: $($lines[-1])"
    }
  }
}
Write-Output "failures: $fail"
exit $fail
