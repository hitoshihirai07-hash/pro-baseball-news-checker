$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$outputDir = Join-Path $projectRoot 'CleanUP\release'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$packagePath = Join-Path $outputDir ('pro-baseball-news-checker-github-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
$launcherName = [string][char]0x8D77 + [char]0x52D5 + '.cmd'
$includeNames = @('public','src','scripts','package.json','package-lock.json','wrangler.jsonc','.gitignore','README.md',$launcherName)
$includePaths = foreach ($includeName in $includeNames) {
  $includePath = Join-Path $projectRoot $includeName
  if (Test-Path -LiteralPath $includePath) { $includePath }
}
Compress-Archive -LiteralPath $includePaths -DestinationPath $packagePath -CompressionLevel Optimal
Write-Output $packagePath
