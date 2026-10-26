param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
$app=$null;$deck=$null
try {
  if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'Close PowerPoint before visual import so existing presentations remain untouched.'}
  $app=New-Object -ComObject PowerPoint.Application
  $app.AutomationSecurity=3
  $app.DisplayAlerts=1
  $deck=$app.Presentations.Open($Source,-1,0,0)
  if($deck.Slides.Count -lt 1 -or $deck.Slides.Count -gt 200){throw 'A deck must contain 1–200 slides.'}
  $ratio=[double]$deck.PageSetup.SlideWidth/[double]$deck.PageSetup.SlideHeight
  if($ratio -ge 1){$width=1920;$height=[int][Math]::Round(1920/$ratio)}else{$height=1920;$width=[int][Math]::Round(1920*$ratio)}
  for($i=1;$i -le $deck.Slides.Count;$i++){
    $name='slide-'+$i.ToString('D3')+'.png'
    $deck.Slides.Item($i).Export((Join-Path $Destination $name),'PNG',$width,$height)
  }
} catch {Write-Error $_.Exception.Message;exit 1}
finally {
  if($deck){$deck.Close();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck)}
  if($app){if($app.Presentations.Count -eq 0){$app.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}
  [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
