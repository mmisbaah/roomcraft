Set-Location 'D:\OpenChat\apps\roomcraft_new'
$tests = @('test:placement','test:walls','test:rooms','test:presets','test:rules',
           'test:coverage','test:roomrules','test:grab','test:enclose','test:wallroom')
$fail = 0
foreach ($t in $tests) {
  $out = (& npm run $t 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    $fail++
    Write-Output "FAIL $t"
    Write-Output $out
  } else {
    $lines = ($out -split "`r?`n") | Where-Object { $_.Trim() -ne '' }
    Write-Output "PASS $t :: $($lines[-1])"
  }
}
Write-Output "failures: $fail"
exit $fail
