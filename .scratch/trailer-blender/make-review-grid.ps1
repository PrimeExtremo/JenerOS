# Contact sheets from rendered stills. Uses Windows' existing drawing library.
Add-Type -AssemblyName System.Drawing
$reviewRoot = Join-Path $PSScriptRoot 'live/boundaries'
$frames = Get-Content -LiteralPath (Join-Path $reviewRoot 'report.json') -Raw | ConvertFrom-Json
$font = [System.Drawing.Font]::new('Segoe UI', 10)
for ($page = 0; $page -lt [Math]::Ceiling($frames.Count / 12); $page++) {
    $sheet = [System.Drawing.Bitmap]::new(960, 800)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    $graphics.Clear([System.Drawing.Color]::FromArgb(24, 20, 17))
    for ($cell = 0; $cell -lt 12; $cell++) {
        $index = $page * 12 + $cell
        if ($index -ge $frames.Count) { break }
        $entry = $frames[$index]
        $x = ($cell % 3) * 320
        $y = [Math]::Floor($cell / 3) * 200
        $source = [System.Drawing.Image]::FromFile((Join-Path $reviewRoot $entry.file))
        $graphics.DrawImage($source, [int]$x, [int]$y, 320, 180)
        $graphics.DrawString($entry.file, $font, [System.Drawing.Brushes]::White, [single]($x + 5), [single]($y + 182))
        $source.Dispose()
    }
    $sheet.Save((Join-Path $reviewRoot ('contact-{0:00}.png' -f ($page + 1))))
    $graphics.Dispose()
    $sheet.Dispose()
}
$font.Dispose()
