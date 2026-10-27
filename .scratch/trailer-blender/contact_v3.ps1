param([switch]$Boundaries)
Add-Type -AssemblyName System.Drawing
$reviewRoot = Join-Path $PSScriptRoot $(if ($Boundaries) { 'live/v3/boundaries' } else { 'live/v3' })
$pattern = if ($Boundaries) { 'cut-*.png' } else { 'shot-*.png' }
$frames = @(Get-ChildItem -LiteralPath $reviewRoot -Filter $pattern | Sort-Object Name)
if ($Boundaries) {
    $frames = @($frames | Sort-Object @{Expression={ [int]($_.BaseName -split '-')[1] }}, @{Expression={ [int]($_.BaseName -replace '^cut-\d+-','') }})
}
$font = [System.Drawing.Font]::new('Segoe UI', 11)
for ($page = 0; $page -lt [Math]::Ceiling($frames.Count / 12); $page++) {
    $sheet = [System.Drawing.Bitmap]::new(1440, 1160)
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    $g.Clear([System.Drawing.Color]::FromArgb(24, 20, 17))
    for ($cell = 0; $cell -lt 12; $cell++) {
        $index = $page * 12 + $cell
        if ($index -ge $frames.Count) { break }
        $x = ($cell % 3) * 480
        $y = [Math]::Floor($cell / 3) * 290
        $source = [System.Drawing.Image]::FromFile($frames[$index].FullName)
        $g.DrawImage($source, [int]$x, [int]$y, 480, 270)
        $g.DrawString($frames[$index].Name, $font, [System.Drawing.Brushes]::White, [single]($x + 5), [single]($y + 271))
        $source.Dispose()
    }
    $sheet.Save((Join-Path $reviewRoot ('contact-{0:00}.png' -f ($page + 1))))
    $g.Dispose()
    $sheet.Dispose()
}
$font.Dispose()
