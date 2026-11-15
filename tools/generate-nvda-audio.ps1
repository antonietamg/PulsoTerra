param([string]$Ffmpeg = 'ffmpeg')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$content = Get-Content -LiteralPath (Join-Path $projectRoot 'docs/audio-guide-scripts.json') -Raw -Encoding utf8 | ConvertFrom-Json
$outDir = Join-Path $projectRoot 'dist/assets/instructions'
$tempDir = Join-Path $projectRoot 'qa/nvda-audio'
New-Item -ItemType Directory -Force -Path $outDir,$tempDir | Out-Null
$records = @()
foreach ($locale in @('en','es')) {
  $entry = $content.$locale
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $synth.SelectVoice($entry.voice)
    $synth.Rate = -1
    $synth.Volume = 100
    $wav = Join-Path $tempDir ('nvda-' + $locale + '.wav')
    $mp3 = Join-Path $outDir ('nvda-' + $locale + '.mp3')
    $synth.SetOutputToWaveFile($wav)
    $prompt = New-Object System.Speech.Synthesis.PromptBuilder
    foreach ($paragraph in $entry.paragraphs) {
      $prompt.AppendText($paragraph)
      $prompt.AppendBreak([TimeSpan]::FromMilliseconds(550))
    }
    $synth.Speak($prompt)
    $synth.SetOutputToNull()
    & $Ffmpeg -hide_banner -loglevel error -y -i $wav -af 'loudnorm=I=-18:TP=-2:LRA=7' -ar 44100 -ac 1 -codec:a libmp3lame -b:a 96k $mp3
    if ($LASTEXITCODE -ne 0) { throw 'Audio encoding failed.' }
    $records += [ordered]@{language=$entry.language;voice=$entry.voice;file=('nvda-'+$locale+'.mp3');sha256=(Get-FileHash -LiteralPath $mp3 -Algorithm SHA256).Hash.ToLower();bytes=(Get-Item -LiteralPath $mp3).Length;method='Local Windows System.Speech synthesis; rate -1; mono MP3 44.1 kHz/96 kbps; loudness target -18 LUFS, true peak -2 dBTP';transcript='docs/audio-guide-scripts.json';kind='Synthetic speech, not a recording of a team member'}
  } finally { $synth.Dispose() }
}
$records | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outDir 'provenance.json') -Encoding utf8
Write-Output 'Created English and Spanish NVDA audio guides.'
