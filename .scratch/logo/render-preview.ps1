Add-Type -AssemblyName System.Drawing
function Draw-Svg($graphics, $file, $x, $y, $width, $height) {
    [xml]$svg = Get-Content -LiteralPath $file -Raw -Encoding UTF8
    $sx = $width / [double]$svg.svg.width
    $sy = $height / [double]$svg.svg.height
    foreach ($element in $svg.SelectNodes('//*[local-name()="path"]')) {
        $fill = $element.ParentNode.GetAttribute('fill')
        $brush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($fill))
        $tx = 0.; $ty = 0.; $scale = 1.
        $transform = $element.GetAttribute('transform')
        if ($transform -match 'translate\(([-\d.]+) ([-\d.]+)\)') { $tx = [double]$Matches[1]; $ty = [double]$Matches[2] }
        if ($transform -match 'scale\(([-\d.]+)\)') { $scale = [double]$Matches[1] }
        $tokens = [regex]::Matches($element.GetAttribute('d'), '[MHVCZ]|-?\d+(?:\.\d+)?') | ForEach-Object { $_.Value }
        $path = [Drawing.Drawing2D.GraphicsPath]::new()
        if ($element.GetAttribute('fill-rule') -ne 'evenodd') { $path.FillMode = [Drawing.Drawing2D.FillMode]::Winding }
        $px = 0.; $py = 0.; $firstX = 0.; $firstY = 0.; $i = 0
        while ($i -lt $tokens.Count) {
            $cmd = $tokens[$i++]; $oldX = $px; $oldY = $py
            switch ($cmd) {
                'M' { $px = [double]$tokens[$i++]; $py = [double]$tokens[$i++]; $firstX = $px; $firstY = $py; $path.StartFigure() }
                'H' { $px = [double]$tokens[$i++]; $path.AddLine([single]$oldX,[single]$oldY,[single]$px,[single]$py) }
                'V' { $py = [double]$tokens[$i++]; $path.AddLine([single]$oldX,[single]$oldY,[single]$px,[single]$py) }
                'C' { $cx1=[single]$tokens[$i++]; $cy1=[single]$tokens[$i++]; $cx2=[single]$tokens[$i++]; $cy2=[single]$tokens[$i++]; $px=[double]$tokens[$i++]; $py=[double]$tokens[$i++]; $path.AddBezier([single]$oldX,[single]$oldY,$cx1,$cy1,$cx2,$cy2,[single]$px,[single]$py) }
                'Z' { $path.CloseFigure(); $px = $firstX; $py = $firstY }
                default { throw "Unsupported command $cmd" }
            }
        }
        $matrix = [Drawing.Drawing2D.Matrix]::new([single]($sx*$scale),0,0,[single]($sy*$scale),[single]($x+$tx*$sx),[single]($y+$ty*$sy))
        $path.Transform($matrix)
        $graphics.FillPath($brush,$path)
        $matrix.Dispose(); $path.Dispose(); $brush.Dispose()
    }
}
$bitmap = [Drawing.Bitmap]::new(1320,660)
$g = [Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([Drawing.ColorTranslator]::FromHtml('#F7F7F9'))
$dark = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#16161D'))
$g.FillRectangle($dark,0,330,1320,330)
Draw-Svg $g '[BRAND]/logo/j-monogram.svg' 30 30 256 256
Draw-Svg $g '[BRAND]/logo/jeneros-wordmark.svg' 330 80 924 180
Draw-Svg $g '[BRAND]/logo/j-monogram.svg' 340 275 32 32
Draw-Svg $g '[BRAND]/logo/j-monogram.svg' 410 259 64 64
Draw-Svg $g '[BRAND]/logo/jeneros-wordmark.svg' 540 272 246.4 48
Draw-Svg $g '[BRAND]/logo/j-monogram-light.svg' 30 360 256 256
Draw-Svg $g '[BRAND]/logo/jeneros-wordmark-light.svg' 330 410 924 180
Draw-Svg $g '[BRAND]/logo/splash-512.svg' 340 605 32 32
Draw-Svg $g '[BRAND]/logo/j-monogram-light.svg' 410 589 64 64
Draw-Svg $g '[BRAND]/logo/jeneros-wordmark-light.svg' 540 602 246.4 48
$bitmap.Save((Join-Path (Get-Location) '.scratch/logo/preview.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bitmap.Dispose(); $dark.Dispose()
